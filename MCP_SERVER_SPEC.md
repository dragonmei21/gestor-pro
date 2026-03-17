# MCP Server Specification — Gestor Pro

> File: `backend/mcp_server.py`
> All tools exposed here are callable by the Claude agent during multi-step reasoning.
> Pattern: FastAPI runs on :8000, MCP server runs as a subprocess or stdio transport.

---

## Overview

The MCP server exposes 6 tools. The Claude agent decides which tools to call, in what order, based on the user's request. This is what makes the chatbot "non-straightforward" — it's not a single prompt → output, it's a reasoning loop with real computation at each step.

```
Tool name               Purpose
─────────────────────── ──────────────────────────────────────────────────────
validate_invoice        Check invoice dict against VeriFactu 2025 rules
get_ledger_summary      Aggregate financials for a given quarter/year
filter_ledger           Query ledger entries with filters
simulate_tax            Calculate IVA/IRPF for given amounts
forecast_cashflow       Generate 3-month cashflow projection
generate_verifactu_xml  Produce compliant VeriFactu XML from invoice dict
```

---

## Setup (`mcp_server.py`)

```python
import json
import asyncio
from datetime import datetime, date
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from backend.db.database import SessionLocal
from backend.db import models
from backend.engine.verifactu import VeriFactuValidator
from backend.engine.cfo_engine import CFOEngine

app = Server("gestor-pro-mcp")
validator = VeriFactuValidator()
cfo = CFOEngine()
```

---

## Tool 1: `validate_invoice`

Runs the invoice dict through every VeriFactu 2025 rule. Returns violations + score.

```python
@app.call_tool()
async def validate_invoice(name: str, arguments: dict) -> list[TextContent]:
    """
    Input:
      invoice_data: dict with fields: numero_factura, fecha_emision, proveedor_nif,
                    cliente_nif, base_imponible, iva_porcentaje, iva_cuota, total, concepto

    Output:
      {
        "compliance_score": 72,
        "status": "minor_violations",
        "violations": [
          {
            "field": "proveedor_nif",
            "rule": "VF-001",
            "severity": "error",
            "description": "NIF format invalid — must be 8 digits + 1 letter",
            "fix": "Update NIF to format: 12345678A"
          },
          {
            "field": "fecha_emision",
            "rule": "VF-004",
            "severity": "warning",
            "description": "Invoice date missing timezone specifier",
            "fix": "Append 'T00:00:00Z' to date field"
          }
        ],
        "passed_checks": ["base_imponible_positive", "iva_rate_valid", "total_consistent"]
      }
    """
    invoice_data = arguments["invoice_data"]
    result = validator.check(invoice_data)
    return [TextContent(type="text", text=json.dumps(result))]
```

---

## Tool 2: `get_ledger_summary`

Aggregates the ledger for a given period. Used by chatbot to answer tax questions.

```python
@app.call_tool()
async def get_ledger_summary(name: str, arguments: dict) -> list[TextContent]:
    """
    Input:
      quarter: "2025-Q1" (optional, defaults to current quarter)
      year: 2025 (optional)

    Output:
      {
        "period": "2025-Q1",
        "total_ingresos": 16400.0,
        "total_gastos": 4250.0,
        "beneficio_neto": 12150.0,
        "iva_repercutido": 3444.0,
        "iva_soportado": 716.34,
        "iva_a_pagar": 2727.66,
        "irpf_retenido": 2460.0,
        "num_facturas_emitidas": 5,
        "num_facturas_recibidas": 8,
        "top_clientes": ["Empresa Digital SL", "FinanceGroup SA"],
        "top_gastos_categoria": {"software": 1240, "viaje": 890, "material": 420}
      }
    """
    db = SessionLocal()
    try:
        quarter = arguments.get("quarter", _current_quarter())
        year, q = _parse_quarter(quarter)
        
        entries = db.query(models.LedgerEntry).filter(
            models.LedgerEntry.trimestre == quarter
        ).all()
        
        ingresos = [e for e in entries if e.tipo == "ingreso"]
        gastos = [e for e in entries if e.tipo == "gasto"]
        
        result = {
            "period": quarter,
            "total_ingresos": sum(e.base_imponible for e in ingresos),
            "total_gastos": sum(e.base_imponible for e in gastos),
            "iva_repercutido": sum(e.iva for e in ingresos),
            "iva_soportado": sum(e.iva for e in gastos),
            "iva_a_pagar": sum(e.iva for e in ingresos) - sum(e.iva for e in gastos),
            "irpf_retenido": abs(sum(e.irpf for e in ingresos)),
            "num_facturas_emitidas": len(ingresos),
            "num_facturas_recibidas": len(gastos),
        }
        result["beneficio_neto"] = result["total_ingresos"] - result["total_gastos"]
        
        return [TextContent(type="text", text=json.dumps(result))]
    finally:
        db.close()
```

---

## Tool 3: `filter_ledger`

Returns filtered ledger entries. Used for specific queries like "show me my software expenses".

```python
@app.call_tool()
async def filter_ledger(name: str, arguments: dict) -> list[TextContent]:
    """
    Input:
      tipo: "ingreso" | "gasto" | null (optional)
      categoria: "servicios" | "software" | "viaje" | "material" | null (optional)
      contraparte: str (optional, partial match)
      date_from: "2025-01-01" (optional)
      date_to: "2025-03-31" (optional)
      limit: 20 (optional, default 20)

    Output:
      {
        "total_count": 8,
        "total_amount": 1450.20,
        "entries": [
          { "id": 7, "fecha": "2025-02-01", "concepto": "Hosting + dominios",
            "contraparte": "OVH SAS", "tipo": "gasto", "categoria": "software",
            "total": 107.69 },
          ...
        ]
      }
    """
    db = SessionLocal()
    try:
        query = db.query(models.LedgerEntry)
        if arguments.get("tipo"):
            query = query.filter(models.LedgerEntry.tipo == arguments["tipo"])
        if arguments.get("categoria"):
            query = query.filter(models.LedgerEntry.categoria == arguments["categoria"])
        if arguments.get("contraparte"):
            query = query.filter(models.LedgerEntry.contraparte.ilike(f"%{arguments['contraparte']}%"))
        if arguments.get("date_from"):
            query = query.filter(models.LedgerEntry.fecha >= arguments["date_from"])
        if arguments.get("date_to"):
            query = query.filter(models.LedgerEntry.fecha <= arguments["date_to"])
        
        entries = query.limit(arguments.get("limit", 20)).all()
        result = {
            "total_count": len(entries),
            "total_amount": sum(e.total for e in entries),
            "entries": [
                {"id": e.id, "fecha": str(e.fecha), "concepto": e.concepto,
                 "contraparte": e.contraparte, "tipo": e.tipo, "categoria": e.categoria,
                 "base_imponible": e.base_imponible, "iva": e.iva, "total": e.total}
                for e in entries
            ]
        }
        return [TextContent(type="text", text=json.dumps(result))]
    finally:
        db.close()
```

---

## Tool 4: `simulate_tax`

Deterministic tax simulation. No DB needed — pure calculation.

```python
@app.call_tool()
async def simulate_tax(name: str, arguments: dict) -> list[TextContent]:
    """
    Input:
      base_imponible: 4000.0
      iva_rate: 21.0        (percentage, e.g. 21 for 21%)
      irpf_rate: 15.0       (percentage, default 15 for professionals)
      tipo: "ingreso"       (ingreso | gasto)

    Output:
      {
        "base_imponible": 4000.0,
        "iva_cuota": 840.0,
        "irpf_retencion": 600.0,
        "total_factura": 4240.0,   # base + iva - irpf (for ingreso)
        "liquido_cobrado": 4240.0,
        "explanation": "Factura de 4.000€ base. IVA 21% = 840€. IRPF 15% = 600€ (te retienen). Cobras 4.240€."
      }
    """
    base = float(arguments["base_imponible"])
    iva_rate = float(arguments.get("iva_rate", 21))
    irpf_rate = float(arguments.get("irpf_rate", 15))
    tipo = arguments.get("tipo", "ingreso")
    
    iva = round(base * iva_rate / 100, 2)
    irpf = round(base * irpf_rate / 100, 2)
    
    if tipo == "ingreso":
        total = round(base + iva - irpf, 2)
        explanation = (f"Factura de {base:,.2f}€ base. "
                      f"IVA {iva_rate}% = {iva:,.2f}€. "
                      f"IRPF {irpf_rate}% = {irpf:,.2f}€ (el cliente te retiene). "
                      f"Cobras {total:,.2f}€.")
    else:
        total = round(base + iva, 2)
        explanation = (f"Gasto de {base:,.2f}€ base. "
                      f"IVA soportado {iva_rate}% = {iva:,.2f}€ (deducible). "
                      f"Pagas {total:,.2f}€.")
    
    result = {"base_imponible": base, "iva_cuota": iva, "irpf_retencion": irpf,
              "total_factura": total, "explanation": explanation}
    return [TextContent(type="text", text=json.dumps(result))]
```

---

## Tool 5: `forecast_cashflow`

Generates monthly cashflow projections based on historical ledger data.

```python
@app.call_tool()
async def forecast_cashflow(name: str, arguments: dict) -> list[TextContent]:
    """
    Input:
      months: 3      (number of months to forecast forward, default 3)
      method: "avg"  (avg | trend — avg uses last 3 months mean, trend uses linear regression)

    Output:
      {
        "historical": [
          { "mes": "Ene 2025", "ingresos": 6500, "gastos": 2100, "neto": 4400 },
          { "mes": "Feb 2025", "ingresos": 4700, "gastos": 1890, "neto": 2810 },
          { "mes": "Mar 2025", "ingresos": 5500, "gastos": 2340, "neto": 3160 }
        ],
        "forecast": [
          { "mes": "Abr 2025", "ingresos": 5567, "gastos": 2110, "neto": 3457, "is_forecast": true },
          { "mes": "May 2025", "ingresos": 5567, "gastos": 2110, "neto": 3457, "is_forecast": true },
          { "mes": "Jun 2025", "ingresos": 5567, "gastos": 2110, "neto": 3457, "is_forecast": true }
        ],
        "cashflow_risk": "low",   # low | medium | high
        "risk_reason": "Ingresos estables, sin picos de gasto previstos"
      }
    """
    months = arguments.get("months", 3)
    method = arguments.get("method", "avg")
    result = await cfo.generate_forecast(months=months, method=method)
    return [TextContent(type="text", text=json.dumps(result))]
```

---

## Tool 6: `generate_verifactu_xml`

Produces VeriFactu-compliant XML from an invoice dict.

```python
@app.call_tool()
async def generate_verifactu_xml(name: str, arguments: dict) -> list[TextContent]:
    """
    Input:
      invoice_data: dict (same structure as validate_invoice input)
      version: "1.0"  (VeriFactu schema version, default "1.0")

    Output:
      {
        "xml": "<?xml version='1.0' encoding='UTF-8'?>...",
        "schema_version": "1.0",
        "generated_at": "2025-03-17T10:30:00Z",
        "validation_passed": true
      }
    """
    invoice_data = arguments["invoice_data"]
    xml_output = validator.generate_xml(invoice_data)
    result = {
        "xml": xml_output,
        "schema_version": arguments.get("version", "1.0"),
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "validation_passed": True
    }
    return [TextContent(type="text", text=json.dumps(result))]
```

---

## Tool Registry (for Claude agent system prompt)

Tell Claude about all tools in the system prompt so it knows what's available:

```python
TOOL_DESCRIPTIONS = """
You have access to the following tools via the Gestor Pro MCP server:

1. validate_invoice(invoice_data) — Check an invoice against VeriFactu 2025 compliance rules. Returns violations, severity, and suggested fixes.
2. get_ledger_summary(quarter, year) — Get aggregated financial data for a period. Returns totals, IVA owed, IRPF withheld.
3. filter_ledger(tipo, categoria, contraparte, date_from, date_to) — Query specific ledger entries.
4. simulate_tax(base_imponible, iva_rate, irpf_rate, tipo) — Calculate tax breakdown for any invoice amount.
5. forecast_cashflow(months, method) — Generate cashflow projections based on historical data.
6. generate_verifactu_xml(invoice_data) — Produce compliant VeriFactu XML from an invoice.

Always prefer calling tools over guessing. If the user asks about specific numbers, call get_ledger_summary or filter_ledger first.
Respond in Spanish unless the user writes in English.
"""
```

---

## Running the MCP Server

```bash
# Start MCP server (stdio transport for Claude Desktop / Claude Code)
python -m backend.mcp_server

# Or run as part of FastAPI startup (embedded mode for demo)
# In main.py, import and register tools directly via HTTP bridge
```

---

## Agent Loop Pattern (in `main.py` chatbot endpoint)

```python
async def run_agent_loop(user_message: str, conversation_history: list) -> dict:
    """
    Multi-turn tool-calling loop. Max 5 iterations.
    Returns final text response + list of tool calls made.
    """
    client = anthropic.Anthropic()
    tools_called = []
    messages = conversation_history + [{"role": "user", "content": user_message}]
    
    for iteration in range(5):
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=SYSTEM_PROMPT + TOOL_DESCRIPTIONS,
            tools=ANTHROPIC_TOOL_SCHEMAS,   # see below
            messages=messages
        )
        
        # If Claude wants to call a tool
        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = await execute_tool(block.name, block.input)
                    tools_called.append({"tool": block.name, "input": block.input})
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    })
            
            # Add assistant response + tool results to history
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
        
        # If Claude has a final answer
        elif response.stop_reason == "end_turn":
            final_text = next(b.text for b in response.content if b.type == "text")
            return {"response": final_text, "tools_called": tools_called, "iterations": iteration + 1}
    
    return {"response": "No he podido completar la consulta.", "tools_called": tools_called}
```

---

## Anthropic Tool Schemas (for `messages.create(tools=[...])`)

```python
ANTHROPIC_TOOL_SCHEMAS = [
    {
        "name": "get_ledger_summary",
        "description": "Get aggregated financial summary for a quarter. Returns totals, IVA owed, IRPF withheld.",
        "input_schema": {
            "type": "object",
            "properties": {
                "quarter": {"type": "string", "description": "Quarter in format 2025-Q1"},
                "year": {"type": "integer", "description": "Year, e.g. 2025"}
            }
        }
    },
    {
        "name": "filter_ledger",
        "description": "Query ledger entries with optional filters. Use to find specific expenses or income.",
        "input_schema": {
            "type": "object",
            "properties": {
                "tipo": {"type": "string", "enum": ["ingreso", "gasto"]},
                "categoria": {"type": "string"},
                "contraparte": {"type": "string", "description": "Partial name match"},
                "date_from": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                "date_to": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                "limit": {"type": "integer", "default": 20}
            }
        }
    },
    {
        "name": "simulate_tax",
        "description": "Calculate IVA and IRPF for a given base amount. Use when user asks about tax on a specific invoice.",
        "input_schema": {
            "type": "object",
            "properties": {
                "base_imponible": {"type": "number"},
                "iva_rate": {"type": "number", "default": 21},
                "irpf_rate": {"type": "number", "default": 15},
                "tipo": {"type": "string", "enum": ["ingreso", "gasto"], "default": "ingreso"}
            },
            "required": ["base_imponible"]
        }
    },
    {
        "name": "forecast_cashflow",
        "description": "Generate cashflow projections. Use when user asks about future financial situation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "months": {"type": "integer", "default": 3},
                "method": {"type": "string", "enum": ["avg", "trend"], "default": "avg"}
            }
        }
    },
    {
        "name": "validate_invoice",
        "description": "Check invoice against VeriFactu 2025 compliance rules.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_data": {"type": "object", "description": "Invoice fields dict"}
            },
            "required": ["invoice_data"]
        }
    },
    {
        "name": "generate_verifactu_xml",
        "description": "Generate VeriFactu-compliant XML from invoice data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_data": {"type": "object"},
                "version": {"type": "string", "default": "1.0"}
            },
            "required": ["invoice_data"]
        }
    }
]
```

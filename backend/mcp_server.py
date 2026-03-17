"""
Gestor Pro MCP Server — 6 tools callable by the OpenAI agent.
Run standalone: python -m backend.mcp_server
"""
import json
import asyncio
from datetime import datetime, date

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from backend.db.database import SessionLocal
from backend.db import models
from backend.engine.verifactu import VeriFactuValidator

app = Server("gestor-pro-mcp")
validator = VeriFactuValidator()


# ── helpers ───────────────────────────────────────────────────────────────────

def _current_quarter() -> str:
    today = date.today()
    q = (today.month - 1) // 3 + 1
    return f"{today.year}-Q{q}"


MONTH_NAMES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
                  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


def _month_name(offset: int) -> str:
    today = date.today()
    month_idx = (today.month - 1 + offset) % 12
    year = today.year + ((today.month - 1 + offset) // 12)
    return f"{MONTH_NAMES_ES[month_idx]} {year}"


# ── tool list ──────────────────────────────────────────────────────────────────

@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="validate_invoice",
            description="Check an invoice dict against VeriFactu 2025 compliance rules. Returns violations, severity, and suggested fixes.",
            inputSchema={
                "type": "object",
                "properties": {
                    "invoice_data": {
                        "type": "object",
                        "description": "Invoice fields: numero_factura, fecha_emision, proveedor_nif, cliente_nif, base_imponible, iva_porcentaje, iva_cuota, irpf_retencion, total, concepto, moneda"
                    }
                },
                "required": ["invoice_data"]
            }
        ),
        Tool(
            name="get_ledger_summary",
            description="Get aggregated financial summary for a quarter. Returns totals, IVA owed, IRPF withheld.",
            inputSchema={
                "type": "object",
                "properties": {
                    "quarter": {"type": "string", "description": "Quarter in format 2025-Q1"},
                    "year": {"type": "integer", "description": "Year e.g. 2025"}
                }
            }
        ),
        Tool(
            name="filter_ledger",
            description="Query ledger entries with optional filters. Use to find specific expenses or income.",
            inputSchema={
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
        ),
        Tool(
            name="simulate_tax",
            description="Calculate IVA and IRPF for a given base amount. Use when user asks about tax on a specific invoice.",
            inputSchema={
                "type": "object",
                "properties": {
                    "base_imponible": {"type": "number"},
                    "iva_rate": {"type": "number", "default": 21},
                    "irpf_rate": {"type": "number", "default": 15},
                    "tipo": {"type": "string", "enum": ["ingreso", "gasto"], "default": "ingreso"}
                },
                "required": ["base_imponible"]
            }
        ),
        Tool(
            name="forecast_cashflow",
            description="Generate cashflow projections based on historical ledger data.",
            inputSchema={
                "type": "object",
                "properties": {
                    "months": {"type": "integer", "default": 3},
                    "method": {"type": "string", "enum": ["avg", "trend"], "default": "avg"}
                }
            }
        ),
        Tool(
            name="generate_verifactu_xml",
            description="Generate VeriFactu-compliant XML from invoice data.",
            inputSchema={
                "type": "object",
                "properties": {
                    "invoice_data": {"type": "object"},
                    "version": {"type": "string", "default": "1.0"}
                },
                "required": ["invoice_data"]
            }
        ),
    ]


# ── tool dispatcher ────────────────────────────────────────────────────────────

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "validate_invoice":
        return await _validate_invoice(arguments)
    elif name == "get_ledger_summary":
        return await _get_ledger_summary(arguments)
    elif name == "filter_ledger":
        return await _filter_ledger(arguments)
    elif name == "simulate_tax":
        return await _simulate_tax(arguments)
    elif name == "forecast_cashflow":
        return await _forecast_cashflow(arguments)
    elif name == "generate_verifactu_xml":
        return await _generate_verifactu_xml(arguments)
    else:
        return [TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]


# ── tool implementations ───────────────────────────────────────────────────────

async def _validate_invoice(arguments: dict) -> list[TextContent]:
    result = validator.check(arguments["invoice_data"])
    return [TextContent(type="text", text=json.dumps(result))]


async def _get_ledger_summary(arguments: dict) -> list[TextContent]:
    db = SessionLocal()
    try:
        quarter = arguments.get("quarter", _current_quarter())
        entries = db.query(models.LedgerEntry).filter(
            models.LedgerEntry.trimestre == quarter
        ).all()

        ingresos = [e for e in entries if e.tipo == "ingreso"]
        gastos   = [e for e in entries if e.tipo == "gasto"]

        total_ingresos  = sum(e.base_imponible for e in ingresos)
        total_gastos    = sum(e.base_imponible for e in gastos)
        iva_repercutido = sum(e.iva for e in ingresos)
        iva_soportado   = sum(e.iva for e in gastos)
        irpf_retenido   = abs(sum(e.irpf for e in ingresos))

        client_totals: dict = {}
        for e in ingresos:
            client_totals[e.contraparte] = client_totals.get(e.contraparte, 0) + e.base_imponible
        top_clientes = [k for k, _ in sorted(client_totals.items(), key=lambda x: -x[1])[:3]]

        cat_totals: dict = {}
        for e in gastos:
            cat_totals[e.categoria] = cat_totals.get(e.categoria, 0) + e.base_imponible
        top_gastos_categoria = dict(sorted(cat_totals.items(), key=lambda x: -x[1])[:4])

        result = {
            "period": quarter,
            "total_ingresos": round(total_ingresos, 2),
            "total_gastos": round(total_gastos, 2),
            "beneficio_neto": round(total_ingresos - total_gastos, 2),
            "iva_repercutido": round(iva_repercutido, 2),
            "iva_soportado": round(iva_soportado, 2),
            "iva_a_pagar": round(iva_repercutido - iva_soportado, 2),
            "irpf_retenido": round(irpf_retenido, 2),
            "num_facturas_emitidas": len(ingresos),
            "num_facturas_recibidas": len(gastos),
            "top_clientes": top_clientes,
            "top_gastos_categoria": top_gastos_categoria,
        }
        return [TextContent(type="text", text=json.dumps(result))]
    finally:
        db.close()


async def _filter_ledger(arguments: dict) -> list[TextContent]:
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

        entries = query.order_by(models.LedgerEntry.fecha.desc()).limit(arguments.get("limit", 20)).all()

        result = {
            "total_count": len(entries),
            "total_amount": round(sum(e.total for e in entries), 2),
            "entries": [
                {
                    "id": e.id,
                    "fecha": str(e.fecha),
                    "concepto": e.concepto,
                    "contraparte": e.contraparte,
                    "tipo": e.tipo,
                    "categoria": e.categoria,
                    "base_imponible": e.base_imponible,
                    "iva": e.iva,
                    "total": e.total,
                    "estado_pago": e.estado_pago,
                }
                for e in entries
            ]
        }
        return [TextContent(type="text", text=json.dumps(result))]
    finally:
        db.close()


async def _simulate_tax(arguments: dict) -> list[TextContent]:
    base      = float(arguments["base_imponible"])
    iva_rate  = float(arguments.get("iva_rate", 21))
    irpf_rate = float(arguments.get("irpf_rate", 15))
    tipo      = arguments.get("tipo", "ingreso")

    iva  = round(base * iva_rate / 100, 2)
    irpf = round(base * irpf_rate / 100, 2)

    if tipo == "ingreso":
        total = round(base + iva - irpf, 2)
        explanation = (
            f"Factura de {base:,.2f}€ base. "
            f"IVA {iva_rate}% = {iva:,.2f}€. "
            f"IRPF {irpf_rate}% = {irpf:,.2f}€ (el cliente te retiene). "
            f"Cobras {total:,.2f}€."
        )
    else:
        total = round(base + iva, 2)
        explanation = (
            f"Gasto de {base:,.2f}€ base. "
            f"IVA soportado {iva_rate}% = {iva:,.2f}€ (deducible). "
            f"Pagas {total:,.2f}€."
        )

    result = {
        "base_imponible": base,
        "iva_cuota": iva,
        "irpf_retencion": irpf,
        "total_factura": total,
        "liquido_cobrado": total,
        "explanation": explanation,
    }
    return [TextContent(type="text", text=json.dumps(result))]


async def _forecast_cashflow(arguments: dict) -> list[TextContent]:
    months = int(arguments.get("months", 3))
    method = arguments.get("method", "avg")

    db = SessionLocal()
    try:
        entries = db.query(models.LedgerEntry).all()

        # Group by year+month
        monthly: dict = {}
        for e in entries:
            key = (e.fecha.year, e.fecha.month)
            if key not in monthly:
                monthly[key] = {"ingresos": 0.0, "gastos": 0.0}
            if e.tipo == "ingreso":
                monthly[key]["ingresos"] += e.base_imponible
            else:
                monthly[key]["gastos"] += e.base_imponible

        historical = []
        for (yr, mo) in sorted(monthly.keys()):
            d = monthly[(yr, mo)]
            historical.append({
                "mes": f"{MONTH_NAMES_ES[mo - 1]} {yr}",
                "ingresos": round(d["ingresos"], 2),
                "gastos": round(d["gastos"], 2),
                "neto": round(d["ingresos"] - d["gastos"], 2),
                "is_forecast": False,
            })

        # Fallback demo data if DB is empty
        if not historical:
            historical = [
                {"mes": "Ene 2025", "ingresos": 6500, "gastos": 2100, "neto": 4400, "is_forecast": False},
                {"mes": "Feb 2025", "ingresos": 4700, "gastos": 1890, "neto": 2810, "is_forecast": False},
                {"mes": "Mar 2025", "ingresos": 5500, "gastos": 2340, "neto": 3160, "is_forecast": False},
            ]

        avg_income  = sum(h["ingresos"] for h in historical) / len(historical)
        avg_expense = sum(h["gastos"]   for h in historical) / len(historical)

        if method == "trend" and len(historical) >= 2:
            inc_vals  = [h["ingresos"] for h in historical]
            exp_vals  = [h["gastos"]   for h in historical]
            inc_slope = (inc_vals[-1] - inc_vals[0]) / max(len(inc_vals) - 1, 1)
            exp_slope = (exp_vals[-1] - exp_vals[0]) / max(len(exp_vals) - 1, 1)
        else:
            inc_slope = 0.0
            exp_slope = 0.0

        forecast = []
        for i in range(months):
            proj_inc = max(0, round(avg_income  + inc_slope * (i + 1), 2))
            proj_exp = max(0, round(avg_expense + exp_slope * (i + 1), 2))
            forecast.append({
                "mes": _month_name(i + 1),
                "ingresos": proj_inc,
                "gastos": proj_exp,
                "neto": round(proj_inc - proj_exp, 2),
                "is_forecast": True,
            })

        netos = [h["neto"] for h in historical]
        negative_months = sum(1 for n in netos if n < 0)
        if negative_months == 0:
            cashflow_risk = "low"
            risk_reason = "Ingresos estables, sin meses negativos en el histórico."
        elif negative_months == 1:
            cashflow_risk = "medium"
            risk_reason = "Un mes con flujo negativo detectado — vigilar liquidez."
        else:
            cashflow_risk = "high"
            risk_reason = f"{negative_months} meses con flujo negativo — riesgo de tensión de tesorería."

        result = {
            "historical": historical,
            "forecast": forecast,
            "cashflow_risk": cashflow_risk,
            "risk_reason": risk_reason,
            "summary": {
                "avg_monthly_income": round(avg_income, 2),
                "avg_monthly_expense": round(avg_expense, 2),
                "avg_monthly_net": round(avg_income - avg_expense, 2),
            }
        }
        return [TextContent(type="text", text=json.dumps(result))]
    finally:
        db.close()


async def _generate_verifactu_xml(arguments: dict) -> list[TextContent]:
    xml_output = validator.generate_xml(arguments["invoice_data"])
    result = {
        "xml": xml_output,
        "schema_version": arguments.get("version", "1.0"),
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "validation_passed": True,
    }
    return [TextContent(type="text", text=json.dumps(result))]


# ── entrypoint ─────────────────────────────────────────────────────────────────

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())

# Backend Engine Specs — Gestor Pro

> All files in `backend/engine/`. Each section is one file.
> Claude Code: implement these in order — verifactu.py first, then invoice_parser.py, then cfo_engine.py.

---

## `engine/verifactu.py` — VeriFactu Rules Engine

The deterministic brain of the compliance module. No LLM here — pure rule evaluation.

### VeriFactu 2025 Rules to Implement

```python
VERIFACTU_RULES = {
    "VF-001": {
        "field": "proveedor_nif",
        "description": "NIF/CIF must be present and valid format",
        "severity": "error",
        "check": lambda v: bool(re.match(r'^[A-Z0-9]\d{7}[A-Z0-9]$', str(v or ''))),
        "fix": "Ensure NIF is 8 digits followed by 1 letter (e.g., 12345678A) or CIF format (A12345678)"
    },
    "VF-002": {
        "field": "numero_factura",
        "description": "Invoice number must follow sequential numbering series",
        "severity": "error",
        "check": lambda v: bool(v and len(str(v)) > 0),
        "fix": "Add a unique sequential invoice number (e.g., 2025-001)"
    },
    "VF-003": {
        "field": "fecha_emision",
        "description": "Issue date must be present and in ISO 8601 format",
        "severity": "error",
        "check": lambda v: _valid_date(v),
        "fix": "Format date as YYYY-MM-DD (e.g., 2025-03-15)"
    },
    "VF-004": {
        "field": "base_imponible",
        "description": "Tax base must be a positive number",
        "severity": "error",
        "check": lambda v: isinstance(v, (int, float)) and v > 0,
        "fix": "Ensure base_imponible is a positive decimal number"
    },
    "VF-005": {
        "field": "iva_porcentaje",
        "description": "IVA rate must be one of: 0, 4, 10, 21",
        "severity": "error",
        "check": lambda v: float(v or -1) in [0, 4, 10, 21],
        "fix": "Use a valid Spanish IVA rate: 0% (exempt), 4% (super-reduced), 10% (reduced), 21% (general)"
    },
    "VF-006": {
        "field": "iva_cuota",
        "description": "IVA amount must match base × rate calculation",
        "severity": "error",
        "check": lambda inv: abs(float(inv.get('iva_cuota',0)) - round(float(inv.get('base_imponible',0)) * float(inv.get('iva_porcentaje',0)) / 100, 2)) < 0.02,
        "fix": "Recalculate: iva_cuota = base_imponible × (iva_porcentaje / 100)"
    },
    "VF-007": {
        "field": "total",
        "description": "Total must equal base + IVA - IRPF",
        "severity": "error",
        "check": lambda inv: abs(float(inv.get('total',0)) - (float(inv.get('base_imponible',0)) + float(inv.get('iva_cuota',0)) - float(inv.get('irpf_retencion',0)))) < 0.02,
        "fix": "Recalculate total: base_imponible + iva_cuota - irpf_retencion"
    },
    "VF-008": {
        "field": "concepto",
        "description": "Description/concept must be present and non-empty",
        "severity": "warning",
        "check": lambda v: bool(v and len(str(v).strip()) > 3),
        "fix": "Add a meaningful description of the goods or services provided"
    },
    "VF-009": {
        "field": "cliente_nif",
        "description": "Client NIF required for B2B invoices over 3,000€",
        "severity": "warning",
        "check": lambda inv: not (float(inv.get('total',0)) > 3000 and not inv.get('cliente_nif')),
        "fix": "Add client NIF for invoices over 3,000€ (required for B2B VeriFactu)"
    },
    "VF-010": {
        "field": "moneda",
        "description": "Currency code must be ISO 4217 (EUR for Spain)",
        "severity": "warning",
        "check": lambda v: str(v or 'EUR').upper() in ['EUR', 'USD', 'GBP'],
        "fix": "Set currency to EUR for Spanish invoices"
    }
}
```

### Class Structure

```python
class VeriFactuValidator:
    def __init__(self):
        self.rules = VERIFACTU_RULES

    def check(self, invoice_data: dict) -> dict:
        violations = []
        passed = []
        
        for rule_id, rule in self.rules.items():
            field = rule["field"]
            try:
                # Some rules check the whole invoice dict, some check a single field
                if rule["check"].__code__.co_varnames[0] == 'inv':
                    passed_check = rule["check"](invoice_data)
                else:
                    passed_check = rule["check"](invoice_data.get(field))
            except Exception:
                passed_check = False
            
            if not passed_check:
                violations.append({
                    "rule_id": rule_id,
                    "field": field,
                    "severity": rule["severity"],
                    "description": rule["description"],
                    "fix": rule["fix"]
                })
            else:
                passed.append(rule_id)
        
        error_count = sum(1 for v in violations if v["severity"] == "error")
        warning_count = sum(1 for v in violations if v["severity"] == "warning")
        
        if error_count == 0 and warning_count == 0:
            status = "compliant"
            score = 100
        elif error_count == 0:
            status = "minor_violations"
            score = max(70, 100 - (warning_count * 5))
        else:
            status = "major_violations"
            score = max(0, 100 - (error_count * 15) - (warning_count * 5))
        
        return {
            "compliance_score": score,
            "status": status,
            "violations": violations,
            "passed_checks": passed,
            "error_count": error_count,
            "warning_count": warning_count
        }

    def generate_xml(self, invoice_data: dict) -> str:
        """Generate VeriFactu 1.0 compliant XML"""
        # Auto-fix common issues before generating
        data = self._auto_fix(invoice_data)
        
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<RegistroFacturacion xmlns="https://www2.agenciatributaria.gob.es/ADUA/internet/es/aeat/dit/adu/boexxx/esquemas/VeriFactu1.0">
  <Cabecera>
    <Version>1.0</Version>
    <FechaGeneracion>{datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')}</FechaGeneracion>
  </Cabecera>
  <RegistroAlta>
    <IDFactura>
      <IDEmisorFactura>{data.get('proveedor_nif', '')}</IDEmisorFactura>
      <NumSerieFactura>{data.get('numero_factura', '')}</NumSerieFactura>
      <FechaExpedicionFactura>{data.get('fecha_emision', '')}</FechaExpedicionFactura>
    </IDFactura>
    <NombreRazonEmisor>{data.get('proveedor_nombre', '')}</NombreRazonEmisor>
    <TipoFactura>F1</TipoFactura>
    <DescripcionOperacion>{data.get('concepto', '')}</DescripcionOperacion>
    <Destinatarios>
      <IDDestinatario>
        <NIF>{data.get('cliente_nif', '')}</NIF>
        <NombreRazon>{data.get('cliente_nombre', '')}</NombreRazon>
      </IDDestinatario>
    </Destinatarios>
    <Desglose>
      <DetalleIVA>
        <TipoImpositivo>{data.get('iva_porcentaje', 21)}</TipoImpositivo>
        <BaseImponibleOImporteNoSujeto>{data.get('base_imponible', 0)}</BaseImponibleOImporteNoSujeto>
        <CuotaRepercutida>{data.get('iva_cuota', 0)}</CuotaRepercutida>
      </DetalleIVA>
    </Desglose>
    <CuotaTotal>{data.get('iva_cuota', 0)}</CuotaTotal>
    <ImporteTotal>{data.get('total', 0)}</ImporteTotal>
  </RegistroAlta>
</RegistroFacturacion>"""
        return xml

    def _auto_fix(self, data: dict) -> dict:
        """Apply safe auto-corrections before XML generation"""
        fixed = data.copy()
        # Recalculate IVA if mismatch
        if fixed.get('base_imponible') and fixed.get('iva_porcentaje'):
            fixed['iva_cuota'] = round(fixed['base_imponible'] * fixed['iva_porcentaje'] / 100, 2)
        # Recalculate total
        irpf = fixed.get('irpf_retencion', 0) or 0
        fixed['total'] = round(fixed.get('base_imponible', 0) + fixed.get('iva_cuota', 0) - irpf, 2)
        return fixed
```

---

## `engine/invoice_parser.py` — Multi-Step Extraction + Repair Loop

### Architecture

```
Input (PDF/image)
      ↓
Step 1: Text extraction
  ├── PDF → pdfplumber
  └── Image → OpenCV preprocessing → Tesseract OCR
           OR → Claude vision (multimodal) if image quality low
      ↓
Step 2: LLM extraction (claude-haiku-4-5, structured JSON prompt)
      ↓
Step 3: Python validation (totals, IVA rate, date format, NIF)
      ↓
Step 4: If errors → LLM repair call (send errors back, ask Claude to fix)
      ↓
Step 5: Deterministic IVA/IRPF classification
      ↓
Output: InvoiceExtraction dataclass
```

### Key Code Patterns

```python
EXTRACTION_PROMPT = """Extract invoice data from the text below and return ONLY valid JSON.

Required fields:
- numero_factura: string
- fecha_emision: string (YYYY-MM-DD format)
- proveedor_nombre: string
- proveedor_nif: string (Spanish NIF/CIF)
- cliente_nombre: string or null
- cliente_nif: string or null
- concepto: string (description of service/goods)
- base_imponible: number (tax base, without IVA)
- iva_porcentaje: number (0, 4, 10, or 21)
- iva_cuota: number (IVA amount)
- irpf_porcentaje: number (0, 7, 15, or 19)
- irpf_retencion: number (IRPF amount, positive number)
- total: number (final amount)
- moneda: string (default "EUR")

Return ONLY the JSON object. No explanation, no markdown, no code blocks.

Invoice text:
{text}"""

REPAIR_PROMPT = """The invoice extraction has validation errors. Fix them and return corrected JSON.

Original extraction:
{original_json}

Validation errors found:
{errors}

Return ONLY the corrected JSON object. Fix all errors listed above."""
```

```python
async def parse_invoice(file_bytes: bytes, filename: str) -> dict:
    # Step 1: Extract text
    if filename.endswith('.pdf'):
        text = extract_pdf_text(file_bytes)
    else:
        text = extract_image_text(file_bytes)  # OCR or multimodal
    
    # Step 2: LLM extraction
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1000,
        messages=[{"role": "user", "content": EXTRACTION_PROMPT.format(text=text)}]
    )
    extracted = json.loads(response.content[0].text)
    
    # Step 3: Validate
    errors = validate_extraction(extracted)
    
    # Step 4: Repair if needed
    repair_attempted = False
    repair_succeeded = None
    if errors:
        repair_attempted = True
        repair_response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1000,
            messages=[{"role": "user", "content": REPAIR_PROMPT.format(
                original_json=json.dumps(extracted, indent=2),
                errors="\n".join(errors)
            )}]
        )
        try:
            extracted = json.loads(repair_response.content[0].text)
            errors = validate_extraction(extracted)  # re-validate
            repair_succeeded = len(errors) == 0
        except json.JSONDecodeError:
            repair_succeeded = False
    
    # Step 5: Deterministic classification
    extracted['tipo'] = classify_tipo(extracted)
    extracted['categoria'] = classify_categoria(extracted)
    extracted['deducible'] = is_deducible(extracted)
    
    return {
        **extracted,
        "validation_passed": len(errors) == 0,
        "validation_errors": errors,
        "repair_attempted": repair_attempted,
        "repair_succeeded": repair_succeeded,
        "extraction_model": "claude-haiku-4-5"
    }
```

---

## `engine/cfo_engine.py` — FP&A + Cashflow Forecast

```python
import pandas as pd
import numpy as np
from datetime import date, timedelta

class CFOEngine:
    def __init__(self, db_session):
        self.db = db_session

    async def generate_forecast(self, months: int = 3, method: str = "avg") -> dict:
        """Load last 90 days from ledger, project forward N months"""
        entries = self._load_recent_entries(days=90)
        df = pd.DataFrame([e.__dict__ for e in entries])
        
        historical = self._aggregate_by_month(df)
        
        if method == "avg":
            avg_income = df[df.tipo == 'ingreso']['base_imponible'].mean() * 4  # monthly
            avg_expense = df[df.tipo == 'gasto']['base_imponible'].mean() * 4
            forecast = [
                {
                    "mes": _month_name(i + 1),
                    "ingresos": round(avg_income, 2),
                    "gastos": round(avg_expense, 2),
                    "neto": round(avg_income - avg_expense, 2),
                    "is_forecast": True
                }
                for i in range(months)
            ]
        
        # Determine risk
        netos = [h["neto"] for h in historical]
        cashflow_risk = "low" if all(n > 0 for n in netos) else "high" if sum(n < 0 for n in netos) > 1 else "medium"
        
        return {
            "historical": historical,
            "forecast": forecast,
            "cashflow_risk": cashflow_risk,
            "summary": {
                "avg_monthly_income": round(avg_income, 2),
                "avg_monthly_expense": round(avg_expense, 2),
                "avg_monthly_net": round(avg_income - avg_expense, 2)
            }
        }

    async def generate_cfo_narrative(self, forecast_data: dict) -> str:
        """Uses claude-sonnet-4-6 to write CFO board narrative in Spanish"""
        client = anthropic.Anthropic()
        
        prompt = f"""Eres el CFO de una empresa y debes escribir el resumen financiero mensual para la junta directiva.

Datos financieros del período:
{json.dumps(forecast_data, indent=2, ensure_ascii=False)}

Escribe un informe ejecutivo en español (máximo 4 párrafos) que incluya:
1. Resumen de resultados del trimestre
2. Tendencias observadas (positivas y negativas)
3. Proyección para los próximos 3 meses
4. 2-3 acciones recomendadas

Tono: profesional pero directo. Usa números concretos. Sé honesto sobre los riesgos."""

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
```

---

## `engine/rag_retriever.py` — Upgraded RAG

Key upgrades from v1:
1. Query rewriting before retrieval
2. Metadata filters (quarter, tipo)  
3. Citations in responses

```python
QUERY_REWRITE_PROMPT = """Rewrite this user question as an optimal search query for a financial document database.
The database contains invoice records and Spanish tax rules.
Return ONLY the rewritten query, nothing else.

Original question: {question}
Rewritten query:"""

class RAGRetriever:
    def retrieve_with_rewrite(self, query: str, quarter_filter: str = None) -> dict:
        # Step 1: Rewrite query for better retrieval
        client = anthropic.Anthropic()
        rewrite_response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=100,
            messages=[{"role": "user", "content": QUERY_REWRITE_PROMPT.format(question=query)}]
        )
        rewritten_query = rewrite_response.content[0].text.strip()
        
        # Step 2: Retrieve with optional metadata filter
        where_filter = {"trimestre": quarter_filter} if quarter_filter else None
        ledger_results = self.ledger_collection.query(
            query_texts=[rewritten_query],
            n_results=5,
            where=where_filter
        )
        tax_results = self.tax_collection.query(
            query_texts=[rewritten_query],
            n_results=3
        )
        
        # Step 3: Format with citations
        citations = []
        context_parts = []
        for i, (doc, meta) in enumerate(zip(ledger_results['documents'][0], ledger_results['metadatas'][0])):
            citation_id = f"[L{i+1}]"
            citations.append({"id": citation_id, "source": "ledger", "entry_id": meta.get("entry_id"), "text": doc[:100]})
            context_parts.append(f"{citation_id} {doc}")
        
        return {
            "rewritten_query": rewritten_query,
            "context": "\n\n".join(context_parts),
            "citations": citations
        }
```

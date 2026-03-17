import re
from datetime import datetime


def _valid_date(v):
    if not v:
        return False
    try:
        if hasattr(v, 'year'):
            return True
        datetime.strptime(str(v), "%Y-%m-%d")
        return True
    except Exception:
        return False


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
        "check": lambda v: float(v if v is not None else -1) in [0.0, 4.0, 10.0, 21.0],
        "fix": "Use a valid Spanish IVA rate: 0% (exempt), 4% (super-reduced), 10% (reduced), 21% (general)"
    },
    "VF-006": {
        "field": "iva_cuota",
        "description": "IVA amount must match base × rate calculation",
        "severity": "error",
        "check": lambda inv: abs(
            float(inv.get('iva_cuota', 0)) -
            round(float(inv.get('base_imponible', 0)) * float(inv.get('iva_porcentaje', 0)) / 100, 2)
        ) < 0.02,
        "fix": "Recalculate: iva_cuota = base_imponible × (iva_porcentaje / 100)"
    },
    "VF-007": {
        "field": "total",
        "description": "Total must equal base + IVA - IRPF",
        "severity": "error",
        "check": lambda inv: abs(
            float(inv.get('total', 0)) -
            (float(inv.get('base_imponible', 0)) + float(inv.get('iva_cuota', 0)) - float(inv.get('irpf_retencion', 0)))
        ) < 0.02,
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
        "check": lambda inv: not (float(inv.get('total', 0)) > 3000 and not inv.get('cliente_nif')),
        "fix": "Add client NIF for invoices over 3,000€ (required for B2B VeriFactu)"
    },
    "VF-010": {
        "field": "moneda",
        "description": "Currency code must be ISO 4217 (EUR for Spain)",
        "severity": "warning",
        "check": lambda v: str(v or 'EUR').upper() in ['EUR', 'USD', 'GBP'],
        "fix": "Set currency to EUR for Spanish invoices"
    },
}


class VeriFactuValidator:
    def __init__(self):
        self.rules = VERIFACTU_RULES

    def check(self, invoice_data: dict) -> dict:
        violations = []
        passed = []

        for rule_id, rule in self.rules.items():
            field = rule["field"]
            try:
                # Rules VF-006, VF-007, VF-009 inspect the whole invoice dict (first arg is 'inv')
                first_arg = rule["check"].__code__.co_varnames[0]
                if first_arg == 'inv':
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
            "warning_count": warning_count,
        }

    def generate_xml(self, invoice_data: dict) -> str:
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
        fixed = data.copy()
        if fixed.get('base_imponible') and fixed.get('iva_porcentaje') is not None:
            fixed['iva_cuota'] = round(
                float(fixed['base_imponible']) * float(fixed['iva_porcentaje']) / 100, 2
            )
        irpf = float(fixed.get('irpf_retencion', 0) or 0)
        fixed['total'] = round(
            float(fixed.get('base_imponible', 0)) + float(fixed.get('iva_cuota', 0)) - irpf, 2
        )
        return fixed

export interface LedgerEntry {
  id: number
  fecha: string
  concepto: string
  contraparte: string
  tipo: "ingreso" | "gasto"
  categoria: string
  base_imponible: number
  iva: number
  irpf: number
  total: number
  estado_pago: "pendiente" | "pagado" | "vencido"
  trimestre: string
}

export interface InvoiceExtraction {
  numero_factura: string
  fecha_emision: string
  proveedor_nombre: string
  proveedor_nif: string
  cliente_nombre: string | null
  concepto: string
  base_imponible: number
  iva_porcentaje: number
  iva_cuota: number
  irpf_porcentaje: number
  irpf_retencion: number
  total: number
  validation_passed: boolean
  validation_errors: string[]
  repair_attempted: boolean
  repair_succeeded: boolean | null
}

export interface ComplianceReport {
  compliance_score: number
  status: "compliant" | "minor_violations" | "major_violations"
  violations: {
    rule_id: string
    field: string
    severity: "error" | "warning"
    description: string
    fix: string
  }[]
  agent_narrative: string
  corrected_xml: string
  tool_calls_made: number
  processing_time_ms: number
}

export interface CFOReport {
  historical: { mes: string; ingresos: number; gastos: number; neto: number; is_forecast: boolean }[]
  forecast: { mes: string; ingresos: number; gastos: number; neto: number; is_forecast: boolean }[]
  cashflow_risk: "low" | "medium" | "high"
  narrative_es: string
  risk_flags: string[]
  action_items: string[]
  total_ingresos: number
  total_gastos: number
  beneficio_neto: number
  iva_a_pagar: number
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  tools_called?: { tool: string; input: object; result_preview: string }[]
}

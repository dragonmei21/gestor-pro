# Frontend Spec — Gestor Pro

> Stack: Next.js 14 (App Router) + Tailwind + shadcn/ui + Recharts
> All pages use the same layout: sidebar nav + main content area
> Color palette: Teal primary (#0FA876), dark navy text, white backgrounds

---

## Setup Commands

```bash
npx create-next-app@latest frontend --tailwind --app --typescript
cd frontend
npx shadcn-ui@latest init   # choose: slate theme, yes to CSS variables
npx shadcn-ui@latest add card badge button progress tabs separator skeleton

npm install recharts react-dropzone react-markdown lucide-react
```

---

## Global Layout (`app/layout.tsx`)

Sidebar with 4 nav items + main content.

```tsx
const NAV_ITEMS = [
  { href: "/",           icon: LayoutDashboard, label: "Dashboard" },
  { href: "/compliance", icon: ShieldCheck,     label: "VeriFactu" },
  { href: "/cfo",        icon: TrendingUp,      label: "CFO Report" },
  { href: "/invoices",   icon: Receipt,         label: "Facturas" },
  { href: "/chat",       icon: MessageSquare,   label: "Asistente" },
]
```

Sidebar style: `w-56 bg-[#0a1628] text-white` — dark navy. Active item: `bg-[#0FA876]/20 text-[#0FA876]`.

---

## Page: Dashboard (`app/page.tsx`)

Four KPI cards + recent activity table.

```tsx
// KPI cards data (fetched from GET /api/ledger/summary)
const KPI_CARDS = [
  { title: "Ingresos Q1",    value: "€16.400",  delta: "+12%",  color: "text-emerald-500" },
  { title: "Gastos Q1",      value: "€4.250",   delta: "+3%",   color: "text-red-400" },
  { title: "IVA a pagar",    value: "€2.728",   delta: "Vence 20 Abr", color: "text-amber-500" },
  { title: "Compliance",     value: "84/100",   delta: "2 warnings",  color: "text-blue-400" },
]
```

Recent activity: last 5 ledger entries in a simple table.

---

## Page: VeriFactu Compliance (`app/compliance/page.tsx`)

### Layout: Two columns
- Left: Upload zone + invoice preview
- Right: Compliance report (appears after analysis)

### Upload Zone Component

```tsx
// react-dropzone, accepts PDF + images
// Shows filename + file size after drop
// "Analizar factura" button → POST /api/compliance/check
// Loading: animated spinner + "Analizando con IA..." text

const [status, setStatus] = useState<"idle" | "uploading" | "done">("idle")
```

### Compliance Report Component

```tsx
interface ComplianceReport {
  compliance_score: number       // 0-100
  status: "compliant" | "minor_violations" | "major_violations"
  violations: Violation[]
  agent_narrative: string
  corrected_xml: string
  tool_calls_made: number        // Show this! "Agent made 3 tool calls"
}

// Score display: big circular progress or simple score badge
// Color: green ≥90, amber 70-89, red <70

// Violations list: each violation shows:
// - Severity badge (ERROR in red, WARNING in amber)
// - Field name in code style
// - Description
// - Fix suggestion (highlighted in green bg)

// Bottom: "Descargar XML corregido" button (downloads corrected_xml as .xml file)
// Show "Agent made N tool calls" as a subtle badge — this is the demo wow moment
```

---

## Page: AI CFO Report (`app/cfo/page.tsx`)

### Layout: Stacked
1. "Usar datos demo" button OR CSV upload
2. Loading state: "Tu CFO está analizando..."  
3. Recharts area chart + narrative below

### Chart Component

```tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// Data from /api/cfo/report forecast_data array
// Two areas: ingresos (teal) + gastos (coral/red)
// Forecast months have dashed stroke + lighter opacity
// Show "Histórico" vs "Previsión" in legend

const ChartColors = {
  ingresos: "#0FA876",
  gastos:   "#E8593C",
  neto:     "#6366f1"
}
```

### CFO Narrative Display

```tsx
// Render as markdown (react-markdown)
// Wrap in a styled card: left border accent in teal
// Show "Generado por claude-sonnet-4-6" in small text at bottom
// Risk badge at top: LOW/MEDIUM/HIGH in appropriate color
```

---

## Page: Chatbot (`app/chat/page.tsx`)

This is the best demo moment. Show the agent thinking.

### Message Types

```tsx
type Message = 
  | { role: "user",      content: string }
  | { role: "assistant", content: string, tools_called?: ToolCall[] }
  | { role: "tool",      tool_name: string, result_summary: string }  // shown inline

interface ToolCall {
  tool: string          // e.g. "get_ledger_summary"
  input: object
  result_preview: string
}
```

### Tool Call Visualization

When agent calls a tool, show it inline between messages:

```tsx
// Subtle card between messages showing:
// 🔧  get_ledger_summary  { quarter: "2025-Q1" }
//     → Total ingresos: €16.400, IVA a pagar: €2.728

<div className="mx-4 my-1 px-3 py-2 bg-muted/40 rounded-md border-l-2 border-teal-500">
  <span className="text-xs text-muted-foreground">🔧 Tool call</span>
  <code className="ml-2 text-xs font-mono text-teal-600">{toolCall.tool}</code>
  <p className="text-xs text-muted-foreground mt-1">{toolCall.result_preview}</p>
</div>
```

### Suggested Questions (shown on empty state)

```tsx
const SUGGESTED = [
  "¿Cuánto IVA debo declarar este trimestre?",
  "¿Cuáles son mis gastos de software este año?",
  "Si facturo 5.000€, ¿cuánto me queda neto?",
  "¿Qué facturas tengo pendientes de cobro?",
  "Resume mi situación financiera del Q1",
]
```

---

## Page: Invoice Scanner (`app/invoices/page.tsx`)

### Layout: Three sections
1. Upload zone (top)
2. Extraction result (appears after parse — shows fields side by side with original)
3. Ledger table (bottom — all entries from GET /api/ledger)

### Extraction Result Display

```tsx
// Two column layout:
// Left: PDF preview or image
// Right: Extracted fields in a form-like display

// If validation_errors.length > 0: show yellow warning box
// "⚠️ Se detectaron errores — Claude los corrigió automáticamente"
// List the errors that were fixed

// If repair_succeeded: show green "✓ Reparación automática exitosa"
// This demonstrates the multi-step repair loop to the grader
```

### Ledger Table

```tsx
// Columns: Fecha | Concepto | Contraparte | Tipo | Categoría | Base | IVA | Total | Estado
// Tipo badge: ingreso (green) | gasto (red)
// Estado badge: pagado (green) | pendiente (amber) | vencido (red)
// Sortable by fecha
// Filter by tipo (tabs: Todos | Ingresos | Gastos)
```

---

## `lib/api.ts` — All API Calls

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export const api = {
  // Invoice parsing
  async parseInvoice(file: File) {
    const form = new FormData()
    form.append("file", file)
    const res = await fetch(`${API_BASE}/api/invoices/parse`, { method: "POST", body: form })
    return res.json()
  },

  // Compliance check
  async checkCompliance(file: File) {
    const form = new FormData()
    form.append("file", file)
    const res = await fetch(`${API_BASE}/api/compliance/check`, { method: "POST", body: form })
    return res.json()
  },

  // CFO report
  async getCFOReport(file?: File) {
    const form = new FormData()
    if (file) form.append("file", file)
    form.append("use_demo", file ? "false" : "true")
    const res = await fetch(`${API_BASE}/api/cfo/report`, { method: "POST", body: form })
    return res.json()
  },

  // Chat
  async sendMessage(message: string, history: {role: string, content: string}[]) {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history })
    })
    return res.json()
  },

  // Ledger
  async getLedger() {
    return fetch(`${API_BASE}/api/ledger`).then(r => r.json())
  },

  async getLedgerSummary() {
    return fetch(`${API_BASE}/api/ledger/summary`).then(r => r.json())
  },
}
```

---

## `lib/types.ts` — Shared Types

```typescript
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
}

export interface CFOReport {
  historical: { mes: string; ingresos: number; gastos: number; neto: number }[]
  forecast: { mes: string; ingresos: number; gastos: number; neto: number; is_forecast: boolean }[]
  cashflow_risk: "low" | "medium" | "high"
  narrative_es: string
  risk_flags: string[]
  action_items: string[]
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  tools_called?: { tool: string; input: object; result_preview: string }[]
}
```

---

## Demo Mode Banner

Show at top of every page when `DEMO_MODE=true`:

```tsx
<div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
  <span>⚡</span>
  <span>Modo demo — usando datos de ejemplo. Sube tus propias facturas para análisis real.</span>
</div>
```

---

## Environment Variables

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_DEMO_MODE=true
```

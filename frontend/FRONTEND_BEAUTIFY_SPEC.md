# Gestor Pro — Frontend Beautification Spec
# FOR CLAUDE CODE — Read everything before touching a single file.

---

## Context — What exists and what we're doing

The backend is fully working at http://localhost:8000 (proxied via Nginx).
The frontend exists at /root/gestor-pro/frontend/app/ and is rendering but ugly.
We have a reference design from Lovable (Index.tsx uploaded) that shows the target aesthetic.
This is a school assignment — the professor needs to SEE the AI complexity, not just use it.

The job is:
1. Make it look like the Lovable reference design (dark, serif headings, green accents, cards)
2. Add UI elements that SHOW what the AI is doing (tool call logs, pipeline steps, explanations)
3. Keep ALL existing API calls working — do not change lib/api.ts or the backend

---

## Design System (match the Lovable screenshot exactly)

### Colors
```css
:root {
  --bg-primary: #0a0f0a;        /* near-black with green tint — page background */
  --bg-card: #111811;           /* card backgrounds */
  --bg-raised: #1a231a;         /* hover states, inputs */
  --sidebar-bg: #0d1f0d;        /* sidebar — deep forest green */
  --border: rgba(74,222,128,0.1); /* green-tinted borders */
  --border-strong: rgba(74,222,128,0.2);
  --text-primary: #e8f5e8;      /* slightly green-tinted white */
  --text-secondary: #7a9e7a;    /* muted green-gray */
  --text-tertiary: #3d5c3d;     /* very muted */
  --income: #4ade80;            /* bright green — positive amounts */
  --expense: #f87171;           /* red — negative amounts */
  --warning: #fbbf24;           /* amber — IVA deadlines */
  --info: #818cf8;              /* indigo — AI/MCP actions */
  --brand: #4ade80;
}
```

### Typography
- Headings (h1, h2): `font-family: 'Playfair Display', Georgia, serif` — weight 400
- Body: `font-family: 'Inter', system-ui, sans-serif`
- Numbers/amounts: always `font-variant-numeric: tabular-nums`
- KPI values: Playfair Display, font-size 32-36px, font-weight 300

### The sidebar
Exactly like the screenshot: dark forest green, logo top-left with green checkmark icon,
nav items in white/muted, active item highlighted green, Gmail status dot at bottom.
Add the matrix canvas animation (already implemented in layout.tsx — keep it).

---

## File-by-File Instructions

### 1. app/globals.css — REPLACE ENTIRELY

```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-primary: #0a0f0a;
  --bg-card: #111811;
  --bg-raised: #1a231a;
  --sidebar-bg: #0d1f0d;
  --border: rgba(74,222,128,0.1);
  --border-strong: rgba(74,222,128,0.2);
  --text-primary: #e8f5e8;
  --text-secondary: #7a9e7a;
  --text-tertiary: #3d5c3d;
  --income: #4ade80;
  --expense: #f87171;
  --warning: #fbbf24;
  --info: #818cf8;
  --brand: #4ade80;
  /* shadcn compat */
  --background: #0a0f0a;
  --foreground: #e8f5e8;
  --card: #111811;
  --card-foreground: #e8f5e8;
  --border-color: rgba(74,222,128,0.1);
  --muted: #1a231a;
  --muted-foreground: #7a9e7a;
  --primary: #4ade80;
  --primary-foreground: #0d1f0d;
  --destructive: #f87171;
  --radius: 0.5rem;
}

@layer base {
  * { border-color: var(--border-color); }
  body {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; font-weight: 400; }
}

/* Kill all light mode remnants */
.bg-white, .bg-gray-50, .bg-background { background: var(--bg-primary) !important; }
.bg-card { background: var(--bg-card) !important; }
.text-gray-900, .text-gray-800, .text-foreground { color: var(--text-primary) !important; }
.text-gray-500, .text-gray-600, .text-muted-foreground { color: var(--text-secondary) !important; }
.text-gray-400 { color: var(--text-tertiary) !important; }
.border, .border-b, .border-t { border-color: var(--border) !important; }
.shadow-sm, .shadow { box-shadow: none !important; border: 1px solid var(--border) !important; }
.hover\:bg-gray-50:hover, .hover\:bg-muted\/50:hover { background: var(--bg-raised) !important; }

/* Amounts */
.text-emerald-600, .text-green-600 { color: var(--income) !important; }
.text-red-500, .text-red-600 { color: var(--expense) !important; }
.text-amber-500, .text-amber-600 { color: var(--warning) !important; }
.text-blue-500, .text-blue-600 { color: var(--info) !important; }
.bg-emerald-50 { background: rgba(74,222,128,0.08) !important; }
.bg-red-50 { background: rgba(248,113,113,0.08) !important; }
.bg-amber-50 { background: rgba(251,191,36,0.08) !important; }
.bg-blue-50 { background: rgba(129,140,248,0.08) !important; }

/* Serif headings */
h1, h2, .font-serif { font-family: 'Playfair Display', Georgia, serif !important; }

/* Animations */
@keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
.animate-fade-up { animation: fadeUp 0.25s ease both; }
```

---

### 2. app/page.tsx — REPLACE ENTIRELY

The dashboard must match the Lovable Index.tsx reference which has:
- KPI cards row: Revenue (Q1), Expenses (Q1), VAT Payable, Net Profit
- Cash position section: Receivables bar + Payables bar
- Recent activity table (full ledger, not just 5 entries)
- MCP Insights panel (right column) — this is the KEY academic element
- Quick Actions panel (right column below MCP)

```tsx
"use client"
import { useEffect, useState } from "react"

const API = ""  // empty = relative URLs, Nginx proxies to backend

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null)
  const [ledger, setLedger] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/ledger/summary?quarter=2025-Q1").then(r => r.json()),
      fetch("/api/ledger").then(r => r.json())
    ]).then(([s, l]) => {
      setSummary(s)
      setLedger(Array.isArray(l) ? l : [])
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [])

  const fmt = (n: number) => `€${(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  const fmtDec = (n: number) => `€${(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const totalIngresos = summary?.total_ingresos || 0
  const totalGastos = summary?.total_gastos || 0
  const ivaAPagar = Math.abs(summary?.iva_a_pagar || 0)
  const beneficioNeto = summary?.beneficio_neto || 0
  const receivables = ledger.filter(e => e.tipo === "ingreso" && e.estado_pago === "pendiente").reduce((s, e) => s + (e.total || 0), 0)
  const payables = ledger.filter(e => e.tipo === "gasto" && e.estado_pago === "pendiente").reduce((s, e) => s + (e.total || 0), 0)
  const maxCash = Math.max(receivables, payables, 1)

  return (
    <div style={{ padding: "32px 40px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 400, color: "#e8f5e8", letterSpacing: "-0.02em" }}>
          Overview
        </h1>
        <p style={{ fontSize: 13, color: "#7a9e7a", marginTop: 4 }}>Financial integrity, automated.</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "REVENUE (Q1)", value: fmt(totalIngresos), color: "#e8f5e8" },
          { label: "EXPENSES (Q1)", value: fmtDec(totalGastos), color: "#e8f5e8" },
          { label: "VAT PAYABLE", value: fmtDec(ivaAPagar), color: "#fbbf24" },
          { label: "NET PROFIT", value: fmtDec(beneficioNeto), color: beneficioNeto >= 0 ? "#4ade80" : "#f87171" },
        ].map((kpi, i) => (
          <div key={i} style={{ background: "#111811", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", color: "#3d5c3d", textTransform: "uppercase", marginBottom: 10 }}>
              {kpi.label}
            </div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 30, fontWeight: 400, color: kpi.color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
              {loading ? "—" : kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Cash Position */}
      <div style={{ background: "#111811", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", color: "#3d5c3d", textTransform: "uppercase", marginBottom: 16 }}>CASH POSITION</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "#7a9e7a", marginBottom: 4 }}>Receivables</div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, color: "#4ade80", fontVariantNumeric: "tabular-nums" }}>{fmtDec(receivables)}</div>
            <div style={{ fontSize: 11, color: "#3d5c3d", marginTop: 2 }}>Unpaid income</div>
            <div style={{ marginTop: 10, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (receivables / maxCash) * 100)}%`, background: "#4ade80", borderRadius: 3, transition: "width 0.8s ease" }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#7a9e7a", marginBottom: 4 }}>Payables</div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, color: "#f87171", fontVariantNumeric: "tabular-nums" }}>{fmtDec(payables)}</div>
            <div style={{ fontSize: 11, color: "#3d5c3d", marginTop: 2 }}>Unpaid expenses</div>
            <div style={{ marginTop: 10, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (payables / maxCash) * 100)}%`, background: "#f87171", borderRadius: 3, transition: "width 0.8s ease" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main grid: table + right panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>

        {/* Recent Activity Table */}
        <div style={{ background: "#111811", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(74,222,128,0.08)" }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, color: "#e8f5e8" }}>Recent activity</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Inter', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(74,222,128,0.08)" }}>
                {["DATE","CONCEPT","COUNTERPART","TOTAL","STATE"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: h === "TOTAL" ? "right" : "left", fontSize: 9, fontWeight: 600, color: "#3d5c3d", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#3d5c3d", fontSize: 13 }}>Loading...</td></tr>
              ) : ledger.map((e, i) => (
                <tr key={e.id || i} style={{ borderBottom: "1px solid rgba(74,222,128,0.04)", background: i % 2 === 1 ? "rgba(74,222,128,0.015)" : "transparent" }}>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#7a9e7a", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{e.fecha}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: "#e8f5e8", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.concepto}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#7a9e7a", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.contraparte}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 500, color: e.tipo === "ingreso" ? "#4ade80" : "#f87171", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {e.tipo === "ingreso" ? "+" : "- "}€ {Math.abs(e.total || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: e.estado_pago === "pagado" ? "rgba(74,222,128,0.1)" : e.estado_pago === "vencido" ? "rgba(248,113,113,0.1)" : "rgba(251,191,36,0.1)", color: e.estado_pago === "pagado" ? "#4ade80" : e.estado_pago === "vencido" ? "#f87171" : "#fbbf24" }}>
                      {e.estado_pago}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* MCP INSIGHTS — the academic showcase element */}
          <div style={{ background: "#111811", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 12, padding: "20px" }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", color: "#3d5c3d", textTransform: "uppercase", marginBottom: 12 }}>MCP INSIGHTS</div>
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 400, color: "#e8f5e8", marginBottom: 10, lineHeight: 1.4 }}>
              Automation + Intelligence
            </h3>
            <p style={{ fontSize: 12, color: "#7a9e7a", lineHeight: 1.7, marginBottom: 14 }}>
              Your MCP server orchestrates tools that search invoices, extract OCR data, and answer complex financial questions.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "OCR extraction from uploaded invoices",
                "Invoice search by vendor, date, amount",
                "Real-time accounting Q&A in chat",
                "VeriFactu compliance checks",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#7a9e7a" }}>
                  <span style={{ color: "#4ade80", marginTop: 1, flexShrink: 0 }}>•</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ background: "#111811", border: "1px solid rgba(74,222,128,0.1)", borderRadius: 12, padding: "20px" }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", color: "#3d5c3d", textTransform: "uppercase", marginBottom: 12 }}>QUICK ACTIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Upload invoices (OCR)", sub: "Extract fields automatically", href: "/invoices" },
                { label: "Run compliance check", sub: "VeriFactu validation", href: "/compliance" },
                { label: "Ask the assistant", sub: "Natural language queries", href: "/chat" },
                { label: "Search invoices", sub: "Vendor, date, amount", href: "/invoices" },
              ].map((action, i) => (
                <a key={i} href={action.href} style={{ display: "block", padding: "10px 12px", background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.08)", borderRadius: 8, textDecoration: "none", cursor: "pointer", transition: "all 0.15s ease" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,222,128,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(74,222,128,0.04)")}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#e8f5e8" }}>{action.label}</div>
                  <div style={{ fontSize: 11, color: "#7a9e7a", marginTop: 2 }}>{action.sub}</div>
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
```

---

### 3. app/chat/page.tsx — ADD AI PROCESS EXPLANATION BANNER

At the top of the chat page, above the messages, add this educational banner:

```tsx
{/* AI Process Banner — shows professor the multi-step agent */}
<div style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)", borderRadius: 10, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 14 }}>
  <div style={{ flexShrink: 0, marginTop: 2 }}>
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#818cf8", animation: "pulse 2s ease infinite" }} />
  </div>
  <div>
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", color: "#818cf8", textTransform: "uppercase", marginBottom: 4 }}>
      MCP Agent Loop Active
    </div>
    <p style={{ fontSize: 12, color: "#7a9e7a", lineHeight: 1.6 }}>
      Each message triggers a multi-step reasoning loop: Claude decides which tools to call, 
      executes them against your real ledger data (SQLite via MCP server), 
      and synthesizes the results. Tool calls appear inline below.
    </p>
    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
      {["get_ledger_summary", "filter_ledger", "simulate_tax", "forecast_cashflow"].map(t => (
        <code key={t} style={{ fontSize: 10, color: "#818cf8", background: "rgba(129,140,248,0.1)", padding: "2px 6px", borderRadius: 4 }}>{t}</code>
      ))}
    </div>
  </div>
</div>
```

---

### 4. app/compliance/page.tsx — ADD PIPELINE EXPLANATION

Add this above the upload zone to explain what happens:

```tsx
{/* Pipeline explanation */}
<div style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "center" }}>
  {[
    { n: "1", label: "Upload invoice" },
    { n: "2", label: "LLM extraction" },
    { n: "3", label: "Rules validation" },
    { n: "4", label: "Auto-repair" },
    { n: "5", label: "XML generation" },
  ].map((step, i, arr) => (
    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#4ade80" }}>
          {step.n}
        </div>
        <span style={{ fontSize: 11, color: "#7a9e7a", whiteSpace: "nowrap" }}>{step.label}</span>
      </div>
      {i < arr.length - 1 && <div style={{ width: 20, height: 1, background: "rgba(74,222,128,0.2)" }} />}
    </div>
  ))}
</div>
```

---

### 5. app/cfo/page.tsx — ADD AI PROCESS NOTE

Below the generate button, add:
```tsx
<p style={{ fontSize: 11, color: "#3d5c3d", marginTop: 8, lineHeight: 1.5 }}>
  Reads your ledger → runs cashflow model → sends structured data to claude-sonnet-4-6 → 
  generates executive narrative in Spanish. Two LLM calls, one deterministic forecast.
</p>
```

---

### 6. app/invoices/page.tsx — SHOW REPAIR LOOP VISUALLY

When parsed result has repair_attempted=true, show this:

```tsx
<div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
  <div style={{ fontSize: 11, fontWeight: 600, color: "#fbbf24", marginBottom: 4 }}>⚙ Auto-repair triggered</div>
  <p style={{ fontSize: 11, color: "#7a9e7a", lineHeight: 1.5 }}>
    Initial extraction had validation errors. A second LLM call was made with the error context. 
    This is the multi-step repair loop — non-straightforward LLM usage per assignment spec.
  </p>
  {parsed.repair_succeeded && <div style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>✓ Repair succeeded</div>}
</div>
```

---

## After making all changes, rebuild:

```bash
cd /root/gestor-pro/frontend
npm run build 2>&1 | tail -10
pm2 restart gestor-frontend
sleep 8
pm2 status
```

## DO NOT change:
- lib/api.ts
- lib/types.ts  
- app/layout.tsx (sidebar is already correct)
- Any backend files
- package.json

## The fetch calls in page.tsx use fetch("/api/...") — relative URLs only.
## Nginx routes /api/* to the backend. This is already configured and working.

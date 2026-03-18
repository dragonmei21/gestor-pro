# Frontend Fix Session — Gestor Pro
# FOR CLAUDE CODE — Read every word. Do exactly what this says. Nothing else.

---

## What exists right now (verified on server)

```
/root/gestor-pro/
  backend/          ✅ Working — FastAPI on port 8000, seeded with 21 ledger entries
  frontend/
    app/
      layout.tsx    ← EXISTS — has the sidebar
      page.tsx      ← EXISTS — has dashboard code  
      globals.css   ← EXISTS — was just replaced with dark theme
      cfo/          ← EXISTS (folder)
      chat/         ← EXISTS (folder)
      compliance/   ← EXISTS (folder)
      invoices/     ← EXISTS (folder)
      gmail/        ← EXISTS (folder)
    components/     ← EXISTS — shadcn components
    lib/            ← EXISTS — api.ts, types.ts
    node_modules/   ← EXISTS
    package.json    ← EXISTS — Next.js 16, Tailwind 4, shadcn
    .next/          ← EXISTS — was built
```

---

## The Problems (in order of severity)

### Problem 1 — CRITICAL: Pages show 404
The root page `/` returns 404. The Next.js process running on port 3000 
is serving the app BUT the pages inside app/cfo/, app/chat/, app/compliance/, 
app/invoices/, app/gmail/ may be missing their page.tsx files.

The folder exists but the actual page.tsx file inside each subfolder may not exist.
Next.js App Router requires: app/cfo/page.tsx (not just app/cfo/)

**Root cause:** Claude Code created the folders but may not have created page.tsx 
files inside each one. The build succeeds but routes 404.

**Fix needed:** Check each subfolder has a page.tsx and create them if missing.

### Problem 2 — CRITICAL: Dashboard shows no data
The dashboard fetches from `NEXT_PUBLIC_API_URL` which is set to 
`http://localhost:8000` in .env.local. This works server-side but 
NOT from the browser — the browser tries to call localhost:8000 on 
the USER'S machine, not the server.

The correct URL should be `http://204.168.140.34:8000` (the Hetzner server IP).

BUT — Nginx is configured to proxy /api/ to port 8000. So the cleanest fix 
is to use relative URLs: the frontend should call `/api/chat` not 
`http://localhost:8000/api/chat`. Nginx routes it to the backend.

**Fix needed:** Update lib/api.ts to use relative URLs when no API_URL is set.

### Problem 3 — VISUAL: Wrong theme (light gray instead of dark Trullion)
The globals.css was already replaced with the dark theme CSS in the last session.
But the page.tsx files use Tailwind classes like `bg-gray-50`, `bg-white`, 
`text-gray-900` that override the dark theme. The CSS overrides in globals.css
handle most of these but inline styles in components may still show light colors.

**Fix needed:** Verify globals.css dark overrides are in place, fix any remaining
light-colored elements in page.tsx files.

### Problem 4 — PM2 not installed
PM2 was never installed. The frontend is running via `nohup npm start` which 
dies on server restart. Need to install PM2 and set up proper process management.

**Not urgent for the demo but needs doing.**

---

## Exact Fix Instructions for Claude Code

### Step 1 — Verify and fix page.tsx files in each route

Run this to check what exists:
```bash
for dir in cfo chat compliance invoices gmail; do
  if [ -f "/root/gestor-pro/frontend/app/$dir/page.tsx" ]; then
    echo "✅ $dir/page.tsx EXISTS"
  else
    echo "❌ $dir/page.tsx MISSING — needs to be created"
  fi
done
```

For any MISSING page.tsx, create a minimal working version.
Here are the minimal versions for each:

**app/cfo/page.tsx** — if missing:
```tsx
"use client"
import { useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || ""

export default function CFOPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [error, setError] = useState("")

  async function generate() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${API}/api/cfo/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_demo: true })
      })
      const data = await res.json()
      setReport(data)
    } catch (e) {
      setError("Error connecting to backend")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 400, color: "#f0f0ee" }}>
            AI CFO Report
          </h1>
          <p style={{ fontSize: 12, color: "#8b8b8b", marginTop: 4 }}>
            Cash flow forecasting + executive narrative in Spanish
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            padding: "8px 18px", background: "#4ade80", color: "#0d2818",
            border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Analizando..." : "Generate CFO report"}
        </button>
      </div>

      {error && (
        <div style={{ padding: 16, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, color: "#f87171", marginBottom: 20 }}>
          {error}
        </div>
      )}

      {!report && !loading && (
        <div style={{
          background: "#161616", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10, padding: "80px 40px", textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>↗</div>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#f0f0ee" }}>Your CFO is ready to analyze</p>
          <p style={{ fontSize: 12, color: "#8b8b8b", marginTop: 4 }}>
            Click on "Generate CFO report" to get the forecast
          </p>
        </div>
      )}

      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: "Ingresos medios/mes", value: `€${(report.summary?.avg_monthly_income || 0).toLocaleString("es-ES")}` },
              { label: "Gastos medios/mes", value: `€${(report.summary?.avg_monthly_expense || 0).toLocaleString("es-ES")}` },
              { label: "Riesgo cashflow", value: report.cashflow_risk || "—" },
            ].map(s => (
              <div key={s.label} style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ fontSize: 10, color: "#4a4a4a", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 400, color: "#f0f0ee" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Narrative */}
          {report.narrative_es && (
            <div style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "24px 28px" }}>
              <div style={{ borderLeft: "2px solid #4ade80", paddingLeft: 20 }}>
                <div style={{ fontSize: 10, color: "#4a4a4a", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>
                  Análisis generado por IA
                </div>
                <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, color: "#f0f0ee", lineHeight: 1.8 }}>
                  {report.narrative_es}
                </p>
                <div style={{ fontSize: 10, color: "#4a4a4a", marginTop: 12 }}>claude-sonnet · {new Date().toLocaleDateString("es-ES")}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**app/chat/page.tsx** — if missing:
```tsx
"use client"
import { useState, useRef, useEffect } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || ""

interface Message {
  role: "user" | "assistant"
  content: string
  tools_called?: { tool: string; result_preview: string }[]
}

const SUGGESTED = [
  "¿Cuánto IVA debo declarar este trimestre?",
  "¿Cuáles son mis gastos de software este año?",
  "Si facturo 5.000€, ¿cuánto me queda neto?",
  "Resume mi situación financiera del Q1",
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function send(text?: string) {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput("")
    const userMsg: Message = { role: "user", content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history })
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response || "No response",
        tools_called: data.tools_called || []
      }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error conectando con el backend." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "32px 40px 0" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 400, color: "#f0f0ee" }}>
          Asistente IA
        </h1>
        <p style={{ fontSize: 12, color: "#8b8b8b", marginTop: 4 }}>
          Tu asesor financiero con acceso real a tu ledger
        </p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
            {SUGGESTED.map(s => (
              <button key={s} onClick={() => send(s)} style={{
                padding: "8px 14px", background: "#161616",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: 99,
                color: "#8b8b8b", fontSize: 12, cursor: "pointer",
              }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            {/* Tool calls */}
            {m.tools_called?.map((tc, j) => (
              <div key={j} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "8px 12px", margin: "4px 0",
                background: "rgba(129,140,248,0.06)",
                borderLeft: "2px solid #818cf8", borderRadius: "0 6px 6px 0",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", marginTop: 5, flexShrink: 0 }} />
                <div>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#818cf8" }}>{tc.tool}</span>
                  {tc.result_preview && <div style={{ fontSize: 11, color: "#8b8b8b", marginTop: 2 }}>{tc.result_preview}</div>}
                </div>
              </div>
            ))}

            {/* Message bubble */}
            <div style={{
              display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "75%", padding: "10px 14px",
                background: m.role === "user" ? "#1f1f1f" : "transparent",
                border: m.role === "user" ? "1px solid rgba(255,255,255,0.06)" : "none",
                borderRadius: 10,
                fontFamily: m.role === "assistant" ? "'Playfair Display', Georgia, serif" : "Inter, sans-serif",
                fontSize: m.role === "assistant" ? 15 : 13,
                color: "#f0f0ee", lineHeight: 1.7,
              }}>
                {m.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 4, padding: "8px 0" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: "50%", background: "#4ade80",
                animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "16px 0 24px",
        display: "flex", gap: 10,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Pregunta sobre tus finanzas..."
          style={{
            flex: 1, padding: "10px 14px",
            background: "#161616", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8, color: "#f0f0ee", fontSize: 13,
            outline: "none", fontFamily: "Inter, sans-serif",
          }}
        />
        <button onClick={() => send()} disabled={loading} style={{
          padding: "10px 18px", background: "#4ade80", color: "#0d2818",
          border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
        }}>
          Enviar
        </button>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}
```

**app/compliance/page.tsx** — if missing:
```tsx
"use client"
import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"

const API = process.env.NEXT_PUBLIC_API_URL || ""

export default function CompliancePage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [error, setError] = useState("")

  const onDrop = useCallback((files: File[]) => { if (files[0]) setFile(files[0]) }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "application/pdf": [], "image/*": [] }, maxFiles: 1 })

  async function analyze() {
    if (!file) return
    setLoading(true)
    setError("")
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`${API}/api/compliance/check`, { method: "POST", body: form })
      const data = await res.json()
      setReport(data)
    } catch {
      setError("Error connecting to backend")
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = !report ? "#8b8b8b" : report.compliance_score >= 90 ? "#4ade80" : report.compliance_score >= 70 ? "#fbbf24" : "#f87171"

  return (
    <div style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 400, color: "#f0f0ee" }}>VeriFactu</h1>
          <p style={{ fontSize: 12, color: "#8b8b8b", marginTop: 4 }}>Comprobador de cumplimiento VeriFactu 2025</p>
        </div>
        {file && !loading && (
          <button onClick={analyze} style={{ padding: "8px 18px", background: "#4ade80", color: "#0d2818", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Analizar factura
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: report ? "1fr 1fr" : "1fr", gap: 20 }}>
        {/* Upload */}
        <div>
          <div {...getRootProps()} style={{
            border: `1px dashed ${isDragActive ? "#4ade80" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 10, padding: "48px 32px", textAlign: "center",
            background: isDragActive ? "rgba(74,222,128,0.04)" : "#161616",
            cursor: "pointer", transition: "all 0.15s ease",
          }}>
            <input {...getInputProps()} />
            <div style={{ fontSize: 13, color: "#8b8b8b", marginBottom: 4 }}>
              {file ? `✓ ${file.name}` : "Arrastra tu factura aquí"}
            </div>
            <div style={{ fontSize: 11, color: "#4a4a4a" }}>PDF, JPG, PNG — máx 10MB</div>
          </div>
          {loading && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#8b8b8b" }}>
              Analizando con IA...
            </div>
          )}
          {error && <div style={{ marginTop: 12, color: "#f87171", fontSize: 13 }}>{error}</div>}
        </div>

        {/* Report */}
        {report && (
          <div style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "24px 28px" }}>
            {/* Score */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
              <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
                <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
                  <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - report.compliance_score / 100)}`}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, color: "#f0f0ee" }}>
                  {report.compliance_score}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#f0f0ee" }}>{report.status?.replace("_", " ")}</div>
                <div style={{ fontSize: 12, color: "#8b8b8b", marginTop: 2 }}>
                  {report.tool_calls_made} tool calls · {report.violations?.length || 0} violations
                </div>
              </div>
            </div>

            {/* Violations */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(report.violations || []).map((v: any, i: number) => (
                <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.05em",
                      background: v.severity === "error" ? "rgba(248,113,113,0.15)" : "rgba(251,191,36,0.15)",
                      color: v.severity === "error" ? "#f87171" : "#fbbf24",
                    }}>
                      {v.severity?.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#818cf8" }}>{v.field || v.rule_id}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#f0f0ee" }}>{v.description}</div>
                  <div style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>→ {v.fix}</div>
                </div>
              ))}
            </div>

            {/* Download XML */}
            {report.corrected_xml && (
              <button
                onClick={() => {
                  const blob = new Blob([report.corrected_xml], { type: "application/xml" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url; a.download = "factura_corregida.xml"; a.click()
                }}
                style={{ marginTop: 16, width: "100%", padding: "8px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 7, color: "#4ade80", fontSize: 12, cursor: "pointer" }}
              >
                Descargar XML corregido
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

**app/invoices/page.tsx** — if missing:
```tsx
"use client"
import { useEffect, useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"

const API = process.env.NEXT_PUBLIC_API_URL || ""

export default function InvoicesPage() {
  const [ledger, setLedger] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    fetch(`${API}/api/ledger`)
      .then(r => r.json())
      .then(setLedger)
      .finally(() => setLoading(false))
  }, [parsed])

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    setParsing(true)
    const form = new FormData()
    form.append("file", files[0])
    try {
      const res = await fetch(`${API}/api/invoices/parse`, { method: "POST", body: form })
      const data = await res.json()
      setParsed(data)
    } finally {
      setParsing(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "application/pdf": [], "image/*": [] }, maxFiles: 1 })

  const filtered = activeTab === "all" ? ledger : ledger.filter(e => e.tipo === activeTab)

  return (
    <div style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 400, color: "#f0f0ee" }}>Facturas</h1>
        <p style={{ fontSize: 12, color: "#8b8b8b", marginTop: 4 }}>Sube y gestiona tus facturas</p>
      </div>

      {/* Upload */}
      <div {...getRootProps()} style={{
        border: `1px dashed ${isDragActive ? "#4ade80" : "rgba(255,255,255,0.12)"}`,
        borderRadius: 10, padding: "32px", textAlign: "center",
        background: isDragActive ? "rgba(74,222,128,0.04)" : "#161616",
        cursor: "pointer", marginBottom: 24,
      }}>
        <input {...getInputProps()} />
        <div style={{ fontSize: 13, color: "#8b8b8b" }}>{parsing ? "Procesando..." : "Arrastra una factura para procesar"}</div>
        <div style={{ fontSize: 11, color: "#4a4a4a", marginTop: 4 }}>PDF, JPG, PNG</div>
      </div>

      {/* Parsed result */}
      {parsed && (
        <div style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#4ade80", marginBottom: 12 }}>
            ✓ Extraída correctamente
            {parsed.repair_attempted && <span style={{ color: "#fbbf24", marginLeft: 8 }}>· Reparación automática aplicada</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              ["Proveedor", parsed.proveedor_nombre],
              ["Fecha", parsed.fecha_emision],
              ["Base imponible", `€${parsed.base_imponible}`],
              ["IVA", `${parsed.iva_porcentaje}% = €${parsed.iva_cuota}`],
              ["Total", `€${parsed.total}`],
              ["Categoría", parsed.categoria],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: "#4a4a4a", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 13, color: "#f0f0ee" }}>{v || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all","ingreso","gasto"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: "5px 14px", borderRadius: 99, fontSize: 12,
            background: activeTab === t ? "#4ade80" : "rgba(255,255,255,0.06)",
            color: activeTab === t ? "#0d2818" : "#8b8b8b",
            border: "none", cursor: "pointer", fontWeight: activeTab === t ? 500 : 400,
          }}>
            {t === "all" ? "Todos" : t === "ingreso" ? "Ingresos" : "Gastos"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Fecha","Concepto","Contraparte","Tipo","Base","IVA","Total","Estado"].map(c => (
                <th key={c} style={{ padding: "9px 16px", textAlign: c === "Base" || c === "IVA" || c === "Total" ? "right" : "left", fontSize: 10, fontWeight: 500, color: "#4a4a4a", letterSpacing: "0.07em", textTransform: "uppercase" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#4a4a4a", fontSize: 13 }}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#4a4a4a", fontSize: 13 }}>No hay entradas</td></tr>
            ) : filtered.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 1 ? "rgba(255,255,255,0.012)" : "transparent" }}>
                <td style={{ padding: "11px 16px", fontSize: 12, color: "#8b8b8b", fontVariantNumeric: "tabular-nums" }}>{e.fecha}</td>
                <td style={{ padding: "11px 16px", fontSize: 13, color: "#f0f0ee", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.concepto}</td>
                <td style={{ padding: "11px 16px", fontSize: 12, color: "#8b8b8b" }}>{e.contraparte}</td>
                <td style={{ padding: "11px 16px" }}>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 99, background: e.tipo === "ingreso" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: e.tipo === "ingreso" ? "#4ade80" : "#f87171" }}>
                    {e.tipo}
                  </span>
                </td>
                <td style={{ padding: "11px 16px", fontSize: 13, color: "#f0f0ee", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>€{Number(e.base_imponible).toFixed(2)}</td>
                <td style={{ padding: "11px 16px", fontSize: 13, color: "#8b8b8b", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>€{Number(e.iva).toFixed(2)}</td>
                <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 500, color: e.tipo === "ingreso" ? "#4ade80" : "#f87171", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>€{Number(e.total).toFixed(2)}</td>
                <td style={{ padding: "11px 16px" }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: e.estado_pago === "pagado" ? "rgba(74,222,128,0.1)" : e.estado_pago === "vencido" ? "rgba(248,113,113,0.1)" : "rgba(251,191,36,0.1)", color: e.estado_pago === "pagado" ? "#4ade80" : e.estado_pago === "vencido" ? "#f87171" : "#fbbf24" }}>
                    {e.estado_pago}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**app/gmail/page.tsx** — if missing:
```tsx
"use client"
import { useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || ""

export default function GmailPage() {
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<any>(null)

  async function scan() {
    setScanning(true)
    try {
      const res = await fetch(`${API}/api/gmail/scan`, { method: "POST" })
      const data = await res.json()
      setResults(data)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div style={{ padding: "32px 40px" }}>
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 400, color: "#f0f0ee" }}>Gmail</h1>
          <p style={{ fontSize: 12, color: "#8b8b8b", marginTop: 4 }}>Importa facturas desde tu bandeja de entrada</p>
        </div>
        <button onClick={scan} disabled={scanning} style={{ padding: "8px 18px", background: "#4ade80", color: "#0d2818", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: scanning ? "not-allowed" : "pointer", opacity: scanning ? 0.7 : 1 }}>
          {scanning ? "Escaneando..." : "Escanear Gmail"}
        </button>
      </div>

      {!results && (
        <div style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "80px 40px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "center", marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px rgba(74,222,128,0.6)" }} />
            <span style={{ fontSize: 13, color: "#8b8b8b" }}>Gmail (demo) conectado</span>
          </div>
          <p style={{ fontSize: 13, color: "#f0f0ee", fontWeight: 500 }}>Listo para escanear</p>
          <p style={{ fontSize: 12, color: "#8b8b8b", marginTop: 4 }}>Haz clic en "Escanear Gmail" para importar facturas automáticamente</p>
        </div>
      )}

      {results && (
        <div style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#f0f0ee" }}>{results.scanned} facturas encontradas</span>
            <span style={{ fontSize: 12, color: "#4ade80" }}>{results.results?.filter((r: any) => r.status === "saved").length} importadas</span>
          </div>
          {results.results?.map((r: any, i: number) => (
            <div key={i} style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, color: "#f0f0ee" }}>{r.filename}</div>
                <div style={{ fontSize: 11, color: "#8b8b8b", marginTop: 2 }}>{r.status === "saved" ? "Importada correctamente" : r.error}</div>
              </div>
              {r.total && <span style={{ fontSize: 13, fontWeight: 500, color: "#f0f0ee", fontVariantNumeric: "tabular-nums" }}>€{Number(r.total).toFixed(2)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

### Step 2 — Fix the API URL in lib/api.ts

Replace the API_BASE line so it works from the browser via Nginx:

```typescript
// In lib/api.ts — change the first line to:
const API_BASE = typeof window !== "undefined" 
  ? "" // browser: use relative URLs, Nginx routes /api/ to backend
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") // server-side
```

This means browser calls go to `/api/chat` → Nginx routes to backend.
No hardcoded IP needed.

---

### Step 3 — Fix the dashboard page.tsx to use correct API call

In app/page.tsx, the getLedgerSummary call passes a quarter argument.
Make sure lib/api.ts accepts this or change the call to:

```typescript
// Change this line in app/page.tsx:
const [s, l] = await Promise.all([api.getLedgerSummary(), api.getLedger()])
// Remove the "2025-Q1" argument — backend uses most recent quarter now
```

---

### Step 4 — Rebuild and restart

```bash
cd /root/gestor-pro/frontend
npm run build
fuser -k 3000/tcp 2>/dev/null
nohup npm start -- -p 3000 > /tmp/frontend.log 2>&1 &
sleep 10
echo "Done"
```

---

### Step 5 — Install PM2 properly

```bash
npm install -g pm2
pm2 start "npm start -- -p 3000" --name gestor-frontend --cwd /root/gestor-pro/frontend
pm2 save
pm2 startup systemd -u root --hp /root
```

---

## What the fixed app should look like

- Sidebar: dark forest green (#0d2818) with matrix animation
- Main content: near-black (#0f0f0f) background  
- Headings: Playfair Display serif font
- Dashboard: 4 KPI cards with real numbers from the seeded ledger
- All 6 routes working: /, /invoices, /compliance, /cfo, /chat, /gmail
- Data flowing from backend through Nginx to frontend

## DO NOT

- Do not change the backend — it works perfectly
- Do not change the database — it has 21 seeded entries
- Do not install new npm packages unless absolutely required
- Do not change next.config.ts
- Do not touch node_modules


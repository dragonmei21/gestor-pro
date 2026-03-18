"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

interface Summary {
  total_ingresos: number
  total_gastos: number
  iva_a_pagar: number
  beneficio_neto: number
  period: string
}

interface LedgerEntry {
  id: number
  fecha: string
  concepto: string
  contraparte: string
  tipo: string
  total: number
  estado_pago: string
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      api.getLedgerSummary("2025-Q1"),
      api.getLedger(),
    ])
      .then(([s, l]) => {
        setSummary(s)
        setLedger(Array.isArray(l) ? l.slice(0, 8) : [])
      })
      .catch(() => setError("No se puede conectar al backend"))
      .finally(() => setLoading(false))
  }, [])

  const kpis = summary ? [
    { label: "Ingresos Q1", value: `€${summary.total_ingresos?.toLocaleString("es-ES") ?? "—"}`, color: "#4ade80" },
    { label: "Gastos Q1",   value: `€${summary.total_gastos?.toLocaleString("es-ES") ?? "—"}`,   color: "#f87171" },
    { label: "IVA a pagar", value: `€${summary.iva_a_pagar?.toLocaleString("es-ES") ?? "—"}`,    color: "#fbbf24" },
    { label: "Beneficio neto", value: `€${summary.beneficio_neto?.toLocaleString("es-ES") ?? "—"}`, color: "#818cf8" },
  ] : []

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: 24, fontWeight: 400, color: "#f0f0ee", margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 12, color: "#8b8b8b", marginTop: 4 }}>
          Resumen financiero · 2025-Q1
        </p>
      </div>

      {error && (
        <div style={{ padding: 16, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, color: "#f87171", marginBottom: 24, fontSize: 13 }}>
          {error} — asegúrate de que el backend está corriendo en el puerto 8000
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "22px 24px", height: 90 }} />
            ))
          : kpis.map(k => (
              <div key={k.label} style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "22px 24px" }}>
                <div style={{ fontSize: 10, color: "#4a4a4a", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                  {k.label}
                </div>
                <div style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: 26, fontWeight: 400, color: k.color }}>
                  {k.value}
                </div>
              </div>
            ))
        }
      </div>

      {/* Recent Activity */}
      <div style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#f0f0ee" }}>Actividad reciente</span>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#4a4a4a", fontSize: 13 }}>Cargando...</div>
        ) : ledger.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#4a4a4a", fontSize: 13 }}>
            No hay datos. Comprueba la conexión con el backend.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Fecha", "Concepto", "Contraparte", "Total", "Estado"].map((c, i) => (
                  <th key={c} style={{ padding: "9px 20px", textAlign: i >= 3 ? "right" : "left", fontSize: 10, fontWeight: 500, color: "#4a4a4a", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 1 ? "rgba(255,255,255,0.012)" : "transparent" }}>
                  <td style={{ padding: "12px 20px", fontSize: 12, color: "#8b8b8b", fontVariantNumeric: "tabular-nums" }}>{e.fecha}</td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: "#f0f0ee", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.concepto}</td>
                  <td style={{ padding: "12px 20px", fontSize: 12, color: "#8b8b8b" }}>{e.contraparte}</td>
                  <td style={{ padding: "12px 20px", textAlign: "right", fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: e.tipo === "ingreso" ? "#4ade80" : "#f87171" }}>
                    {e.tipo === "ingreso" ? "+" : "-"}€{Math.abs(e.total).toFixed(2)}
                  </td>
                  <td style={{ padding: "12px 20px", textAlign: "right" }}>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 500,
                      background: e.estado_pago === "pagado" ? "rgba(74,222,128,0.12)" : e.estado_pago === "vencido" ? "rgba(248,113,113,0.12)" : "rgba(251,191,36,0.12)",
                      color: e.estado_pago === "pagado" ? "#4ade80" : e.estado_pago === "vencido" ? "#f87171" : "#fbbf24",
                    }}>
                      {e.estado_pago}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

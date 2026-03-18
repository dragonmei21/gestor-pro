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
        setLedger(Array.isArray(l) ? l.slice(0, 20) : [])
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
    <div className="px-10 py-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-normal text-white/90 tracking-wide" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
          Dashboard
        </h1>
        <p className="text-sm text-white/40 mt-1">Resumen financiero · 2025-Q1</p>
      </div>

      {error && (
        <div style={{ padding: 16, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, color: "#f87171", marginBottom: 24, fontSize: 13 }}>
          {error} — asegúrate de que el backend está corriendo en el puerto 8000
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-[#161616] border border-white/10 rounded-2xl p-6 h-[92px]" />
            ))
          : kpis.map(k => (
              <div key={k.label} className="bg-[#161616] border border-white/10 rounded-2xl p-6">
                <div className="text-[10px] text-white/30 tracking-[0.2em] uppercase mb-3">
                  {k.label}
                </div>
                <div className="text-2xl font-normal" style={{ fontFamily: "var(--font-playfair), Georgia, serif", color: k.color }}>
                  {k.value}
                </div>
              </div>
            ))
        }
      </div>

      {/* Recent Activity */}
      <div className="bg-[#161616] border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <span className="text-sm font-medium text-white/90">Actividad reciente</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/40 text-sm">Cargando...</div>
        ) : ledger.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            No hay datos. Comprueba la conexión con el backend.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                {["Fecha", "Concepto", "Contraparte", "Total", "Estado"].map((c, i) => (
                  <th key={c} className={`px-5 py-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-white/30 ${i >= 3 ? "text-right" : "text-left"}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map((e, i) => (
                <tr key={e.id} className={`border-b border-white/5 ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}>
                  <td className="px-5 py-3 text-xs text-white/50 tabular-nums">{e.fecha}</td>
                  <td className="px-5 py-3 text-sm text-white/90 max-w-[260px] truncate">{e.concepto}</td>
                  <td className="px-5 py-3 text-xs text-white/50">{e.contraparte}</td>
                  <td className={`px-5 py-3 text-right text-sm font-medium tabular-nums ${e.tipo === "ingreso" ? "text-emerald-300" : "text-rose-300"}`}>
                    {e.tipo === "ingreso" ? "+" : "-"}€{Math.abs(e.total).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                      e.estado_pago === "pagado"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : e.estado_pago === "vencido"
                        ? "bg-rose-500/15 text-rose-200"
                        : "bg-amber-500/15 text-amber-200"
                    }`}>
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

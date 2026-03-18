"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { CFOReport } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import ReactMarkdown from "react-markdown"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts"
import { TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"

const COLORS = { ingresos: "#0FA876", gastos: "#E8593C", neto: "#6366f1" }

export default function CFOPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<CFOReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCFOReport()
      setReport(data)
    } catch {
      setError("Error generando el informe CFO. Verifica que el servidor esté activo.")
    } finally {
      setLoading(false)
    }
  }

  const chartData = report ? [...report.historical, ...report.forecast] : []

  const riskColor = !report ? "" : report.cashflow_risk === "low" ? "text-emerald-600" : report.cashflow_risk === "medium" ? "text-amber-500" : "text-red-500"
  const riskLabel = !report ? "" : report.cashflow_risk === "low" ? "Riesgo bajo" : report.cashflow_risk === "medium" ? "Riesgo medio" : "Riesgo alto"

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI CFO Report</h2>
          <p className="text-sm text-gray-500 mt-1">Previsión de tesorería + narrativa ejecutiva en español</p>
        </div>
        {!report && (
          <Button onClick={loadReport} disabled={loading} className="bg-[#0FA876] hover:bg-[#0FA876]/90 text-white">
            {loading ? "Analizando datos..." : "Generar informe CFO"}
          </Button>
        )}
      </div>

      {!report && !loading && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-16 text-center">
            <TrendingUp className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Tu CFO está listo para analizar</p>
            <p className="text-sm text-gray-400 mt-1">Haz clic en &quot;Generar informe CFO&quot; para obtener la previsión</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm"><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Ingresos Q1", value: `€${report.total_ingresos?.toLocaleString("es-ES") ?? "—"}`, color: "text-emerald-600" },
              { label: "Gastos Q1", value: `€${report.total_gastos?.toLocaleString("es-ES") ?? "—"}`, color: "text-red-500" },
              { label: "Beneficio neto", value: `€${report.beneficio_neto?.toLocaleString("es-ES") ?? "—"}`, color: "text-blue-600" },
              { label: "IVA a pagar", value: `€${report.iva_a_pagar?.toLocaleString("es-ES") ?? "—"}`, color: "text-amber-600" },
            ].map((k) => (
              <Card key={k.label} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">Tesorería — Histórico + Previsión</CardTitle>
                <Badge className={`${riskColor} bg-transparent border`}>{riskLabel}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ingGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.ingresos} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.ingresos} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.gastos} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.gastos} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v.toLocaleString()}`} />
                  <Tooltip formatter={(v) => typeof v === "number" ? `€${v.toLocaleString("es-ES")}` : v} />
                  <Legend />
                  <ReferenceLine x={report.historical[report.historical.length - 1]?.mes} strokeDasharray="4 4" stroke="#ccc" label={{ value: "Hoy", fontSize: 10 }} />
                  <Area type="monotone" dataKey="ingresos" stroke={COLORS.ingresos} fill="url(#ingGrad)" strokeWidth={2} name="Ingresos" />
                  <Area type="monotone" dataKey="gastos" stroke={COLORS.gastos} fill="url(#gasGrad)" strokeWidth={2} name="Gastos" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Narrative */}
          <Card className="border-0 shadow-sm border-l-4 border-l-[#0FA876]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Informe ejecutivo CFO</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-gray-700">
                <ReactMarkdown>{report.narrative_es}</ReactMarkdown>
              </div>
              <p className="text-xs text-gray-400 mt-4">Generado por gpt-4o · Gestor Pro CFO Engine</p>
            </CardContent>
          </Card>

          {/* Risk flags + action items */}
          {(report.risk_flags.length > 0 || report.action_items.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.risk_flags.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Alertas de riesgo</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {report.risk_flags.map((f, i) => <p key={i} className="text-sm text-gray-600">• {f}</p>)}
                  </CardContent>
                </Card>
              )}
              {report.action_items.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-emerald-600 flex items-center gap-2"><CheckCircle className="w-4 h-4" />Acciones recomendadas</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {report.action_items.map((a, i) => <p key={i} className="text-sm text-gray-600">✓ {a}</p>)}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Button variant="outline" onClick={() => { setReport(null) }} className="w-full">Generar nuevo informe</Button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-500 text-center">{error}</p>}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { LedgerEntry } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, AlertCircle, ShieldCheck } from "lucide-react"

interface Summary {
  total_ingresos: number
  total_gastos: number
  iva_a_pagar: number
  beneficio_neto: number
  period: string
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getLedgerSummary("2025-Q1"), api.getLedger()])
      .then(([s, l]) => {
        setSummary(s)
        setLedger(l.slice(0, 5))
      })
      .finally(() => setLoading(false))
  }, [])

  const kpis = summary
    ? [
        {
          title: "Ingresos Q1",
          value: `€${summary.total_ingresos.toLocaleString("es-ES", { minimumFractionDigits: 0 })}`,
          delta: "2025-Q1",
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          icon: TrendingUp,
        },
        {
          title: "Gastos Q1",
          value: `€${summary.total_gastos.toLocaleString("es-ES", { minimumFractionDigits: 0 })}`,
          delta: "2025-Q1",
          color: "text-red-500",
          bg: "bg-red-50",
          icon: TrendingDown,
        },
        {
          title: "IVA a pagar",
          value: `€${summary.iva_a_pagar.toLocaleString("es-ES", { minimumFractionDigits: 0 })}`,
          delta: "Vence 20 Abr",
          color: "text-amber-600",
          bg: "bg-amber-50",
          icon: AlertCircle,
        },
        {
          title: "Beneficio neto",
          value: `€${summary.beneficio_neto.toLocaleString("es-ES", { minimumFractionDigits: 0 })}`,
          delta: "2025-Q1",
          color: "text-blue-600",
          bg: "bg-blue-50",
          icon: ShieldCheck,
        },
      ]
    : []

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#f0f0ee]">Dashboard</h2>
        <p className="text-sm text-[#8b8b8b] mt-1">Resumen financiero · 2025-Q1</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          : kpis.map((kpi) => (
              <Card key={kpi.title} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">{kpi.title}</p>
                      <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                      <p className="text-xs text-gray-400 mt-1">{kpi.delta}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${kpi.bg}`}>
                      <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[#4a4a4a]">
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Concepto</th>
                  <th className="pb-2 font-medium">Contraparte</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="py-3 text-[#8b8b8b]">{e.fecha}</td>
                    <td className="py-3 font-medium text-[#f0f0ee] max-w-[200px] truncate">{e.concepto}</td>
                    <td className="py-3 text-[#8b8b8b]">{e.contraparte}</td>
                    <td className="py-3 text-right font-mono">
                      <span className={e.tipo === "ingreso" ? "text-emerald-600" : "text-red-500"}>
                        {e.tipo === "ingreso" ? "+" : "-"}€{Math.abs(e.total).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Badge variant={e.estado_pago === "pagado" ? "default" : e.estado_pago === "vencido" ? "destructive" : "secondary"}
                        className="text-xs">
                        {e.estado_pago}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

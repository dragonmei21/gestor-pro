"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { AppLayout } from "@/components/AppLayout"
import { KPICards } from "@/components/dashboard/KPICards"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { MCPInsights } from "@/components/dashboard/MCPInsights"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { ReceivablesPivot } from "@/components/dashboard/ReceivablesPivot"

type Summary = {
  total_ingresos: number
  total_gastos: number
  iva_a_pagar: number
  beneficio_neto: number
}

type LedgerEntry = {
  id: number
  fecha: string
  concepto: string
  contraparte: string
  tipo: string
  total: number
  estado_pago: string
}

const Dashboard = () => {
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

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-[32px] font-normal tracking-tight text-white/90" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
            Overview
          </h1>
          <p className="mt-1 text-sm text-white/40">
            Financial integrity, automated.
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-sm">
            {error} — asegúrate de que el backend está corriendo en el puerto 8000
          </div>
        )}

        <KPICards summary={summary} loading={loading} />

        <ReceivablesPivot ledger={ledger} loading={loading} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <RecentActivity ledger={ledger} loading={loading} />
          </div>
          <div className="space-y-6">
            <MCPInsights />
            <QuickActions />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;

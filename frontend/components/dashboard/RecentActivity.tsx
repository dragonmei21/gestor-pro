"use client"

type LedgerEntry = {
  id: number
  fecha: string
  concepto: string
  contraparte: string
  tipo: string
  total: number
  estado_pago: string
}

export function RecentActivity({ ledger, loading }: { ledger: LedgerEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-[#14191d] border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <span className="text-sm font-medium text-white/90">Recent activity</span>
        </div>
        <div className="p-8 text-center text-white/40 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="bg-[#14191d] border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10">
        <span className="text-sm font-medium text-white/90">Recent activity</span>
      </div>
      {ledger.length === 0 ? (
        <div className="p-8 text-center text-white/40 text-sm">
          No data available. Check backend connectivity.
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              {["Date", "Concept", "Counterpart", "Total", "State"].map((c, i) => (
                <th key={c} className={`px-6 py-2 text-[10px] font-semibold tracking-[0.18em] uppercase text-white/40 ${i >= 3 ? "text-right" : "text-left"}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((e, i) => (
              <tr key={e.id} className={`border-b border-white/5 ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}>
                <td className="px-6 py-3 text-xs text-white/50 tabular-nums">{e.fecha}</td>
                <td className="px-6 py-3 text-sm text-white/90 max-w-[360px] truncate">{e.concepto}</td>
                <td className="px-6 py-3 text-xs text-white/50">{e.contraparte}</td>
                <td className={`px-6 py-3 text-right text-sm font-medium tabular-nums ${e.tipo === "ingreso" ? "text-emerald-300" : "text-rose-300"}`}>
                  {e.tipo === "ingreso" ? "+" : "-"}€{Math.abs(e.total).toFixed(2)}
                </td>
                <td className="px-6 py-3 text-right">
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
  )
}

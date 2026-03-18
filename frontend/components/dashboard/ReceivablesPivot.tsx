"use client"

type LedgerEntry = {
  tipo: string
  total: number
  estado_pago: string
}

export function ReceivablesPivot({ ledger, loading }: { ledger: LedgerEntry[]; loading: boolean }) {
  const receivables = ledger.filter((e) => e.tipo === "ingreso" && e.estado_pago !== "pagado")
  const payables = ledger.filter((e) => e.tipo === "gasto" && e.estado_pago !== "pagado")
  const recTotal = receivables.reduce((s, e) => s + Math.abs(e.total), 0)
  const payTotal = payables.reduce((s, e) => s + Math.abs(e.total), 0)
  const max = Math.max(recTotal, payTotal, 1)

  return (
    <div className="bg-[#14191d] border border-white/10 rounded-2xl p-6">
      <div className="text-[10px] text-white/40 tracking-[0.18em] uppercase mb-3">
        CASH POSITION
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-white/50">Receivables</div>
          <div className="text-xl text-emerald-300 mt-1" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
            {loading ? "—" : `€${recTotal.toLocaleString("es-ES")}`}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Unpaid income</div>
        </div>
        <div>
          <div className="text-xs text-white/50">Payables</div>
          <div className="text-xl text-rose-300 mt-1" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
            {loading ? "—" : `€${payTotal.toLocaleString("es-ES")}`}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Unpaid expenses</div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-[11px] text-white/50 mb-2">
            <span>Receivables</span>
            <span>{loading ? "—" : `${Math.round((recTotal / max) * 100)}%`}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-emerald-400/70" style={{ width: `${(recTotal / max) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-white/50 mb-2">
            <span>Payables</span>
            <span>{loading ? "—" : `${Math.round((payTotal / max) * 100)}%`}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-rose-400/70" style={{ width: `${(payTotal / max) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

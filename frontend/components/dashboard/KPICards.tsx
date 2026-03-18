"use client"

type Summary = {
  total_ingresos: number
  total_gastos: number
  iva_a_pagar: number
  beneficio_neto: number
}

export function KPICards({ summary, loading }: { summary: Summary | null; loading: boolean }) {
  const kpis = summary ? [
    { label: "Revenue (Q1)", value: `€${summary.total_ingresos?.toLocaleString("es-ES") ?? "—"}`, color: "text-emerald-300" },
    { label: "Expenses (Q1)", value: `€${summary.total_gastos?.toLocaleString("es-ES") ?? "—"}`, color: "text-rose-300" },
    { label: "VAT Payable", value: `€${summary.iva_a_pagar?.toLocaleString("es-ES") ?? "—"}`, color: "text-amber-300" },
    { label: "Net Profit", value: `€${summary.beneficio_neto?.toLocaleString("es-ES") ?? "—"}`, color: "text-sky-300" },
  ] : []

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      {loading
        ? Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-[#14191d] border border-white/10 rounded-2xl p-6 h-[98px]" />
          ))
        : kpis.map((k) => (
            <div key={k.label} className="bg-[#14191d] border border-white/10 rounded-2xl p-6">
              <div className="text-[10px] text-white/40 tracking-[0.18em] uppercase mb-3">
                {k.label}
              </div>
              <div className={`text-2xl font-normal ${k.color}`} style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
                {k.value}
              </div>
            </div>
          ))}
    </div>
  )
}

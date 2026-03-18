"use client"

export function QuickActions() {
  const actions = [
    { label: "Upload invoices (OCR)", sub: "Extract fields automatically" },
    { label: "Run compliance check", sub: "VeriFactu validation" },
    { label: "Ask the assistant", sub: "Natural language queries" },
    { label: "Search invoices", sub: "Vendor, date, amount" },
  ]

  return (
    <div className="bg-[#14191d] border border-white/10 rounded-2xl p-6">
      <div className="text-[10px] text-white/40 tracking-[0.18em] uppercase mb-3">
        QUICK ACTIONS
      </div>
      <div className="space-y-3">
        {actions.map((a) => (
          <button
            key={a.label}
            className="w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className="text-sm text-white/90">{a.label}</div>
            <div className="text-xs text-white/50 mt-1">{a.sub}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

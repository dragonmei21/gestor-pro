"use client"

export function MCPInsights() {
  return (
    <div className="bg-[#14191d] border border-white/10 rounded-2xl p-6">
      <div className="text-[10px] text-white/40 tracking-[0.18em] uppercase mb-3">
        MCP INSIGHTS
      </div>
      <h3 className="text-base font-semibold text-white/90 mb-2">Automation + Intelligence</h3>
      <p className="text-sm text-white/50 mb-4">
        Your MCP server orchestrates tools that search invoices, extract OCR data, and answer complex financial questions.
      </p>
      <ul className="text-sm text-white/70 space-y-2">
        <li>• OCR extraction from uploaded invoices</li>
        <li>• Invoice search by vendor, date, amount</li>
        <li>• Real‑time accounting Q&A in chat</li>
        <li>• VeriFactu compliance checks</li>
      </ul>
    </div>
  )
}

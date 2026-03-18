const API_BASE = typeof window !== "undefined"
  ? ""  // browser: relative URLs, Nginx proxies /api/ → backend
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")

export const api = {
  async parseInvoice(file: File) {
    const form = new FormData()
    form.append("file", file)
    const res = await fetch(`${API_BASE}/api/invoices/parse`, { method: "POST", body: form })
    return res.json()
  },

  async checkCompliance(file: File) {
    const form = new FormData()
    form.append("file", file)
    const res = await fetch(`${API_BASE}/api/compliance/check`, { method: "POST", body: form })
    return res.json()
  },

  async getCFOReport(file?: File) {
    const form = new FormData()
    if (file) form.append("file", file)
    form.append("use_demo", file ? "false" : "true")
    const res = await fetch(`${API_BASE}/api/cfo/report`, { method: "POST", body: form })
    return res.json()
  },

  async sendMessage(message: string, history: { role: string; content: string }[]) {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    })
    return res.json()
  },

  async getLedger() {
    return fetch(`${API_BASE}/api/ledger`).then((r) => r.json())
  },

  async getLedgerSummary(quarter?: string) {
    const url = quarter
      ? `${API_BASE}/api/ledger/summary?quarter=${quarter}`
      : `${API_BASE}/api/ledger/summary`
    return fetch(url).then((r) => r.json())
  },

  async gmailStatus() {
    return fetch(`${API_BASE}/api/gmail/status`).then((r) => r.json())
  },

  async gmailScan() {
    return fetch(`${API_BASE}/api/gmail/scan`, { method: "POST" }).then((r) => r.json())
  },
}

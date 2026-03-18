"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mail, RefreshCw, CheckCircle, FileText } from "lucide-react"

interface ScanResult {
  filename: string
  status: string
  total?: number
  concepto?: string
  error?: string
}

export default function GmailPage() {
  const [connected, setConnected] = useState(false)
  const [demoMode, setDemoMode] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<ScanResult[]>([])
  const [scanned, setScanned] = useState<number | null>(null)

  useEffect(() => {
    api.gmailStatus().then((s) => {
      setConnected(s.connected)
      setDemoMode(s.demo_mode)
    })
  }, [])

  const scan = async () => {
    setScanning(true)
    try {
      const data = await api.gmailScan()
      setResults(data.results)
      setScanned(data.scanned)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gmail Integration</h2>
          <p className="text-sm text-gray-500 mt-1">Detecta facturas en tu bandeja y las importa automáticamente</p>
        </div>
        <div className="flex items-center gap-2">
          {demoMode && <Badge variant="secondary">Modo demo</Badge>}
          <Badge variant={connected ? "default" : "secondary"} className={connected ? "bg-emerald-500" : ""}>
            {connected ? "● Conectado" : "○ Desconectado"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Mail className="w-4 h-4" />Escanear bandeja</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              {demoMode
                ? "En modo demo se cargan 3 facturas simuladas (AWS, Renfe, Adobe) sin necesidad de OAuth."
                : "Escanea los últimos mensajes con adjuntos PDF o imagen."}
            </p>
            <Button onClick={scan} disabled={scanning} className="w-full bg-[#0FA876] hover:bg-[#0FA876]/90 text-white gap-2">
              <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Escaneando..." : "Escanear Gmail ahora"}
            </Button>

            {scanned !== null && (
              <p className="mt-3 text-sm text-center text-gray-500">
                {scanned} adjunto{scanned !== 1 ? "s" : ""} encontrado{scanned !== 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-sm font-semibold text-gray-700">Facturas importadas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  {r.status === "saved"
                    ? <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    : <FileText className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{r.filename}</p>
                    {r.concepto && <p className="text-xs text-gray-500 truncate">{r.concepto}</p>}
                    {r.total && <p className="text-xs font-mono text-gray-600 mt-0.5">€{r.total.toFixed(2)}</p>}
                    {r.error && <p className="text-xs text-red-500">{r.error}</p>}
                  </div>
                  <Badge variant={r.status === "saved" ? "default" : "destructive"} className="text-xs shrink-0">
                    {r.status === "saved" ? "guardado" : "error"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

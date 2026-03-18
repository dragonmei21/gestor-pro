"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { api } from "@/lib/api"
import { ComplianceReport } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Upload, FileText, AlertTriangle, XCircle, Download, Wrench } from "lucide-react"

type Status = "idle" | "uploading" | "done" | "error"

export default function CompliancePage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png"] },
    maxFiles: 1,
  })

  const analyze = async () => {
    if (!file) return
    setStatus("uploading")
    setError(null)
    try {
      const result = await api.checkCompliance(file)
      setReport(result)
      setStatus("done")
    } catch {
      setError("Error analizando la factura. Intenta de nuevo.")
      setStatus("error")
    }
  }

  const downloadXml = () => {
    if (!report?.corrected_xml) return
    const blob = new Blob([report.corrected_xml], { type: "application/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "factura_verifactu.xml"
    a.click()
    URL.revokeObjectURL(url)
  }

  const scoreColor = !report ? "" : report.compliance_score >= 90 ? "text-emerald-600" : report.compliance_score >= 70 ? "text-amber-500" : "text-red-500"
  const scoreBg = !report ? "" : report.compliance_score >= 90 ? "bg-emerald-50 border-emerald-200" : report.compliance_score >= 70 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">VeriFactu Compliance Copilot</h2>
        <p className="text-sm text-gray-500 mt-1">Sube una factura y detectamos violaciones VeriFactu 2025 al instante</p>
      </div>

      {/* Pipeline explanation */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        {[
          { n: "1", label: "Upload invoice" },
          { n: "2", label: "LLM extraction" },
          { n: "3", label: "Rules validation" },
          { n: "4", label: "Auto-repair" },
          { n: "5", label: "XML generation" },
        ].map((step, i, arr) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#4ade80" }}>
                {step.n}
              </div>
              <span style={{ fontSize: 11, color: "#7a9e7a", whiteSpace: "nowrap" }}>{step.label}</span>
            </div>
            {i < arr.length - 1 && <div style={{ width: 20, height: 1, background: "rgba(74,222,128,0.2)" }} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upload */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                  ${isDragActive ? "border-[#0FA876] bg-[#0FA876]/5" : "border-gray-200 hover:border-[#0FA876]/50"}`}
              >
                <input {...getInputProps()} />
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                {file ? (
                  <div>
                    <p className="font-medium text-gray-800 flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4 text-[#0FA876]" /> {file.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-500 font-medium">Arrastra tu factura aquí</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG · máx 10MB</p>
                  </div>
                )}
              </div>

              {file && (
                <Button
                  onClick={analyze}
                  disabled={status === "uploading"}
                  className="w-full mt-4 bg-[#0FA876] hover:bg-[#0FA876]/90 text-white"
                >
                  {status === "uploading" ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⟳</span> Analizando con IA...
                    </span>
                  ) : "Analizar factura"}
                </Button>
              )}

              {error && (
                <p className="mt-3 text-sm text-red-500 text-center">{error}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Report */}
        {report && (
          <div className="space-y-4">
            {/* Score */}
            <Card className={`border shadow-sm ${scoreBg}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Puntuación VeriFactu</p>
                    <p className={`text-5xl font-bold mt-1 ${scoreColor}`}>{report.compliance_score}<span className="text-xl">/100</span></p>
                    <Badge className="mt-2" variant={report.status === "compliant" ? "default" : "destructive"}>
                      {report.status === "compliant" ? "✓ Conforme" : report.status === "minor_violations" ? "⚠ Avisos menores" : "✗ Violaciones graves"}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Procesado en</p>
                    <p className="text-sm font-mono text-gray-600">{report.processing_time_ms}ms</p>
                    <div className="mt-2 flex items-center gap-1 justify-end text-xs text-gray-400">
                      <Wrench className="w-3 h-3" />
                      {report.tool_calls_made} tool calls
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Violations */}
            {report.violations.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Violaciones detectadas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {report.violations.map((v, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        {v.severity === "error"
                          ? <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                        <Badge variant={v.severity === "error" ? "destructive" : "secondary"} className="text-xs">
                          {v.rule_id}
                        </Badge>
                        <code className="text-xs text-gray-500">{v.field}</code>
                      </div>
                      <p className="text-sm text-gray-700">{v.description}</p>
                      <p className="text-xs mt-2 px-2 py-1.5 bg-emerald-50 text-emerald-700 rounded">
                        ✓ Fix: {v.fix}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Narrative */}
            <Card className="border-0 shadow-sm border-l-4 border-l-[#0FA876]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Análisis del agente</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{report.agent_narrative}</p>
              </CardContent>
            </Card>

            {/* Download XML */}
            {report.corrected_xml && (
              <Button onClick={downloadXml} variant="outline" className="w-full gap-2">
                <Download className="w-4 h-4" /> Descargar XML corregido (VeriFactu 1.0)
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import { ChatMessage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Send, Wrench, MessageSquare } from "lucide-react"
import ReactMarkdown from "react-markdown"

const SUGGESTED = [
  "¿Cuánto IVA debo declarar este trimestre?",
  "¿Cuáles son mis gastos de software este año?",
  "Si facturo 5.000€, ¿cuánto me queda neto?",
  "¿Qué facturas tengo pendientes de cobro?",
  "Resume mi situación financiera del Q1",
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: "user", content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const result = await api.sendMessage(text, history)
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.response,
        tools_called: result.tools_called,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Lo siento, ha ocurrido un error. Inténtalo de nuevo." },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b bg-white">
        <h2 className="text-xl font-bold text-gray-900">Asistente Financiero</h2>
        <p className="text-sm text-gray-500 mt-0.5">Con acceso en tiempo real a tu contabilidad · Powered by GPT-4o + MCP</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium mb-6">¿En qué te puedo ayudar?</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-sm px-3 py-2 rounded-full border border-gray-200 text-gray-600 hover:border-[#0FA876] hover:text-[#0FA876] transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx}>
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-[#0FA876] text-white"
                    : "bg-white border border-gray-100 shadow-sm text-gray-800"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>

            {/* Tool call visualization */}
            {msg.tools_called && msg.tools_called.length > 0 && (
              <div className="mt-2 space-y-1 ml-2">
                {msg.tools_called.map((tc, ti) => (
                  <div
                    key={ti}
                    className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg border-l-2 border-[#0FA876] max-w-[75%]"
                  >
                    <Wrench className="w-3 h-3 text-[#0FA876] mt-0.5 shrink-0" />
                    <div>
                      <code className="text-xs font-mono text-[#0FA876]">{tc.tool}</code>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono break-all">
                        {tc.result_preview.slice(0, 120)}…
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-8 py-4 border-t bg-white">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Pregunta sobre tu contabilidad..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0FA876] focus:ring-1 focus:ring-[#0FA876]"
            disabled={loading}
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="bg-[#0FA876] hover:bg-[#0FA876]/90 text-white px-4 rounded-xl"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

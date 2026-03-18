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
      <div className="px-12 py-6 border-b border-white/10 bg-[#0f1214]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-white/90">Financial Assistant</h2>
          <p className="text-sm text-white/50 mt-1">Real‑time access to your accounting · Powered by GPT‑4o + MCP</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-12 py-8 space-y-6 bg-[#0f1214]">
        <div className="max-w-5xl mx-auto space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 font-medium mb-6">How can I help?</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-sm px-3 py-2 rounded-full border border-white/10 text-white/60 hover:border-white/30 hover:text-white transition-colors text-left bg-white/5"
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
                className={`max-w-[70%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-white/10 border border-white/15 text-white"
                    : "bg-[#14191d] border border-white/10 text-white/80"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none">
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
                    className="flex items-start gap-2 px-3 py-2 bg-white/5 rounded-lg border-l-2 border-emerald-400/70 max-w-[75%]"
                  >
                    <Wrench className="w-3 h-3 text-emerald-300 mt-0.5 shrink-0" />
                    <div>
                      <code className="text-xs font-mono text-emerald-200">{tc.tool}</code>
                      <p className="text-xs text-white/50 mt-0.5 font-mono break-all">
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
            <div className="bg-[#14191d] border border-white/10 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-12 py-6 border-t border-white/10 bg-[#0f1214]">
        <div className="max-w-5xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask about your accounting…"
            className="flex-1 px-5 py-4 rounded-2xl border border-white/10 bg-[#0b0f14] text-base text-white/80 placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10"
            disabled={loading}
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="bg-white text-black hover:bg-white/90 px-6 rounded-2xl text-base"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

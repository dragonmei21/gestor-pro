import type { Metadata } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import "./globals.css"
import Link from "next/link"
import {
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  Receipt,
  MessageSquare,
  Mail,
} from "lucide-react"

const inter = Inter({ subsets: ["latin"] })
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" })

export const metadata: Metadata = {
  title: "Gestor Pro",
  description: "AI-powered financial platform for Spanish autónomos",
}

const NAV_ITEMS = [
  { href: "/",           icon: LayoutDashboard, label: "Dashboard" },
  { href: "/compliance", icon: ShieldCheck,     label: "VeriFactu" },
  { href: "/cfo",        icon: TrendingUp,      label: "CFO Report" },
  { href: "/invoices",   icon: Receipt,         label: "Facturas" },
  { href: "/chat",       icon: MessageSquare,   label: "Asistente" },
  { href: "/gmail",      icon: Mail,            label: "Gmail" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

  return (
    <html lang="es">
      <body className={`${inter.className} ${playfair.variable}`}>
        {isDemo && (
          <div className="bg-[#0f1316] border-b border-white/10 px-6 py-2 text-xs text-white/60 flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            <span>Modo demo — usando datos de ejemplo. Sube tus propias facturas para análisis real.</span>
          </div>
        )}
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 flex flex-col shrink-0" style={{ background: "#0d1f0d", borderRight: "1px solid rgba(74,222,128,0.1)" }}>
            <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(74,222,128,0.1)" }}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}>
                  <span style={{ color: "#4ade80", fontSize: 12, fontWeight: 600 }}>✓</span>
                </div>
                <div>
                  <h1 style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.02em", color: "#e8f5e8", fontFamily: "'Inter', system-ui, sans-serif" }}>Gestor Pro</h1>
                  <p style={{ fontSize: 11, color: "#3d5c3d" }}>AI Financial Platform</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-4 py-5 space-y-1.5">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="sidebar-nav-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0 sidebar-nav-icon" />
                  <span className="tracking-wide">{label}</span>
                </Link>
              ))}
            </nav>
            <div className="px-6 py-4" style={{ borderTop: "1px solid rgba(74,222,128,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
                <p style={{ fontSize: 11, color: "#3d5c3d" }}>Autónomo demo</p>
              </div>
              <p style={{ fontSize: 12, color: "#7a9e7a" }}>NIF: 12345678A</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto" style={{ background: "#0a0f0a" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

import type { Metadata } from "next"
import { Inter } from "next/font/google"
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
      <body className={inter.className}>
        {isDemo && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
            <span>⚡</span>
            <span>Modo demo — usando datos de ejemplo. Sube tus propias facturas para análisis real.</span>
          </div>
        )}
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-56 bg-[#0a1628] text-white flex flex-col shrink-0">
            <div className="px-6 py-5 border-b border-white/10">
              <h1 className="text-xl font-bold text-[#0FA876]">Gestor Pro</h1>
              <p className="text-xs text-white/40 mt-0.5">AI Financial Platform</p>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="px-6 py-4 border-t border-white/10">
              <p className="text-xs text-white/30">Demo Autónomo</p>
              <p className="text-xs text-white/20">NIF: 12345678A</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-[#0f0f0f]">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

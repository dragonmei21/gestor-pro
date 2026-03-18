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
          <aside className="w-64 bg-[#0e1417] text-white flex flex-col shrink-0 border-r border-white/10">
            <div className="px-6 pt-6 pb-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#152027] border border-white/10 grid place-items-center">
                  <span className="text-emerald-200 text-xs font-semibold">GP</span>
                </div>
                <div>
                  <h1 className="text-base font-semibold tracking-wide text-white/90">Pro Manager</h1>
                  <p className="text-[11px] text-white/40">AI Financial Platform</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-4 py-5 space-y-1.5">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0 text-white/60" />
                  <span className="tracking-wide">{label}</span>
                </Link>
              ))}
            </nav>
            <div className="px-6 py-4 border-t border-white/10">
              <p className="text-[11px] text-white/40">Autónomo demo</p>
              <p className="text-xs text-white/60 mt-1">NIF: 12345678A</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-[#0f1214]">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

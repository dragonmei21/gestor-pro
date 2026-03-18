"use client"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-12 py-10 max-w-6xl mx-auto">
      {children}
    </div>
  )
}

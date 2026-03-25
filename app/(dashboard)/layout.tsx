import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  )
}

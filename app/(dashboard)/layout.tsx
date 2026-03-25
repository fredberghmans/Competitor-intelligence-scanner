import Sidebar from '@/components/layout/Sidebar'
import { createClient } from '@/lib/supabase/server'

/**
 * Dashboard layout — server component.
 *
 * Reads the current user from the session (anon key + cookie, via RLS-aware client)
 * and passes the email down to the Sidebar for display. The middleware already
 * guarantees a valid session before this layout runs, so `user` is always present.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex h-full bg-slate-50">
      <Sidebar userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto min-h-screen">{children}</main>
    </div>
  )
}

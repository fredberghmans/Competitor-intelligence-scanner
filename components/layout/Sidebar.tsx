'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Target, BarChart3, Clock, Cpu, LogOut, Settings } from 'lucide-react'
import { logoutAction } from '@/lib/actions/auth'

const nav = [
  { href: '/competitors', label: 'Competitors', icon: Building2 },
  { href: '/criteria', label: 'Criteria', icon: Target },
  { href: '/compare', label: 'Compare', icon: BarChart3 },
  { href: '/changelog', label: 'Changelog', icon: Clock, soon: true },
]

type Props = {
  userEmail?: string
}

export default function Sidebar({ userEmail }: Props) {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-slate-200 flex flex-col">
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-slate-200">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
          <Cpu size={14} className="text-white" />
        </div>
        <span className="font-semibold text-slate-900 text-sm tracking-tight">
          Intel Scanner
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Intelligence
        </p>
        {nav.map(({ href, label, icon: Icon, soon }) => {
          const active = pathname.startsWith(href)

          if (soon) {
            return (
              <div
                key={href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 cursor-not-allowed select-none"
              >
                <Icon size={15} />
                <span className="text-sm font-medium flex-1">{label}</span>
                <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                  Soon
                </span>
              </div>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={15} className={active ? 'text-indigo-600' : 'text-slate-400'} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="p-2 border-t border-slate-200">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith('/settings')
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Settings size={15} className={pathname.startsWith('/settings') ? 'text-indigo-600' : 'text-slate-400'} />
          Settings
        </Link>
      </div>

      {/* User / logout */}
      <div className="p-3 border-t border-slate-200">
        {userEmail && (
          <div className="mb-2 px-2">
            <p className="text-[11px] text-slate-500 truncate" title={userEmail}>
              {userEmail}
            </p>
          </div>
        )}
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}

import { Cpu } from 'lucide-react'
import { loginAction } from '@/lib/actions/auth'

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Cpu size={16} className="text-white" />
          </div>
          <span className="font-semibold text-slate-900 text-base tracking-tight">
            Intel Scanner
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-6">
            Enter your credentials to access the dashboard.
          </p>

          <form action={loginAction} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Sign in
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          No account? Ask your admin to invite you via Supabase.
        </p>
      </div>
    </div>
  )
}

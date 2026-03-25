import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Used in Server Components, Server Actions, and Route Handlers.
// Reads auth cookies so RLS applies per the logged-in user.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
}

// Service-role client — bypasses RLS.
// Only use in server-side pipeline code (crawling, AI processing).
// NEVER import this in Client Components or expose to the browser.
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  )
}

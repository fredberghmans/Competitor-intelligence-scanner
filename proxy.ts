import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth middleware — runs on every non-static request.
 *
 * Why no @supabase/ssr here:
 *   @supabase/ssr v0.9.0 has no Edge export condition, which causes
 *   Turbopack to fail with "Cannot find the middleware module".
 *   Instead we decode the session cookie ourselves — zero external imports,
 *   fully Edge-compatible.
 *
 * Security model:
 *   Middleware only gates navigation (redirects). The real security boundary
 *   is Supabase RLS: every DB call from createClient() runs under the
 *   authenticated role, so a missing or invalid token fails at the DB layer.
 *
 *   We check that the access_token JWT has not expired to avoid letting a
 *   stale cookie through. Refresh-token rotation is handled server-side by
 *   @supabase/ssr's createServerClient on the first authenticated request.
 *
 * To swap in SSO / company auth:
 *   Replace hasValidSession() with your IdP token check. Nothing else changes.
 */

function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  return atob(padded)
}

/**
 * Reads the Supabase session from request cookies and returns true when a
 * non-expired access token is found.
 *
 * Cookie format (@supabase/ssr v0.9):
 *   Name  — sb-{projectRef}-auth-token  (or chunked as .0, .1, …)
 *   Value — "base64-{base64url(JSON)}"  or plain JSON
 *
 * We decode the access_token JWT to read the `exp` claim without a network
 * call. No signature verification needed here — RLS verifies on every query.
 */
function hasValidSession(request: NextRequest): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
  const cookieKey = `sb-${projectRef}-auth-token`

  // Collect value — direct cookie or up to 5 chunks (.0 … .4)
  let raw = request.cookies.get(cookieKey)?.value ?? ''
  if (!raw) {
    const chunks: string[] = []
    for (let i = 0; i < 5; i++) {
      const chunk = request.cookies.get(`${cookieKey}.${i}`)?.value
      if (!chunk) break
      chunks.push(chunk)
    }
    raw = chunks.join('')
  }

  if (!raw) return false

  // Decode base64- prefix if present
  const jsonStr = raw.startsWith('base64-')
    ? base64urlDecode(raw.slice('base64-'.length))
    : raw

  try {
    const session = JSON.parse(jsonStr)
    const accessToken: string = session?.access_token
    if (!accessToken) return false

    // Decode the JWT payload to check expiry
    const payloadB64 = accessToken.split('.')[1]
    if (!payloadB64) return false
    const payload = JSON.parse(base64urlDecode(payloadB64))

    // exp is Unix seconds; allow 10 s of clock skew
    return typeof payload.exp === 'number' && payload.exp > Date.now() / 1000 - 10
  } catch {
    return false
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authenticated = hasValidSession(request)

  if (!authenticated && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (authenticated && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/competitors'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

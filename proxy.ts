import { NextResponse, type NextRequest } from 'next/server'

/**
 * Pass-through proxy — no auth logic here.
 *
 * Auth is enforced at the Server Component layer:
 *   - app/(dashboard)/layout.tsx redirects to /login when getUser() returns null
 *   - app/login/page.tsx redirects to /competitors when already authenticated
 *
 * The real security boundary is Supabase RLS: every DB call runs under the
 * authenticated role, so unauthenticated requests fail at the DB layer.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

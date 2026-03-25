'use server'

/**
 * Auth server actions.
 *
 * Uses createClient() (anon key + session cookie) — NOT the service role.
 * Supabase auth APIs (signInWithPassword, signOut) are always available to
 * the anon key; they don't require elevated privileges.
 *
 * The service role client is never used here. It lives in lib/supabase/server.ts
 * and is only imported by pipeline/crawl code that runs outside user sessions.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Pass error as a query param — keeps this a server redirect with no client state.
    redirect('/login?error=Invalid+email+or+password')
  }

  redirect('/competitors')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

'use server';

/**
 * Sign in and out.
 *
 * Supabase sets the session cookie; the layout then checks `admin_roles` and
 * turns anyone without a role away. Signing in is therefore not the same as
 * being an admin, which is the correct shape — a customer account can exist
 * without gaining anything here.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionClient } from '@mridul/supabase/server';

/**
 * Where Google should send people back to.
 *
 * Prefers the configured origin; the Host header is the fallback for local
 * work. Supabase checks the callback against its own allow-list, so a forged
 * Host cannot redirect a session somewhere else — but set the variable in
 * production anyway rather than trusting a header.
 */
async function adminOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_ADMIN_ORIGIN;
  if (configured) return configured.replace(/\/$/, '');

  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
  return host ? `${protocol}://${host}` : 'http://localhost:3001';
}

export async function signIn(
  _previous: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Enter your email and password.' };
  }

  const db = await sessionClient();
  const { error } = await db.auth.signInWithPassword({ email, password });

  // Deliberately vague: a precise message would tell someone probing which
  // half they got right.
  if (error) return { error: 'Those details did not work.' };

  redirect('/');
}

/**
 * Google sign-in.
 *
 * This only establishes who someone is. The dashboard gate still asks
 * `admin_roles` whether they may be here, so a Google account with no role
 * signs in successfully and is shown the door — which is the shape we want.
 */
export async function signInWithGoogle(): Promise<void> {
  const db = await sessionClient();
  const origin = await adminOrigin();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) redirect('/login?error=google');
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const db = await sessionClient();
  await db.auth.signOut();
  redirect('/login');
}

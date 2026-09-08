'use server';

/**
 * Sign in and out.
 *
 * Supabase sets the session cookie; the layout then checks `admin_roles` and
 * turns anyone without a role away. Signing in is therefore not the same as
 * being an admin, which is the correct shape — a customer account can exist
 * without gaining anything here.
 */

import { redirect } from 'next/navigation';
import { sessionClient } from '@mridul/supabase/server';

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

export async function signOut(): Promise<void> {
  const db = await sessionClient();
  await db.auth.signOut();
  redirect('/login');
}

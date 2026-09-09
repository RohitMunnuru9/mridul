'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionClient } from '@mridul/supabase/server';

export type AuthResult = { ok: boolean; message: string };

function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? '/checkout');
  return next.startsWith('/') && !next.startsWith('//') ? next : '/checkout';
}

async function requestOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN;
  if (configured) return configured.replace(/\/$/, '');

  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
  return host ? `${protocol}://${host}` : 'http://localhost:3000';
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  if (!email || !password) return { ok: false, message: 'Enter your email and password.' };

  const db = await sessionClient();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: 'The email or password is incorrect.' };
  redirect(next);
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: 'Enter a valid email address.' };
  }
  if (password.length < 8) {
    return { ok: false, message: 'Use at least 8 characters for your password.' };
  }

  const db = await sessionClient();
  const origin = await requestOrigin();
  const callback = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callback },
  });
  if (error) return { ok: false, message: error.message };
  if (data.session) redirect(next);
  return {
    ok: true,
    message: 'Account created. Open the verification link sent to your email.',
  };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(formData.get('next'));
  const origin = await requestOrigin();
  const db = await sessionClient();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error || !data.url) {
    redirect(`/auth?next=${encodeURIComponent(next)}&error=google`);
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const db = await sessionClient();
  await db.auth.signOut();
  redirect('/');
}


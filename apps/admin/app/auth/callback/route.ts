import { NextResponse } from 'next/server';
import { sessionClient } from '@mridul/supabase/server';

/**
 * Where Google returns to after an admin signs in.
 *
 * Exchanging the code only establishes a session. Whether that session may see
 * anything is still the dashboard gate's question, and it asks `admin_roles`.
 * So this always lands on `/` and lets the gate decide.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code) {
    const db = await sessionClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/', url.origin));
  }

  return NextResponse.redirect(new URL('/login?error=google', url.origin));
}

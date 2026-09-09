import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { sessionClient } from '@mridul/supabase/server';
import { AuthForm } from './auth-form';
import { signInWithGoogle } from './actions';

export const metadata: Metadata = {
  title: 'Sign in | Mridul by MR',
  description: 'Sign in securely or create your Mridul by MR account.',
};

type PageProps = { searchParams: Promise<{ next?: string; error?: string }> };

function safeNext(value?: string): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/checkout';
}

export default async function AuthPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const next = safeNext(query.next);
  const db = await sessionClient();
  const { data: { user } } = await db.auth.getUser();
  if (user) redirect(next);

  return (
    <div className="auth-page">
      <section className="auth-card">
        <Link className="auth-back" href="/bag"><ChevronLeft aria-hidden="true" /> Back to bag</Link>
        <p className="eyebrow">Secure checkout</p>
        <h1>Sign in to continue</h1>
        <p className="auth-intro">Your account keeps your delivery details and order updates together.</p>

        <form action={signInWithGoogle}>
          <input name="next" type="hidden" value={next} />
          <button className="google-auth" type="submit">
            <GoogleMark /> Continue with Google
          </button>
        </form>

        {query.error === 'google' && <p className="auth-message is-bad">Google sign-in could not start. Please try again.</p>}
        <div className="auth-divider"><span>or use email</span></div>
        <AuthForm next={next} />

        <p className="auth-secure"><ShieldCheck aria-hidden="true" /> Your password is handled securely by Supabase and is never stored by this website.</p>
      </section>
    </div>
  );
}

/** The official Google "G", inline so it loads with the page. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

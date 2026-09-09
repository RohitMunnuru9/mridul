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
            <span aria-hidden="true">G</span> Continue with Google
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


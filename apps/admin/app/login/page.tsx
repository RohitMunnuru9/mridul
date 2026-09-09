import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentAdmin, sessionClient } from '@mridul/supabase/server';
import { LoginForm } from './login-form';
import { signInWithGoogle, signOut } from './actions';
import { GoogleMark } from './google-mark';

export const metadata: Metadata = { title: 'Sign in | Mridul Admin' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already signed in and holding a role — no reason to show this.
  if (await currentAdmin()) redirect('/');

  const query = await searchParams;

  // Signed in, but `admin_roles` has nothing for them. Without saying so they
  // would sign in with Google, land back here, and have no idea why.
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          Mridul<span>Admin</span>
        </div>
        <p className="login-intro">
          Sign in with the account that holds your admin role.
        </p>

        {user && (
          <div className="login-norole">
            <strong>Signed in as {user.email}</strong>
            <span>
              That account has no admin role, so there is nothing here for it.
              Ask a super admin to grant one, or use a different account.
            </span>
            <form action={signOut}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        )}

        {query.error === 'google' && (
          <p className="login-error" role="alert">
            Google sign-in could not be completed. Try again, or use your email
            and password.
          </p>
        )}

        <form action={signInWithGoogle}>
          <button className="google-auth" type="submit">
            <GoogleMark /> Continue with Google
          </button>
        </form>

        <div className="login-divider">
          <span>or use email</span>
        </div>

        <LoginForm />
        <p className="login-note">
          Access is granted by role, not by knowing this address. An account
          without one gets nothing here.
        </p>
      </div>
    </div>
  );
}

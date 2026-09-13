import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminAccess } from '@mridul/supabase/server';
import { LoginForm } from './login-form';
import { signInWithGoogle, signOut } from './actions';
import { GoogleMark } from './google-mark';

export const metadata: Metadata = { title: 'Sign in | Mridul Admin' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // One lookup, not two. Asking twice means two clients refreshing the same
  // session cookie in a server component, which cannot write the result back.
  const access = await adminAccess();
  if (access.state === 'ok') redirect('/');

  const query = await searchParams;

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          Mridul<span>Admin</span>
        </div>
        <p className="login-intro">
          Sign in with the account that holds your admin role.
        </p>

        {/*
          Signed in but not through the gate. Which of the two reasons it is
          decides what the person should do next, so they are never shown the
          same sentence.
        */}
        {access.state === 'no_role' && (
          <div className="login-norole">
            <strong>Signed in as {access.email}</strong>
            <span>
              That account has no admin role, so there is nothing here for it.
              Ask a super admin to grant one, or use a different account.
            </span>
            <form action={signOut}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        )}

        {access.state === 'unreadable' && (
          <div className="login-norole">
            <strong>Signed in as {access.email}</strong>
            <span>
              Your role could not be checked, which usually means this sign-in
              has expired rather than that anything has changed. Sign out and
              sign in again.
            </span>
            <span className="login-reason">{access.reason}</span>
            <form action={signOut}>
              <button type="submit">Sign out and start again</button>
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

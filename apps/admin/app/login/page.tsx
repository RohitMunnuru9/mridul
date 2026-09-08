import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@mridul/supabase/server';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in | Mridul Admin' };

export default async function LoginPage() {
  // Already signed in and holding a role — no reason to show this.
  if (await currentAdmin()) redirect('/');

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          Mridul<span>Admin</span>
        </div>
        <p className="login-intro">
          Sign in with the account that holds your admin role.
        </p>
        <LoginForm />
        <p className="login-note">
          Access is granted by role, not by knowing this address. An account
          without one gets nothing here.
        </p>
      </div>
    </div>
  );
}

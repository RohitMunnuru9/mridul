'use client';

import { useActionState } from 'react';
import { signIn } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, {});

  return (
    <form action={action} className="login-form">
      <label htmlFor="email">Email</label>
      <input
        autoComplete="username"
        id="email"
        name="email"
        required
        type="email"
      />

      <label htmlFor="password">Password</label>
      <input
        autoComplete="current-password"
        id="password"
        name="password"
        required
        type="password"
      />

      {state?.error && (
        <p className="login-error" role="alert">
          {state.error}
        </p>
      )}

      <button disabled={pending} type="submit">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

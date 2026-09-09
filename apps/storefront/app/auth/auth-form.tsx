'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { signIn, signUp, type AuthResult } from './actions';

const INITIAL: AuthResult = { ok: false, message: '' };

export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const action = mode === 'signin' ? signIn : signUp;
  const [state, formAction, pending] = useActionState(
    async (_previous: AuthResult, data: FormData) => action(data),
    INITIAL,
  );

  return (
    <div className="auth-form-wrap">
      <div className="auth-mode" role="tablist" aria-label="Account access">
        <button
          aria-selected={mode === 'signin'}
          className={mode === 'signin' ? 'is-active' : ''}
          onClick={() => setMode('signin')}
          role="tab"
          type="button"
        >
          Sign in
        </button>
        <button
          aria-selected={mode === 'signup'}
          className={mode === 'signup' ? 'is-active' : ''}
          onClick={() => setMode('signup')}
          role="tab"
          type="button"
        >
          Create account
        </button>
      </div>

      <form action={formAction} className="customer-form">
        <input name="next" type="hidden" value={next} />
        <label>
          <span>Email address</span>
          <span className="customer-input"><Mail aria-hidden="true" /><input autoComplete="email" inputMode="email" name="email" required type="email" /></span>
        </label>
        <label>
          <span>Password</span>
          <span className="customer-input">
            <LockKeyhole aria-hidden="true" />
            <input autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} name="password" required type={showPassword ? 'text' : 'password'} />
            <button aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((shown) => !shown)} type="button">
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </span>
          {mode === 'signup' && <small>Use at least 8 characters.</small>}
        </label>

        {state.message && (
          <p className={`auth-message ${state.ok ? 'is-ok' : 'is-bad'}`} role="status">
            {state.message}
          </p>
        )}

        <button className="auth-submit" disabled={pending} type="submit">
          {pending ? 'Please wait…' : mode === 'signin' ? 'Sign in and continue' : 'Create account'}
        </button>
      </form>
    </div>
  );
}


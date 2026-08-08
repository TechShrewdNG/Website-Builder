'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

import Icon from '@/components/Icon';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    try {
      if (mode === 'register') {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: String(form.get('name') ?? '') || undefined }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? 'Could not create the account');
        }
      }

      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) throw new Error('Incorrect email or password');

      router.push('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <main className="ws-grain relative flex min-h-dvh flex-col justify-center px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[380px] w-[620px] -translate-x-1/2 rounded-full opacity-[0.12] blur-[110px]"
        style={{ background: 'radial-gradient(circle, #d79b3c 0%, transparent 70%)' }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[380px]">
        <Link href="/" className="mb-8 flex items-center gap-2.5 text-muted transition-colors hover:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accentInk">
            <Icon name="grid" size={17} />
          </span>
          <span className="text-[13px] font-semibold text-white">Website Builder</span>
        </Link>

        <h1 className="text-[26px] font-semibold leading-tight tracking-display text-white">
          {mode === 'login' ? 'Sign in' : 'Create your account'}
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          {mode === 'login'
            ? 'Pick up where you left off.'
            : 'You only need an email and a password.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          {mode === 'register' && (
            <div>
              <label className="ws-label" htmlFor="name">
                Name
              </label>
              <input id="name" name="name" className="ws-field" autoComplete="name" />
            </div>
          )}

          <div>
            <label className="ws-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="ws-field"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="ws-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="ws-field"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && (
              <p className="mt-1.5 text-[11px] text-faint">At least 8 characters.</p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="animate-ws-rise rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] leading-relaxed text-danger"
            >
              {error}
            </p>
          )}

          <button type="submit" className="ws-btn-primary mt-1 h-11 text-[15px]" disabled={busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-7 text-[13px] text-muted">
          {mode === 'login' ? (
            <>
              No account yet?{' '}
              <Link href="/register" className="font-medium text-accent underline-offset-2 hover:underline">
                Register
              </Link>
            </>
          ) : (
            <>
              Already registered?{' '}
              <Link href="/login" className="font-medium text-accent underline-offset-2 hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

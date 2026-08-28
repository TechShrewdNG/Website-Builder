'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

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
          const body: any = await response.json().catch(() => ({}));
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
    <main className="mkt-theme relative flex min-h-dvh flex-col justify-center overflow-hidden py-16" style={{ paddingInline: 'var(--mkt-gutter)' }}>
      <div
        className="mkt-glow -top-32 left-1/2 h-[420px] w-[680px] -translate-x-1/2 bg-mktPurple/25"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto w-full max-w-[380px]">
        <Link href="/" className="mkt-logo mb-9 inline-block text-[1.15rem]">
          QLEVR<span>.</span> Canvas
        </Link>

        <h1 className="font-display text-[32px] font-light leading-tight text-mktText">
          {mode === 'login' ? (
            'Welcome back.'
          ) : (
            <>
              Build your dream website
              <br />
              <em className="italic text-mktGold">yourself.</em>
            </>
          )}
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-mktTextMuted">
          {mode === 'login'
            ? 'Sign in to pick up where you left off.'
            : 'Create a free account. No credit card, no code required.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          {mode === 'register' && (
            <div>
              <label className="mkt-label" htmlFor="name">
                Name
              </label>
              <input id="name" name="name" className="mkt-field" autoComplete="name" />
            </div>
          )}

          <div>
            <label className="mkt-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mkt-field"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mkt-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="mkt-field"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && (
              <p className="mt-1.5 text-[11px] text-mktTextMuted">At least 8 characters.</p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-mktDanger/30 bg-mktDanger/10 px-3 py-2.5 text-[13px] leading-relaxed text-mktDanger"
            >
              {error}
            </p>
          )}

          <button type="submit" className="mkt-btn-primary mt-1 h-12 text-[13px]" disabled={busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-7 text-[13px] text-mktTextMuted">
          {mode === 'login' ? (
            <>
              No account yet?{' '}
              <Link href="/register" className="font-medium text-mktGold underline-offset-2 hover:underline">
                Register
              </Link>
            </>
          ) : (
            <>
              Already registered?{' '}
              <Link href="/login" className="font-medium text-mktGold underline-offset-2 hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

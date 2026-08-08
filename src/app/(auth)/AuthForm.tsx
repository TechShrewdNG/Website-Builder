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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">
        {mode === 'login' ? 'Sign in' : 'Create your account'}
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
          <input id="email" name="email" type="email" required className="ws-field" autoComplete="email" />
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
            <p className="mt-1 text-xs text-neutral-500">At least 8 characters.</p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" className="ws-btn-primary" disabled={busy}>
          {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-sm text-neutral-400">
        {mode === 'login' ? (
          <>
            No account yet?{' '}
            <Link href="/register" className="text-accent hover:underline">
              Register
            </Link>
          </>
        ) : (
          <>
            Already registered?{' '}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </main>
  );
}

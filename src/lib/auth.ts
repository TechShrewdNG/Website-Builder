import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { getPrisma } from './db';

export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // No adapter: sessions are JWTs and the only provider is Credentials, whose
  // authorize() below does its own lookup — Auth.js never routes a
  // Credentials sign-in through the adapter regardless. That matters here
  // beyond being unused weight: the D1 binding this app's Prisma client now
  // needs (see db.ts) only exists once a request is being handled, so an
  // adapter built from it couldn't be constructed at this module's load time
  // in a Worker anyway.
  // Self-hosted behind a proxy (Vercel, Docker, nginx), the Host header is what
  // identifies the deployment; without this Auth.js rejects every callback.
  trustHost: true,
  // The credentials provider cannot use database sessions — the adapter never
  // sees a sign-in it didn't broker — so sessions are JWTs.
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await getPrisma().user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

/** Session user id, or null. Every API route gates on this. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

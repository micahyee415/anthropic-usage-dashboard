/**
 * Edge-compatible auth config — used by proxy.ts (Next.js edge runtime).
 * Must not import anything that requires Node.js APIs (no crypto, no fs, etc.).
 * Providers are added in auth.ts for server-side use.
 */
import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isPublic =
        nextUrl.pathname.startsWith('/api/auth') ||
        nextUrl.pathname === '/login' ||
        nextUrl.pathname === '/api/warm' ||
        nextUrl.pathname === '/api/debug-env'

      if (isPublic) return true
      if (isLoggedIn) return true

      // Not logged in — redirect to /login (proxy handles the redirect)
      return false
    },
  },
  providers: [], // populated in auth.ts
} satisfies NextAuthConfig

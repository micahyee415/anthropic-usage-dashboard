/**
 * Next.js proxy (formerly middleware) — runs on every request at the edge.
 * Uses the lightweight auth.config (Edge-compatible, no Node.js APIs).
 * The `authorized` callback in auth.config decides whether to allow or redirect.
 */
import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

const { auth } = NextAuth(authConfig)

export const proxy = auth

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

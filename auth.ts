/**
 * Full Auth.js v5 config — server-side only (Node.js runtime).
 * Adds the Google provider and restricts sign-in to @example.com addresses.
 */
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    // Only allow @example.com Google accounts — all others are rejected at sign-in
    signIn({ profile }) {
      return profile?.email?.endsWith('@example.com') ?? false
    },
    // Carry the email through to the session so components can display it
    session({ session, token }) {
      if (token.email) session.user.email = token.email
      return session
    },
  },
})

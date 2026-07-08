/** Single source of truth for whether Clerk is wired up. Only the publishable
 * key is readable client-side, so that's the flag both server and client
 * code check before touching any Clerk API — keeps the zero-key demo path
 * fully offline (no ClerkProvider mount, no auth()/currentUser() calls). */
export const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

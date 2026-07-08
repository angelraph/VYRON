import "server-only";
import { isClerkConfigured } from "@/lib/auth-config";
import { DEMO_USER_ID } from "@/lib/mock-data";
import type { VyronUser } from "@/lib/types";

const DEMO_USER: VyronUser = {
  id: DEMO_USER_ID,
  name: "Demo Founder",
  email: "founder@vyron.dev",
  imageUrl: null,
};

/** Resolves the active user for server components/actions. Falls back to a
 * fixed demo identity whenever Clerk isn't configured, so every page renders
 * with zero external keys. */
export async function getCurrentUser(): Promise<VyronUser> {
  if (!isClerkConfigured) return DEMO_USER;

  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  if (!user) return DEMO_USER;

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    "VYRON user";

  return {
    id: user.id,
    name,
    email: user.emailAddresses[0]?.emailAddress ?? "",
    imageUrl: user.imageUrl ?? null,
  };
}

/** Guards the dashboard shell. In demo mode (no Clerk keys) there is nothing
 * to protect against, so it always resolves. With Clerk configured, an
 * unauthenticated visitor is redirected to sign-in. */
export async function requireUser(): Promise<VyronUser> {
  if (!isClerkConfigured) return DEMO_USER;

  const { auth } = await import("@clerk/nextjs/server");
  const { userId, redirectToSignIn } = await auth();
  if (!userId) {
    redirectToSignIn();
  }
  return getCurrentUser();
}

export { isClerkConfigured };

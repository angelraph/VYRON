"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth-config";

/** Only mounts ClerkProvider when real keys exist, so the zero-key demo
 * path never touches Clerk (no network calls, no keyless auto-provisioning). */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
}

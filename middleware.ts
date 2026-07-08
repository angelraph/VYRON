import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/auth-config";

/** clerkMiddleware() is only invoked when real Clerk keys are present —
 * calling Clerk's auth() helpers without it throws, and mounting it
 * unconditionally would make the zero-key demo path depend on Clerk. */
export default isClerkConfigured
  ? clerkMiddleware()
  : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};

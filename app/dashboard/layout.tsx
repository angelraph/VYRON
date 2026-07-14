import { requireUser } from "@/lib/auth";
import { driveEngineTick } from "@/lib/engine/executor";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { BackgroundGlow } from "@/components/shared/background-glow";

// Every dashboard page reads live Prisma data — statically optimizing this
// layout (Next.js's default when nothing forces dynamic rendering) would
// freeze it at build time, so real changes (new agents, goal progress,
// marketplace listings) wouldn't show up until the next deploy.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  // Vercel freezes the process between requests, so the background engine
  // loop (instrumentation.ts) can't be relied on to advance goals on its
  // own — drive one real tick here so every dashboard page (not just the
  // OKX ASP bridge) reflects actual progress instead of a stale DB read.
  await driveEngineTick("dashboard_layout");

  return (
    <div className="relative min-h-screen">
      <BackgroundGlow />
      <Sidebar />
      <div className="flex min-h-screen flex-col md:pl-64">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

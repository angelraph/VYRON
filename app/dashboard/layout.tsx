import { requireUser } from "@/lib/auth";
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

import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { BackgroundGlow } from "@/components/shared/background-glow";

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

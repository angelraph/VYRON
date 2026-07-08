import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { BackgroundGlow } from "@/components/shared/background-glow";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <BackgroundGlow />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

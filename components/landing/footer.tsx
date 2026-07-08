import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export function Footer() {
  return (
    <footer className="border-t border-border/60 px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Logo />
        <p className="text-sm text-muted-foreground">
          Built for the OKX Build-X Hackathon — OKX.AI Agent Marketplace.
        </p>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/dashboard/marketplace" className="hover:text-foreground">
            Marketplace
          </Link>
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}

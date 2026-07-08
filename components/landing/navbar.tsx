import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

const LINKS = [
  { label: "Product", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Marketplace", href: "/marketplace" },
];

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <div className="glass flex w-full max-w-5xl items-center justify-between rounded-2xl px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/dashboard">Sign in</Link>
          </Button>
          <Button size="sm" asChild className="bg-gradient-brand text-primary-foreground hover:opacity-90">
            <Link href="/dashboard/new-goal">
              Launch a goal
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

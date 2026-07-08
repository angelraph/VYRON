import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { NavLinks } from "@/components/dashboard/nav-links";

export function Sidebar() {
  return (
    <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r p-5 md:flex">
      <Link href="/" className="px-1">
        <Logo />
      </Link>
      <NavLinks className="flex-1" />
      <p className="text-muted-foreground/70 px-1 text-xs">
        VYRON &middot; OKX Build-X
      </p>
    </aside>
  );
}

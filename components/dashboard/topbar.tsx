import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UserMenu } from "@/components/shared/user-menu";

export function Topbar({ title }: { title?: string }) {
  return (
    <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex items-center gap-2 md:hidden">
        <MobileNav />
        <Link href="/">
          <Logo />
        </Link>
      </div>
      {title && (
        <h1 className="hidden text-sm font-medium text-muted-foreground md:block">
          {title}
        </h1>
      )}
      <div className="ml-auto">
        <UserMenu />
      </div>
    </header>
  );
}

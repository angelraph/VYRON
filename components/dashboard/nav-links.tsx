"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DASHBOARD_NAV_LINKS } from "@/lib/constants";

export function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {DASHBOARD_NAV_LINKS.map((link) => {
        const isActive =
          link.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <link.icon
              className={cn("size-4", isActive && "text-violet")}
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

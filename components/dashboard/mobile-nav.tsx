"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/shared/logo";
import { NavLinks } from "@/components/dashboard/nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>
      <SheetContent side="left" className="w-72 p-5">
        <SheetHeader className="mb-4 p-0">
          <SheetTitle asChild>
            <Link href="/" onClick={() => setOpen(false)}>
              <Logo />
            </Link>
          </SheetTitle>
        </SheetHeader>
        <NavLinks onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Settings, Sparkles } from "lucide-react";
import { isClerkConfigured } from "@/lib/auth-config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function DemoUserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-8 border border-border">
          <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs">
            DF
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="font-medium text-foreground">Demo Founder</span>
          <span className="text-muted-foreground text-xs font-normal">
            founder@vyron.dev
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="size-3" />
            Demo mode
          </Badge>
        </div>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClerkUserMenu() {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          label="Settings"
          href="/dashboard/settings"
          labelIcon={<Settings className="size-4" />}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}

export function UserMenu() {
  if (!isClerkConfigured) return <DemoUserMenu />;
  return <ClerkUserMenu />;
}

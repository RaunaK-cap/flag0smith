"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { readConnection } from "@/lib/connection";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/", label: "New run" },
  { href: "/runs", label: "Runs" },
  { href: "/connect", label: "Connect" },
];

export function AppHeader() {
  const pathname = usePathname();
  const [connected, setConnected] = useState(false);

  // Re-check on every page change, so the badge updates after connecting.
  useEffect(() => setConnected(readConnection() !== null), [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-screen-2xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <span className="grid size-5 place-items-center rounded bg-foreground text-[10px] font-semibold text-background">
            FP
          </span>
          <span className="hidden sm:inline">FlagPilot</span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
                  active && "bg-muted text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", connected ? "bg-live" : "bg-muted-foreground")} />
            {connected ? "Your project" : "Demo"}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

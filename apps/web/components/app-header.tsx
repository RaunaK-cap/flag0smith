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
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-screen-2xl items-center gap-6 border-x px-4">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <svg aria-hidden viewBox="0 0 16 16" className="size-4">
            <rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" />
            <path d="M5 4.5v7M5 4.5h5.5L9 6.75l1.5 2.25H5" fill="none" stroke="var(--background)" strokeWidth="1.3" />
          </svg>
          <span className="hidden sm:inline">flagpilot</span>
        </Link>

        <nav className="flex items-center gap-4">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-1 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground underline decoration-1 underline-offset-[6px]",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="flex h-6 items-center gap-1.5 rounded-[4px] border bg-card px-2 text-[11px] text-muted-foreground">
            <span className={cn("size-1.5", connected ? "bg-live" : "bg-muted-foreground")} />
            {connected ? "Your project" : "Demo"}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

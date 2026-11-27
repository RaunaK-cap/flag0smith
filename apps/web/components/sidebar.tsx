"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FlaskConical, Flag, Layers, Menu, Plug, Plus, ScrollText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { readConnection } from "@/lib/connection";
import { timeAgo } from "@/lib/format";
import { useRuns } from "@/lib/use-runs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const flagsmithLinks = [
  { href: "/flags", label: "Flags", icon: Flag },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/segments", label: "Segments", icon: Users },
  { href: "/environments", label: "Environments", icon: Layers },
  { href: "/audit", label: "Audit log", icon: ScrollText },
];

// Desktop: a fixed column on the left. Mobile: a slim top bar with a menu that opens the same sidebar.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-60 shrink-0 border-r bg-card/50 md:flex">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function MobileBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]); // close after navigating

  return (
    <div className="flex h-11 items-center gap-2 border-b px-3 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="grid size-8 place-items-center" aria-label="Open menu">
          <Menu className="size-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent />
        </SheetContent>
      </Sheet>
      <Logo />
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-medium">
      <svg aria-hidden viewBox="0 0 16 16" className="size-4">
        <rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" />
        <path d="M5 4.5v7M5 4.5h5.5L9 6.75l1.5 2.25H5" fill="none" stroke="var(--background)" strokeWidth="1.3" />
      </svg>
      flagpilot
    </Link>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const { runs, error } = useRuns();
  const [connected, setConnected] = useState(false);
  useEffect(() => setConnected(readConnection() !== null), [pathname]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-12 items-center border-b px-4">
        <Logo />
      </div>

      <div className="p-3">
        <Link
          href="/"
          className="flex h-8 items-center gap-2 rounded-[5px] border border-line-2 bg-background px-2.5 text-[12px] transition-colors hover:border-foreground/40"
        >
          <Plus className="size-3.5" /> New chat
        </Link>
      </div>

      <SidebarLabel>Chats</SidebarLabel>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2">
        {error && <p className="hatch mx-2 border p-2 text-[11px] text-muted-foreground">Backend offline (port 4000).</p>}
        {runs?.length === 0 && <p className="px-2 py-1 text-[11px] text-muted-foreground">No chats yet.</p>}
        {runs?.map((run) => {
          const active = pathname === `/runs/${run.id}`;
          const busy = run.status === "running" || run.status === "waiting_approval";
          return (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className={cn(
                "group flex items-start gap-2 rounded-[5px] px-2 py-1.5 transition-colors hover:bg-muted",
                active && "bg-muted",
              )}
            >
              <span
                className={cn(
                  "mt-[7px] size-1.5 shrink-0",
                  run.status === "waiting_approval" ? "animate-pulse bg-warn" : busy ? "animate-pulse bg-live" : "bg-line-2",
                  run.status === "failed" && "bg-destructive",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[12px]", !active && "text-ink-2")}>{run.question}</span>
                <span className="text-[10.5px] text-muted-foreground tabular">{timeAgo(run.created_at)}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t pt-3 pb-2">
        <SidebarLabel>Flagsmith</SidebarLabel>
        <nav className="px-2">
          {flagsmithLinks.map(({ href, label, icon: Icon }) => (
            <NavLink key={href} href={href} active={pathname.startsWith(href)}>
              <Icon className="size-3.5" /> {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-1 border-t px-2 py-2">
        <NavLink href="/connect" active={pathname === "/connect"} className="flex-1">
          <Plug className="size-3.5" />
          <span className="flex-1">{connected ? "Your project" : "Demo project"}</span>
          <span className={cn("size-1.5", connected ? "bg-live" : "bg-line-2")} />
        </NavLink>
        <ThemeToggle />
      </div>
    </div>
  );
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 flex items-center gap-2 px-4 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
      <span className="size-1 bg-foreground" />
      {children}
    </p>
  );
}

function NavLink({
  href,
  active,
  children,
  className,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-7 items-center gap-2 rounded-[5px] px-2 text-[12px] text-ink-2 transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}

"use client";

// Shared layout for the Flagsmith pages: a header with title + refresh, then the content.

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/frame";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({
  eyebrow,
  title,
  rest,
  onRefresh,
  loading,
  children,
}: {
  eyebrow: string;
  title: string;
  rest?: string;
  onRefresh?: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b px-4 pt-8 pb-5 sm:px-8">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
          <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
            {title} {rest && <span className="text-muted-foreground">{rest}</span>}
          </h1>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex h-7 items-center gap-1.5 rounded-[5px] border bg-card px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} /> Refresh
          </button>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

// Loading, error and empty states, so every page handles them the same way.
export function DataState({
  loading,
  error,
  empty,
  emptyText,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (error) {
    return (
      <div className="hatch m-4 border p-4 text-[12px] sm:m-8">
        <p className="mb-1 font-medium">Couldn&apos;t load from Flagsmith</p>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (loading && empty) {
    return (
      <div className="space-y-2 p-4 sm:p-8">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 rounded-[4px]" />
        ))}
      </div>
    );
  }
  if (empty) return <p className="hatch m-4 border p-4 text-[12px] text-muted-foreground sm:m-8">{emptyText}</p>;
  return <>{children}</>;
}

export function OnOff({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-[4px] border px-1.5 text-[10.5px]",
        on ? "border-live/30 text-live" : "text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5", on ? "bg-live" : "bg-line-2")} />
      {on ? "ON" : "OFF"}
    </span>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { listRuns, type RunSummary } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";

// Refreshes every few seconds so statuses stay current.
export function useRuns() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await listRuns();
        if (alive) {
          setRuns(data);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Backend unreachable");
      }
    }
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return { runs, error };
}

export function RunsList({ activeId, limit, compact }: { activeId?: string; limit?: number; compact?: boolean }) {
  const { runs, error } = useRuns();

  if (error) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Can&apos;t reach the agent backend. Is it running on port 4000?
      </p>
    );
  }

  if (!runs) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return <p className="text-xs text-muted-foreground">No runs yet. Ask something to start one.</p>;
  }

  return (
    <ul className="space-y-1">
      {runs.slice(0, limit).map((run) => (
        <li key={run.id}>
          <Link
            href={`/runs/${run.id}`}
            className={cn(
              "block rounded-lg px-3 py-2 transition-colors hover:bg-muted",
              run.id === activeId && "bg-muted",
            )}
          >
            <p className={cn("truncate", compact ? "text-[13px]" : "text-sm")}>{run.question}</p>
            <div className="mt-0.5 flex items-center gap-3">
              <StatusBadge status={run.status} />
              <span className="text-xs text-muted-foreground">{timeAgo(run.created_at)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

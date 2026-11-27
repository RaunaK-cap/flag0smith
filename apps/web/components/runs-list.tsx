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
      <p className="hatch border p-3 text-[11px] text-muted-foreground">
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
    return <p className="hatch border p-3 text-[11px] text-muted-foreground">No runs yet. Ask something to start one.</p>;
  }

  return (
    <ul className="divide-y border-y">
      {runs.slice(0, limit).map((run) => (
        <li key={run.id}>
          <Link
            href={`/runs/${run.id}`}
            className={cn(
              "block px-2 py-2.5 transition-colors hover:bg-muted/60",
              run.id === activeId && "bg-muted",
            )}
          >
            <p className={cn("truncate", compact ? "text-[12px]" : "text-[13px]")}>{run.question}</p>
            <div className="mt-0.5 flex items-center gap-3">
              <StatusBadge status={run.status} />
              <span className="text-[11px] text-muted-foreground tabular">{timeAgo(run.created_at)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

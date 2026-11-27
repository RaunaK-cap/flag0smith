"use client";

import { useEffect, useState } from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RunsList } from "@/components/runs-list";
import { StatusBadge } from "@/components/status-badge";
import { AgentTimeline } from "@/components/run/agent-timeline";
import { ApprovalCard } from "@/components/run/approval-card";
import { ExperimentPanel } from "@/components/run/experiment-panel";
import { useRunStream, type StreamState } from "@/lib/use-run-stream";
import { cn } from "@/lib/utils";
import { CornerMarks, Eyebrow } from "@/components/frame";

export function RunScreen({ id }: { id: string }) {
  const { view, state } = useRunStream(id);
  const running = view.status === "running" || view.status === "waiting_approval";

  return (
    <div className="relative mx-auto grid w-full max-w-screen-2xl flex-1 grid-cols-1 border-x lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[260px_minmax(0,1fr)_400px]">
      {/* Left: all runs (desktop only; on mobile it opens in a sheet) */}
      <aside className="hidden border-r p-3 xl:block">
        <Eyebrow className="mb-3 px-2">Runs</Eyebrow>
        <RunsList activeId={id} compact />
      </aside>

      {/* Middle: the question and what every agent is doing */}
      <section className="min-w-0 px-4 py-6 lg:border-r lg:px-8">
        <div className="mb-6 flex items-start gap-2 border-b pb-6">
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="xl:hidden" aria-label="Show runs" />}>
              <PanelLeft />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-3">
              <SheetHeader className="p-0 pb-2">
                <SheetTitle className="text-[12px]">Runs</SheetTitle>
              </SheetHeader>
              <RunsList activeId={id} compact />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1 space-y-2">
            <Eyebrow>{view.mode === "demo" ? "Run · demo project" : "Run · your project"}</Eyebrow>
            <h1 className="text-lg font-medium tracking-tight text-balance sm:text-xl">{view.question || "Loading…"}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusBadge status={view.status} />
              <Elapsed from={view.startedAt} to={running ? undefined : view.lastAt} />
              <StreamDot state={state} />
            </div>
          </div>
        </div>

        <AgentTimeline steps={view.steps} running={running} />

        {view.status === "done" && view.summary && (
          <div className="relative mt-6 border bg-card p-4">
            <CornerMarks />
            <Eyebrow className="mb-2">Summary</Eyebrow>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{view.summary}</p>
          </div>
        )}

        {view.status === "failed" && (
          <div className="mt-6 border border-destructive/40 bg-destructive/5 p-4 text-[13px]">
            <p className="mb-1 font-medium text-destructive">Run failed</p>
            <p className="text-muted-foreground">{view.error}</p>
          </div>
        )}

        {view.pendingApproval && (
          <div className="sticky bottom-4 z-20 mt-6">
            <ApprovalCard key={view.pendingApproval.approvalId} runId={id} approval={view.pendingApproval} />
          </div>
        )}
      </section>

      {/* Right: live experiment data */}
      <aside className="border-t bg-card/40 px-4 py-6 lg:border-t-0 lg:px-5">
        <ExperimentPanel view={view} />
      </aside>
    </div>
  );
}

function StreamDot({ state }: { state: StreamState }) {
  const label = { connecting: "Connecting", live: "Live", reconnecting: "Reconnecting" }[state];
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        className={cn(
          "size-1.5",
          state === "live" ? "bg-live" : "bg-warn animate-pulse",
        )}
      />
      {label}
    </span>
  );
}

// Ticks every second while the run is active.
function Elapsed({ from, to }: { from?: number; to?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (to) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [to]);

  if (!from) return null;
  const seconds = Math.max(0, Math.round(((to ?? now) - from) / 1000));
  const text = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return <span className="text-[11px] text-muted-foreground tabular">{text}</span>;
}

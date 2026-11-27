"use client";

import { useEffect, useRef, useState } from "react";
import { Check, PanelRight, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/status-badge";
import { sendMessage } from "@/lib/api";
import { humanize } from "@/lib/format";
import { useRunStream, type StreamState } from "@/lib/use-run-stream";
import type { ThreadItem } from "@/lib/run-view";
import { cn } from "@/lib/utils";
import { AgentTurnItem } from "./agent-turn";
import { ApprovalCard } from "./approval-card";
import { ErrorCard, PullRequestCard, ResultsCard, SummaryCard, UserMessage } from "./cards";
import { ChatInput } from "./chat-input";
import { Inspector } from "./inspector";

export function ChatScreen({ id }: { id: string }) {
  const { view, state, events } = useRunStream(id);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const busy = view.status === "running" || view.status === "waiting_approval";
  const scrollRef = useAutoScroll(events.length);

  function toggleInspector() {
    // Wide screens: show/hide the column. Smaller screens: open it as a slide-over.
    if (window.matchMedia("(min-width: 1280px)").matches) setInspectorOpen(!inspectorOpen);
    else setSheetOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b px-4">
          <h1 className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{view.question || "Loading…"}</h1>
          <StatusBadge status={view.status} className="hidden sm:inline-flex" />
          <StreamDot state={state} />
          <button
            onClick={toggleInspector}
            className="grid size-7 place-items-center rounded-[5px] text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Toggle inspector"
          >
            <PanelRight className="size-4" />
          </button>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
            {view.items.map((item) => (
              <ThreadRow key={item.id} item={item} runId={id} live={busy} />
            ))}
          </div>
        </div>

        <div className="shrink-0 px-4 pb-4">
          <div className="mx-auto max-w-3xl">
            <ChatInput
              disabled={busy}
              placeholder={busy ? "The agent is working…" : "Ask a follow-up, e.g. now roll the winner out to 50%"}
              hint={`${view.mode === "demo" ? "demo project" : "your project"} · ${view.toolCount} tool calls · ↵ send`}
              onSend={(text) => sendMessage(id, text)}
            />
          </div>
        </div>
      </div>

      {inspectorOpen && (
        <aside className="hidden w-[380px] shrink-0 border-l bg-card/40 xl:block">
          <Inspector view={view} events={events} />
        </aside>
      )}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[min(380px,100vw)] p-0">
          <SheetTitle className="sr-only">Inspector</SheetTitle>
          <Inspector view={view} events={events} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ThreadRow({ item, runId, live }: { item: ThreadItem; runId: string; live: boolean }) {
  switch (item.kind) {
    case "user":
      return <UserMessage text={item.text} />;
    case "agent":
      return <AgentTurnItem turn={item.turn} live={live} />;
    case "approval":
      if (item.approval.approved === undefined) return <ApprovalCard runId={runId} approval={item.approval} />;
      return <ResolvedApproval tool={item.approval.tool} approved={item.approval.approved} />;
    case "pr":
      return <PullRequestCard pr={item.pr} />;
    case "results":
      return <ResultsCard results={item.results} />;
    case "summary":
      return <SummaryCard text={item.text} />;
    case "error":
      return <ErrorCard text={item.text} />;
  }
}

// After a human answers, the big approval card becomes one quiet line.
function ResolvedApproval({ tool, approved }: { tool: string; approved: boolean }) {
  return (
    <p className={cn("ml-9 flex items-center gap-2 text-[11px]", approved ? "text-live" : "text-destructive")}>
      {approved ? <Check className="size-3" /> : <X className="size-3" />}
      You {approved ? "approved" : "rejected"} {humanize(tool).toLowerCase()}
    </p>
  );
}

function StreamDot({ state }: { state: StreamState }) {
  const label = { connecting: "connecting", live: "live", reconnecting: "reconnecting" }[state];
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn("size-1.5", state === "live" ? "bg-live" : "animate-pulse bg-warn")} />
      {label}
    </span>
  );
}

// Keeps the thread scrolled to the newest message, unless the user scrolled up to read.
function useAutoScroll(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 160;
    if (nearBottom || count < 5) element.scrollTo({ top: element.scrollHeight });
  }, [count]);
  return ref;
}

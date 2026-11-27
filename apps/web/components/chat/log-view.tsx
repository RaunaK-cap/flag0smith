"use client";

// Every raw event of the run, like a terminal. Filter by kind, click a line to see its JSON.

import { useState } from "react";
import type { StoredEvent } from "@flagpilot/shared";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/format";
import { JsonBlock } from "./json-block";

const filters = {
  all: () => true,
  agents: (e: StoredEvent) => e.type.startsWith("agent.") || e.type === "user.message",
  tools: (e: StoredEvent) => e.type.startsWith("tool."),
  flagsmith: (e: StoredEvent) => e.type === "flagsmith.changed" || e.type === "results.updated" || e.type === "traffic.tick",
  github: (e: StoredEvent) => e.type === "pr.opened" || ("tool" in e && String(e.tool).includes("pull_request")),
  errors: (e: StoredEvent) =>
    (e.type === "tool.result" && !e.ok) || (e.type === "run.finished" && e.status === "failed"),
};

type Filter = keyof typeof filters;

// One short line per event.
function describe(event: StoredEvent): string {
  switch (event.type) {
    case "run.started":
      return event.question;
    case "user.message":
      return event.text;
    case "run.status":
    case "run.finished":
      return event.status + ("error" in event && event.error ? ` — ${event.error}` : "");
    case "agent.started":
      return `${event.agent}${event.parent ? ` ← ${event.parent}` : ""}`;
    case "agent.text":
      return `${event.agent}: ${event.delta.trim()}`;
    case "agent.finished":
      return event.agent;
    case "tool.called":
      return `${event.agent} → ${event.tool}`;
    case "tool.result":
      return `${event.tool} ${event.ok ? "ok" : "error"}`;
    case "approval.needed":
      return `${event.agent} wants ${event.tool}`;
    case "approval.resolved":
      return event.approved ? "approved" : "rejected";
    case "traffic.tick":
      return `${event.variant} ${event.conversions}/${event.exposures}`;
    case "results.updated":
      return `experiment #${event.experimentId} ${event.status}`;
    case "flagsmith.changed":
      return event.summary;
    case "pr.opened":
      return `#${event.number} ${event.title}`;
  }
}

export function LogView({ events }: { events: StoredEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<number | null>(null);

  // Text deltas arrive word by word; skip them unless looking at agents, to keep the log readable.
  const visible = events.filter(
    (e) => filters[filter](e) && (filter === "agents" || e.type !== "agent.text"),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap gap-1 border-b px-3 py-2">
        {(Object.keys(filters) as Filter[]).map((name) => (
          <button
            key={name}
            onClick={() => setFilter(name)}
            className={cn(
              "h-6 rounded-[4px] border px-2 text-[10.5px] capitalize transition-colors",
              filter === name ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <ol className="min-h-0 flex-1 overflow-y-auto py-1 font-mono text-[11px]">
        {visible.length === 0 && <li className="px-3 py-2 text-muted-foreground">No events.</li>}
        {visible.map((event) => (
          <li key={event.seq}>
            <button
              onClick={() => setOpen(open === event.seq ? null : event.seq)}
              className="flex w-full gap-2 px-3 py-0.5 text-left hover:bg-muted/60"
            >
              <span className="shrink-0 text-muted-foreground tabular">{clock(event.at)}</span>
              <span className={cn("w-28 shrink-0 truncate", typeColor(event))}>{event.type}</span>
              <span className="min-w-0 truncate text-ink-2">{describe(event)}</span>
            </button>
            {open === event.seq && (
              <div className="px-3 pb-2">
                <JsonBlock value={event} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function typeColor(event: StoredEvent) {
  if (event.type === "approval.needed") return "text-warn";
  if (event.type === "tool.result" && !event.ok) return "text-destructive";
  if (event.type === "run.finished" && event.status === "failed") return "text-destructive";
  if (event.type === "flagsmith.changed" || event.type === "pr.opened") return "text-live";
  return "text-muted-foreground";
}

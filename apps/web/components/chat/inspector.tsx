"use client";

import { useState } from "react";
import type { StoredEvent } from "@flagpilot/shared";
import { cn } from "@/lib/utils";
import type { RunView } from "@/lib/run-view";
import { LivePanel } from "./live-panel";
import { LogView } from "./log-view";

// Right-hand panel of a chat: live experiment data, or the raw event log.
export function Inspector({ view, events }: { view: RunView; events: StoredEvent[] }) {
  const [tab, setTab] = useState<"live" | "logs">("live");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-4 border-b px-4">
        {(["live", "logs"] as const).map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={cn(
              "h-full border-b text-[11px] tracking-[0.12em] uppercase transition-colors",
              tab === name ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
            {name === "logs" && <span className="ml-1.5 text-muted-foreground tabular">{events.length}</span>}
          </button>
        ))}
      </div>

      {tab === "live" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <LivePanel view={view} />
        </div>
      ) : (
        <LogView events={events} />
      )}
    </div>
  );
}

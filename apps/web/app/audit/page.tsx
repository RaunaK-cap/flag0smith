"use client";

import { useEffect, useState } from "react";
import { DataState, PageHeader } from "@/components/page";
import { AGENT_URL, flagsmith } from "@/lib/api";
import { useData } from "@/lib/use-data";

type LiveEntry = { at: number; summary: string };

export default function AuditPage() {
  const { data, error, loading, reload } = useData(flagsmith.audit);
  const live = useLiveChanges();
  const entries = data ?? [];

  return (
    <div>
      <PageHeader eyebrow="Flagsmith" title="Audit log." rest="Every change, by anyone" onRefresh={reload} loading={loading}>
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="size-1.5 animate-pulse bg-live" />
          Live: changes made in Flagsmith appear here instantly (via webhook).
        </p>
      </PageHeader>

      {live.length > 0 && (
        <ol className="border-b bg-live/5">
          {live.map((entry, index) => (
            <li key={index} className="flex gap-3 px-4 py-2 text-[12px] sm:px-8">
              <span className="text-[10.5px] text-live">LIVE</span>
              <span className="flex-1">{entry.summary}</span>
              <span className="text-[11px] text-muted-foreground tabular">{new Date(entry.at).toLocaleTimeString()}</span>
            </li>
          ))}
        </ol>
      )}

      <DataState loading={loading} error={error} empty={entries.length === 0} emptyText="Nothing in the audit log yet.">
        <ol className="divide-y border-b">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:gap-4 sm:px-8">
              <span className="w-40 shrink-0 text-[11px] text-muted-foreground tabular">
                {new Date(entry.at).toLocaleString()}
              </span>
              <span className="min-w-0 flex-1 text-[12px]">{entry.log}</span>
              <span className="text-[11px] text-muted-foreground">{entry.author}</span>
            </li>
          ))}
        </ol>
      </DataState>
    </div>
  );
}

// Listens to the backend's global feed, which forwards Flagsmith webhooks.
function useLiveChanges() {
  const [entries, setEntries] = useState<LiveEntry[]>([]);
  useEffect(() => {
    const source = new EventSource(`${AGENT_URL}/live/stream`);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.type === "flagsmith.changed") {
        setEntries((previous) => [{ at: event.at, summary: event.summary }, ...previous].slice(0, 20));
      }
    };
    return () => source.close();
  }, []);
  return entries;
}

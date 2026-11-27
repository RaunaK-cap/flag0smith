"use client";

// Opens the live SSE stream of one run and keeps all its events in state.
// EventSource reconnects by itself and sends Last-Event-ID, so nothing is missed or doubled.

import { useEffect, useMemo, useState } from "react";
import type { StoredEvent } from "@flagpilot/shared";
import { AGENT_URL } from "./api";
import { buildRunView } from "./run-view";

export type StreamState = "connecting" | "live" | "reconnecting";

export function useRunStream(runId: string) {
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [state, setState] = useState<StreamState>("connecting");

  useEffect(() => {
    setEvents([]);
    const source = new EventSource(`${AGENT_URL}/runs/${runId}/stream`);

    source.onopen = () => setState("live");
    source.onerror = () => setState("reconnecting");
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as StoredEvent;
      setEvents((previous) => {
        const last = previous[previous.length - 1];
        if (last && event.seq <= last.seq) return previous; // already have it
        return [...previous, event];
      });
    };

    return () => source.close();
  }, [runId]);

  const view = useMemo(() => buildRunView(events), [events]);
  return { view, state, events };
}

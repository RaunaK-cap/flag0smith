"use client";

// The list of chats for the sidebar. Refreshes every few seconds so statuses stay current.

import { useEffect, useState } from "react";
import { listRuns, type RunSummary } from "./api";

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
    const timer = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return { runs, error };
}

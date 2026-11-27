// All calls from the dashboard to the FlagPilot agent backend.

import type { StoredEvent } from "@flagpilot/shared";
import { readConnection } from "./connection";

export const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:4000";

export type RunSummary = {
  id: string;
  question: string;
  status: string;
  created_at: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(AGENT_URL + path, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data as T;
}

// Uses demo mode unless the user saved their own keys on the Connect page.
export function startRun(question: string) {
  const connection = readConnection();
  const body = connection
    ? { question, mode: "connected", target: connection }
    : { question, mode: "demo" };
  return request<{ runId: string }>("/runs", { method: "POST", body: JSON.stringify(body) });
}

export function listRuns() {
  return request<RunSummary[]>("/runs");
}

export function getRun(id: string) {
  return request<RunSummary & { events: StoredEvent[] }>(`/runs/${id}`);
}

export function answerApproval(runId: string, approvalId: string, approved: boolean) {
  return request(`/runs/${runId}/approvals/${approvalId}`, {
    method: "POST",
    body: JSON.stringify({ approved }),
  });
}

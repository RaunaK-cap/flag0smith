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
    headers: { "Content-Type": "application/json", ...connectionHeaders() },
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

export function sendMessage(runId: string, text: string) {
  return request(`/runs/${runId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
}

export function answerApproval(runId: string, approvalId: string, approved: boolean) {
  return request(`/runs/${runId}/approvals/${approvalId}`, {
    method: "POST",
    body: JSON.stringify({ approved }),
  });
}

// When the user connected their own project, Flagsmith pages read it through these headers.
function connectionHeaders(): Record<string, string> {
  const connection = readConnection();
  if (!connection) return {};
  return {
    "x-flagsmith-token": connection.flagsmithToken,
    "x-flagsmith-api-url": connection.flagsmithApiUrl,
    "x-flagsmith-project": String(connection.projectId),
    "x-flagsmith-environment-key": connection.environmentKey,
  };
}

// ---------- Flagsmith pages ----------

export type FlagRow = {
  id: number;
  name: string;
  type: string;
  description?: string;
  archived: boolean;
  createdAt?: string;
  tags: string[];
  enabled: boolean;
  value: string | number | boolean | null;
  variants: { id: number; key?: string; value: unknown; weight: number }[];
};

export type ExperimentRow = {
  id: number;
  name: string;
  hypothesis?: string;
  status: string;
  feature?: string | number;
  startedAt?: string;
  endedAt?: string;
  rolloutDecision?: string;
  metrics: (string | number)[];
};

export type ExperimentResults = {
  asOf: string | null;
  srmWarning?: boolean;
  variants: { key: string; exposures: number; conversions: number; delta?: number; chanceToBeatControl?: number }[];
};

export type SegmentRule = { type: string; conditions?: { property: string; operator: string; value: string }[]; rules?: SegmentRule[] };
export type SegmentRow = { id: number; name: string; description?: string; rules: SegmentRule[] };
export type EnvironmentRow = { id: number; name: string; apiKey: string; current: boolean };
export type CompareRow = {
  flag: string;
  left: { enabled: boolean; value: unknown };
  right: { enabled: boolean; value: unknown };
  different: boolean;
};
export type AuditRow = { id: number; at: string; log: string; author: string; type?: string };

export const flagsmith = {
  flags: () => request<FlagRow[]>("/flagsmith/flags"),
  experiments: () => request<ExperimentRow[]>("/flagsmith/experiments"),
  results: (id: number) => request<ExperimentResults>(`/flagsmith/experiments/${id}/results`),
  segments: () => request<SegmentRow[]>("/flagsmith/segments"),
  environments: () => request<EnvironmentRow[]>("/flagsmith/environments"),
  compare: (left: string, right: string) =>
    request<CompareRow[]>(`/flagsmith/environments/compare?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`),
  audit: () => request<AuditRow[]>("/flagsmith/audit"),
};

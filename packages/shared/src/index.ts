// Everything the agent backend streams to the dashboard is a RunEvent.
// The backend creates them, the dashboard draws them. Keep both sides in sync here.

export type AgentName =
  | "orchestrator"
  | "planner"
  | "flag_engineer"
  | "coder"
  | "analyst"
  | "janitor";

export type RunStatus = "running" | "waiting_approval" | "done" | "failed" | "cancelled";

export type VariantResult = {
  key: string;
  exposures: number;
  conversions?: number;
  delta?: number; // % vs control
  credibleInterval?: [number, number];
  chanceToBeatControl?: number; // 0..1, Flagsmith compares each variant with control
};

export type RunEvent =
  // run lifecycle
  | { type: "run.started"; question: string; mode: "demo" | "connected" }
  | { type: "run.status"; status: RunStatus }
  | { type: "run.finished"; status: RunStatus; summary?: string; error?: string }

  // agents
  | { type: "agent.started"; agent: AgentName; parent?: AgentName; task?: string }
  | { type: "agent.text"; agent: AgentName; delta: string }
  | { type: "agent.finished"; agent: AgentName; output?: string }

  // tools
  | { type: "tool.called"; agent: AgentName; callId: string; tool: string; input: unknown }
  | { type: "tool.result"; agent: AgentName; callId: string; tool: string; output: unknown; ok: boolean }

  // human approval
  | { type: "approval.needed"; approvalId: string; agent: AgentName; tool: string; input: unknown }
  | { type: "approval.resolved"; approvalId: string; approved: boolean }

  // live data for the experiment panel
  | { type: "traffic.tick"; variant: string; exposures: number; conversions: number }
  | { type: "results.updated"; experimentId: number; variants: VariantResult[]; status: string }
  | { type: "flagsmith.changed"; source: "agent" | "webhook"; summary: string; data?: unknown }
  | { type: "pr.opened"; url: string; number: number; title: string; previewUrl?: string };

// What actually goes over the wire: an event plus a sequence number and a timestamp,
// so the dashboard can replay a run in order after a page refresh.
export type StoredEvent = RunEvent & { seq: number; at: number };

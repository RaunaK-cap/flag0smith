// Turns the list of events of a run into the things the screen shows.
// It is a pure function: same events in, same view out. Easy to read and test.

import type { AgentName, RunStatus, StoredEvent, VariantResult } from "@flagpilot/shared";

export type ToolCall = {
  callId: string;
  tool: string;
  input: unknown;
  output?: unknown;
  ok?: boolean;
  at: number;
  doneAt?: number;
};

// One block in the timeline: an agent's turn with its text and tool calls.
export type AgentStep = {
  id: string;
  agent: AgentName;
  parent?: AgentName;
  task?: string;
  text: string;
  tools: ToolCall[];
  output?: string;
  finished: boolean;
  at: number;
};

export type Approval = {
  approvalId: string;
  agent: AgentName;
  tool: string;
  input: unknown;
  approved?: boolean;
  at: number;
};

export type TrafficPoint = { at: number } & Record<string, number>; // variant -> conversion rate %

export type RunView = {
  question: string;
  mode: "demo" | "connected";
  status: RunStatus;
  summary?: string;
  error?: string;
  steps: AgentStep[];
  approvals: Approval[];
  pendingApproval?: Approval;
  traffic: Record<string, { exposures: number; conversions: number }>;
  trafficSeries: TrafficPoint[];
  results?: { experimentId: number; status: string; variants: VariantResult[] };
  pullRequests: { url: string; number: number; title: string }[];
  changes: { summary: string; at: number }[];
  startedAt?: number;
  lastAt?: number;
};

export function buildRunView(events: StoredEvent[]): RunView {
  const view: RunView = {
    question: "",
    mode: "demo",
    status: "running",
    steps: [],
    approvals: [],
    traffic: {},
    trafficSeries: [],
    pullRequests: [],
    changes: [],
  };

  // The newest unfinished step of each agent receives its text and tool calls.
  const openStep = new Map<AgentName, AgentStep>();
  const toolOwner = new Map<string, ToolCall>();

  function stepFor(agent: AgentName, at: number): AgentStep {
    let step = openStep.get(agent);
    if (!step) {
      step = { id: `${agent}-${at}`, agent, text: "", tools: [], finished: false, at };
      view.steps.push(step);
      openStep.set(agent, step);
    }
    return step;
  }

  for (const event of events) {
    view.lastAt = event.at;

    switch (event.type) {
      case "run.started":
        view.question = event.question;
        view.mode = event.mode;
        view.startedAt = event.at;
        break;

      case "run.status":
        view.status = event.status;
        break;

      case "run.finished":
        view.status = event.status;
        view.summary = event.summary;
        view.error = event.error;
        break;

      case "agent.started": {
        const step = stepFor(event.agent, event.at);
        step.parent = event.parent;
        step.task = event.task ?? step.task;
        break;
      }

      case "agent.text":
        stepFor(event.agent, event.at).text += event.delta;
        break;

      case "agent.finished": {
        const step = openStep.get(event.agent);
        if (step) {
          step.finished = true;
          step.output = event.output;
          openStep.delete(event.agent);
        }
        break;
      }

      case "tool.called": {
        const call: ToolCall = {
          callId: event.callId,
          tool: event.tool,
          input: event.input,
          at: event.at,
        };
        stepFor(event.agent, event.at).tools.push(call);
        toolOwner.set(event.callId, call);
        break;
      }

      case "tool.result": {
        const call = toolOwner.get(event.callId);
        if (call) {
          call.output = event.output;
          call.ok = event.ok;
          call.doneAt = event.at;
        }
        break;
      }

      case "approval.needed":
        view.approvals.push({
          approvalId: event.approvalId,
          agent: event.agent,
          tool: event.tool,
          input: event.input,
          at: event.at,
        });
        break;

      case "approval.resolved": {
        const approval = view.approvals.find((a) => a.approvalId === event.approvalId);
        if (approval) approval.approved = event.approved;
        break;
      }

      case "traffic.tick": {
        view.traffic[event.variant] = {
          exposures: event.exposures,
          conversions: event.conversions,
        };
        view.trafficSeries.push(trafficPoint(view.traffic, event.at));
        break;
      }

      case "results.updated":
        view.results = {
          experimentId: event.experimentId,
          status: event.status,
          variants: event.variants,
        };
        break;

      case "pr.opened":
        view.pullRequests.push({ url: event.url, number: event.number, title: event.title });
        break;

      case "flagsmith.changed":
        view.changes.push({ summary: event.summary, at: event.at });
        break;
    }
  }

  view.pendingApproval = view.approvals.find((a) => a.approved === undefined);
  view.trafficSeries = view.trafficSeries.slice(-200); // keep the chart light
  return view;
}

function trafficPoint(
  traffic: RunView["traffic"],
  at: number,
): TrafficPoint {
  const point: TrafficPoint = { at };
  for (const [variant, counts] of Object.entries(traffic)) {
    point[variant] = counts.exposures ? (counts.conversions / counts.exposures) * 100 : 0;
  }
  return point;
}

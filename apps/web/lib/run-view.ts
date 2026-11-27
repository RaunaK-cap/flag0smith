// Turns the list of events of a run into what the screen shows.
// Pure function: same events in, same view out.
//
// The main output is `items`: the chat thread in the order things happened
// (your messages, agent turns with their tool calls, approvals, PRs, results, summaries).

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

export type AgentTurn = {
  id: string;
  agent: AgentName;
  parent?: AgentName;
  task?: string;
  text: string;
  tools: ToolCall[];
  finished: boolean;
  continued: boolean; // same agent again after something else appeared in between
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

export type PullRequest = { url: string; number: number; title: string; at: number };
export type Results = { experimentId: number; status: string; variants: VariantResult[]; at: number };

export type ThreadItem =
  | { kind: "user"; id: string; text: string; at: number }
  | { kind: "agent"; id: string; turn: AgentTurn }
  | { kind: "approval"; id: string; approval: Approval }
  | { kind: "pr"; id: string; pr: PullRequest }
  | { kind: "results"; id: string; results: Results }
  | { kind: "summary"; id: string; text: string; at: number }
  | { kind: "error"; id: string; text: string; at: number };

export type TrafficPoint = { at: number } & Record<string, number>; // variant -> conversion rate %

export type RunView = {
  question: string;
  mode: "demo" | "connected";
  status: RunStatus;
  items: ThreadItem[];
  pendingApproval?: Approval;
  traffic: Record<string, { exposures: number; conversions: number }>;
  trafficSeries: TrafficPoint[];
  results?: Results;
  pullRequests: PullRequest[];
  changes: { summary: string; at: number }[];
  toolCount: number;
  startedAt?: number;
  lastAt?: number;
};

export function buildRunView(events: StoredEvent[]): RunView {
  const view: RunView = {
    question: "",
    mode: "demo",
    status: "running",
    items: [],
    traffic: {},
    trafficSeries: [],
    pullRequests: [],
    changes: [],
    toolCount: 0,
  };

  const calls = new Map<string, ToolCall>();
  const seenAgent = new Set<AgentName>();
  const parents = new Map<AgentName, AgentName | undefined>();
  const tasks = new Map<AgentName, string | undefined>();

  // The agent's turn that new text/tools go into. If something else was added to the thread
  // since that agent last spoke, start a new "continued" turn so the thread stays in order.
  function turnFor(agent: AgentName, at: number): AgentTurn {
    const last = view.items[view.items.length - 1];
    if (last?.kind === "agent" && last.turn.agent === agent && !last.turn.finished) return last.turn;

    const turn: AgentTurn = {
      id: `${agent}-${at}-${view.items.length}`,
      agent,
      parent: parents.get(agent),
      task: seenAgent.has(agent) ? undefined : tasks.get(agent),
      text: "",
      tools: [],
      finished: false,
      continued: seenAgent.has(agent),
      at,
    };
    seenAgent.add(agent);
    view.items.push({ kind: "agent", id: turn.id, turn });
    return turn;
  }

  function finishTurns(agent: AgentName) {
    for (const item of view.items) {
      if (item.kind === "agent" && item.turn.agent === agent) item.turn.finished = true;
    }
  }

  for (const event of events) {
    view.lastAt = event.at;
    const id = `e${event.seq}`;

    switch (event.type) {
      case "run.started":
        view.question = event.question;
        view.mode = event.mode;
        view.startedAt = event.at;
        view.items.push({ kind: "user", id, text: event.question, at: event.at });
        break;

      case "user.message":
        view.items.push({ kind: "user", id, text: event.text, at: event.at });
        seenAgent.clear(); // a new turn of the conversation starts fresh
        break;

      case "run.status":
        view.status = event.status;
        break;

      case "run.finished":
        view.status = event.status;
        if (event.summary) view.items.push({ kind: "summary", id, text: event.summary, at: event.at });
        if (event.error) view.items.push({ kind: "error", id, text: event.error, at: event.at });
        for (const item of view.items) if (item.kind === "agent") item.turn.finished = true;
        break;

      case "agent.started":
        parents.set(event.agent, event.parent);
        tasks.set(event.agent, event.task);
        // The orchestrator's task is just the user's message, so it gets no task line.
        if (event.agent !== "orchestrator") seenAgent.delete(event.agent);
        break;

      case "agent.text": {
        turnFor(event.agent, event.at).text += event.delta;
        break;
      }

      case "agent.finished":
        finishTurns(event.agent);
        break;

      case "tool.called": {
        const call: ToolCall = { callId: event.callId, tool: event.tool, input: event.input, at: event.at };
        turnFor(event.agent, event.at).tools.push(call);
        calls.set(event.callId, call);
        view.toolCount++;
        break;
      }

      case "tool.result": {
        const call = calls.get(event.callId);
        if (call) {
          call.output = event.output;
          call.ok = event.ok;
          call.doneAt = event.at;
        }
        break;
      }

      case "approval.needed": {
        const approval: Approval = {
          approvalId: event.approvalId,
          agent: event.agent,
          tool: event.tool,
          input: event.input,
          at: event.at,
        };
        view.items.push({ kind: "approval", id, approval });
        break;
      }

      case "approval.resolved":
        for (const item of view.items) {
          if (item.kind === "approval" && item.approval.approvalId === event.approvalId) {
            item.approval.approved = event.approved;
          }
        }
        break;

      case "traffic.tick":
        view.traffic[event.variant] = { exposures: event.exposures, conversions: event.conversions };
        view.trafficSeries.push(trafficPoint(view.traffic, event.at));
        break;

      case "results.updated": {
        const results: Results = {
          experimentId: event.experimentId,
          status: event.status,
          variants: event.variants,
          at: event.at,
        };
        view.results = results;
        view.items.push({ kind: "results", id, results });
        break;
      }

      case "pr.opened": {
        const pr: PullRequest = { url: event.url, number: event.number, title: event.title, at: event.at };
        view.pullRequests.push(pr);
        view.items.push({ kind: "pr", id, pr });
        break;
      }

      case "flagsmith.changed":
        view.changes.push({ summary: event.summary, at: event.at });
        break;
    }
  }

  for (const item of view.items) {
    if (item.kind === "approval" && item.approval.approved === undefined) view.pendingApproval = item.approval;
  }
  view.trafficSeries = view.trafficSeries.slice(-200); // keep the chart light
  return view;
}

function trafficPoint(traffic: RunView["traffic"], at: number): TrafficPoint {
  const point: TrafficPoint = { at };
  for (const [variant, counts] of Object.entries(traffic)) {
    point[variant] = counts.exposures ? (counts.conversions / counts.exposures) * 100 : 0;
  }
  return point;
}

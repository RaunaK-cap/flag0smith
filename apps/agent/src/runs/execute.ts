// Runs the orchestrator agent for one run and turns everything the SDK does
// into RunEvents for the dashboard. Also handles pausing for human approval.

import { run, type RunStreamEvent, type StreamedRunResult } from "@openai/agents";
import type { AgentName, RunEvent } from "@flagpilot/shared";
import { buildAgents } from "../agents";
import { waitForApproval } from "./approvals";
import { createRunContext, type RunContext, type RunTarget } from "./context";
import { emit as storeEmit } from "./store";

const MAX_TURNS = 40;

export async function executeRun(runId: string, question: string, mode: "demo" | "connected", target: RunTarget) {
  const emit = (event: RunEvent) => storeEmit(runId, event);
  const context = createRunContext(runId, target, emit);
  const { orchestrator } = buildAgents((agent, event) => forwardEvent(agent, event, emit));

  emit({ type: "agent.started", agent: "orchestrator", task: question });

  try {
    // Tell the agent which mode it is in: fake traffic is only allowed in demo mode.
    const input = `Mode: ${mode}\n\nRequest: ${question}`;
    let result = await run(orchestrator, input, { stream: true, context, maxTurns: MAX_TURNS });
    await consume(result, "orchestrator", emit);

    // If a tool needs approval, the SDK stops and lists it in `interruptions`.
    // We ask the human, record the answer, then resume the same run.
    while (result.interruptions.length > 0) {
      emit({ type: "run.status", status: "waiting_approval" });

      for (const item of result.interruptions) {
        const approvalId = getCallId(item.rawItem) ?? crypto.randomUUID();
        emit({
          type: "approval.needed",
          approvalId,
          agent: toAgentName(item.agent.name),
          tool: item.toolName ?? "unknown",
          input: parseJson(getArguments(item.rawItem)),
        });

        const approved = await waitForApproval(runId, approvalId);
        emit({ type: "approval.resolved", approvalId, approved });
        if (approved) result.state.approve(item);
        else result.state.reject(item);
      }

      emit({ type: "run.status", status: "running" });
      result = await run(orchestrator, result.state, { stream: true, context, maxTurns: MAX_TURNS });
      await consume(result, "orchestrator", emit);
    }

    const summary = typeof result.finalOutput === "string" ? result.finalOutput : undefined;
    emit({ type: "agent.finished", agent: "orchestrator", output: summary });
    emit({ type: "run.finished", status: "done", summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit({ type: "run.finished", status: "failed", error: message });
  }
}

async function consume(result: StreamedRunResult<RunContext, any>, agent: AgentName, emit: (e: RunEvent) => void) {
  for await (const event of result) forwardEvent(agent, event, emit);
  await result.completed;
}

// Converts one SDK stream event into zero or one RunEvent.
// Used for the orchestrator AND for every sub-agent (via asTool's onStream).
export function forwardEvent(agent: AgentName, event: RunStreamEvent, emit: (e: RunEvent) => void) {
  if (event.type === "raw_model_stream_event") {
    if (event.data.type === "output_text_delta") {
      emit({ type: "agent.text", agent, delta: event.data.delta });
    }
    return;
  }

  if (event.type !== "run_item_stream_event") return;
  const item = event.item as any;

  if (event.name === "tool_called") {
    const tool = item.rawItem?.name ?? "unknown";
    // Calls to sub-agents are shown as the sub-agent starting, not as a plain tool call.
    if (isSubAgent(tool)) {
      emit({ type: "agent.started", agent: tool as AgentName, parent: agent, task: subAgentTask(item.rawItem) });
      return;
    }
    emit({
      type: "tool.called",
      agent,
      callId: item.rawItem?.callId ?? "",
      tool,
      input: parseJson(item.rawItem?.arguments),
    });
  }

  if (event.name === "tool_output") {
    const tool = item.rawItem?.name ?? "unknown";
    const output = typeof item.output === "string" ? parseJson(item.output) : item.output;
    if (isSubAgent(tool)) {
      emit({ type: "agent.finished", agent: tool as AgentName, output: String(item.output ?? "") });
      return;
    }
    emit({
      type: "tool.result",
      agent,
      callId: item.rawItem?.callId ?? "",
      tool,
      output,
      ok: !(output && typeof output === "object" && "error" in output),
    });
  }
}

const SUB_AGENTS = ["planner", "flag_engineer", "coder", "analyst", "janitor"];

function isSubAgent(name: string) {
  return SUB_AGENTS.includes(name);
}

function toAgentName(name: string): AgentName {
  return (SUB_AGENTS.includes(name) ? name : "orchestrator") as AgentName;
}

function subAgentTask(rawItem: any): string | undefined {
  const args = parseJson(rawItem?.arguments);
  return typeof args === "object" && args ? (args as any).input : undefined;
}

function getCallId(rawItem: any): string | undefined {
  return rawItem?.callId ?? rawItem?.id;
}

function getArguments(rawItem: any): string | undefined {
  return rawItem?.arguments;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

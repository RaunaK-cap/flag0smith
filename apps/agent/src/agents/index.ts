// Builds the agent team for one run.
// Sub-agents are given to the orchestrator as tools, so it stays in charge.
// onEvent receives every streamed event from every sub-agent, so the dashboard can show them live.

import type { RunStreamEvent } from "@openai/agents";
import type { AgentName } from "@flagpilot/shared";
import { orchestrator } from "./orchestrator";
import { planner } from "./planner";
import { flagEngineer } from "./flag-engineer";
import { coder } from "./coder";
import { analyst } from "./analyst";
import { janitor } from "./janitor";

type OnEvent = (agent: AgentName, event: RunStreamEvent) => void;

const team = [
  { agent: planner, description: "Design an A/B experiment: hypothesis, variants, metric, split." },
  { agent: flagEngineer, description: "Create or change anything in Flagsmith." },
  { agent: coder, description: "Change app code on GitHub and open a pull request." },
  { agent: analyst, description: "Read experiment results and give a verdict." },
  { agent: janitor, description: "End experiments, roll out winners, roll back, find stale flags." },
];

export function buildAgents(onEvent: OnEvent) {
  const subAgentTools = team.map(({ agent, description }) =>
    agent.asTool({
      toolName: agent.name,
      toolDescription: description,
      onStream: ({ event }) => onEvent(agent.name as AgentName, event),
    }),
  );

  return {
    orchestrator: orchestrator.clone({ tools: [...orchestrator.tools, ...subAgentTools] }),
  };
}

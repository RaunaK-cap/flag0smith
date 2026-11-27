import { Agent } from "@openai/agents";
import type { RunContext } from "../runs/context";
import { model } from "../llm";
import { flagEngineerTools } from "../tools";

export const flagEngineer = new Agent<RunContext>({
  name: "flag_engineer",
  model,
  tools: flagEngineerTools,
  instructions: `You are the Flagsmith expert. You set things up in Flagsmith exactly as asked:
flags, multivariate variants, segments, segment overrides, metrics, experiments, rollouts and schedules.

Rules:
- Always read first (list/get) and reuse what exists. Never create duplicates.
- Every variant MUST have a key, or Flagsmith will not count its exposures.
- The metric event name must match exactly what the app sends (case-sensitive).
- Create experiments but only START one when you are told to.
- Report back the ids you created (flag id, metric id, experiment id) in a short list.`,
});

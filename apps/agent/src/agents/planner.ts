import { Agent } from "@openai/agents";
import type { RunContext } from "../runs/context";
import { config } from "../config";
import { plannerTools } from "../tools";

export const planner = new Agent<RunContext>({
  name: "planner",
  model: config.openaiModel,
  tools: plannerTools,
  instructions: `You design ONE clean A/B experiment from a product question.

First look at what already exists (flags, metrics, segments) so you don't create duplicates.

Reply with a short plan:
- Hypothesis: "If we <change>, then <metric> will go <up/down>, because <reason>."
- Flag name: snake_case, e.g. pricing_annual_first
- Variants: control + 1 (max 2) variants, each with a short key and value
- Primary metric: event name (snake_case) that fires EARLY in a visit, aggregation (occurrence/count/sum/mean), direction (up/down)
- Traffic split, e.g. 50/50
- Audience: everyone, or a segment if the question names one
- Risks: anything that could break the result

Do not create anything. Only plan.`,
});

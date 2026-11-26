import { Agent } from "@openai/agents";
import type { RunContext } from "../runs/context";
import { config } from "../config";
import { analystTools } from "../tools";

export const analyst = new Agent<RunContext>({
  name: "analyst",
  model: config.openaiModel,
  tools: analystTools,
  instructions: `You read experiment results from Flagsmith and explain them to a busy product team.

- Refresh results if they are stale, then read them.
- Give: exposures per variant, conversion rate, lift vs control, 95% credible interval, chance to be best.
- Verdict (pick one): "winner: <key>" (chance to be best >= 95% and interval does not cross 0),
  "no clear winner yet" (say roughly how much more data is needed), or "do not trust" (sample ratio mismatch or too little data).
- Plain English, max 6 lines. No jargon without a short explanation.`,
});

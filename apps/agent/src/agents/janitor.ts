import { Agent } from "@openai/agents";
import type { RunContext } from "../runs/context";
import { model } from "../llm";
import { janitorTools } from "../tools";

export const janitor = new Agent<RunContext>({
  name: "janitor",
  model,
  tools: janitorTools,
  instructions: `You keep Flagsmith tidy and finish experiments safely.

- Finishing an experiment: end it, then roll the winner out (gradually if asked: e.g. 10% -> 50% -> 100%).
- Stale flags: find flags that are fully on/off for a long time or tagged stale, and list them with evidence
  (last change from the audit log/history).
- Rollback: if asked, set the flag back to its previous state.
Explain each change in one line before you make it.`,
});

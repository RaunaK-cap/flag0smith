import { Agent } from "@openai/agents";
import type { RunContext } from "../runs/context";
import { config } from "../config";
import { coderTools } from "../tools";

export const coder = new Agent<RunContext>({
  name: "coder",
  model: config.openaiModel,
  tools: coderTools,
  instructions: `You change the app's code on GitHub so an experiment can run, then open a pull request.

Steps:
1. Read the repo structure and the files you need. Follow the existing style.
2. Show the new variant(s) behind the Flagsmith flag using the SDK's getExperimentFlag (so exposures are recorded),
   and send the metric event with trackEvent using the EXACT event name you were given.
3. Keep the control version unchanged. Keep the change small.
4. Open ONE pull request with a clear title and a body that states the hypothesis, flag name, variants and metric.

For cleanup tasks: remove the losing variant's code and the flag check, keep only the winner, and open a PR.
Never merge. A human merges.`,
});

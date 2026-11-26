// Small helper so every tool looks the same and never crashes the run.
// If the tool throws, the agent gets { error } back and can decide what to do.

import { tool, type RunContext as SdkRunContext } from "@openai/agents";
import type { z } from "zod";
import type { RunContext } from "../runs/context";

type ToolSpec<T extends z.ZodObject<any>> = {
  name: string;
  description: string;
  parameters: T;
  // true = a human must approve before this runs (anything that changes Flagsmith or GitHub)
  needsApproval?: boolean;
  run: (input: z.infer<T>, ctx: RunContext) => Promise<unknown>;
};

export function defineTool<T extends z.ZodObject<any>>(spec: ToolSpec<T>) {
  return tool({
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters as any, // the SDK's generic types are stricter than we need here
    needsApproval: spec.needsApproval ?? false,
    execute: async (input: any, runContext?: SdkRunContext<RunContext>) => {
      try {
        return await spec.run(input, runContext!.context);
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });
}

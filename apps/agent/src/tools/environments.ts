import { z } from "zod";
import { isDefault } from "./flags";
import { defineTool } from "./helpers";
import { listAll } from "./list";
import { E, P } from "./paths";

function toEnvironment(raw: any) {
  return {
    id: raw.id,
    name: raw.name,
    api_key: raw.api_key,
  };
}

export const listEnvironments = defineTool({
  name: "list_environments",
  description: "List environments in this project and their client-side keys.",
  parameters: z.object({}),
  run: async (_input, ctx) => {
    const rows = await listAll(ctx, `environments/?project=${ctx.target.projectId}`);
    return rows.map(toEnvironment);
  },
});

export const compareEnvironments = defineTool({
  name: "compare_environments",
  description:
    "Compare default flag values and enabled states between this environment and another.",
  parameters: z.object({ otherEnvironmentKey: z.string().min(1) }),
  run: async ({ otherEnvironmentKey }, ctx) => {
    const otherKey = encodeURIComponent(otherEnvironmentKey);
    const [features, current, other] = await Promise.all([
      listAll(ctx, `${P(ctx)}/features/`, Infinity),
      listAll(ctx, `${E(ctx)}/featurestates/`, Infinity),
      listAll(ctx, `environments/${otherKey}/featurestates/`, Infinity),
    ]);
    const currentById = defaultStates(current);
    const otherById = defaultStates(other);
    const differences = [];
    for (const flag of features) {
      const thisEnv = currentById.get(flag.id) ?? null;
      const otherEnv = otherById.get(flag.id) ?? null;
      if (thisEnv?.enabled !== otherEnv?.enabled || thisEnv?.value !== otherEnv?.value) {
        differences.push({
          flag: flag.name,
          thisEnv,
          otherEnv,
        });
        if (differences.length === 50) {
          break;
        }
      }
    }
    return differences;
  },
});

function defaultStates(rows: any[]) {
  const states = new Map<number, { enabled: boolean; value: any }>();
  for (const row of rows) {
    if (isDefault(row)) {
      states.set(row.feature, { enabled: row.enabled, value: row.feature_state_value });
    }
  }
  return states;
}

export const cloneEnvironment = defineTool({
  name: "clone_environment",
  description: "Clone this environment and its flag states under a new name.",
  parameters: z.object({ name: z.string().min(1) }),
  needsApproval: true,
  run: async ({ name }, ctx) => {
    const data = await ctx.flagsmith.post(`${E(ctx)}/clone/`, { name });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Cloned the environment as ${name}.`,
    });
    return toEnvironment(data);
  },
});

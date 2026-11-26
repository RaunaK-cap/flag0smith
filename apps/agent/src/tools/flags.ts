import { z } from "zod";
import type { RunContext } from "../runs/context";
import { defineTool } from "./helpers";
import { listAll } from "./list";
import { E, P } from "./paths";

export const scalar = z.union([z.string(), z.number(), z.boolean()]);

function toFlag(raw: any) {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    description: raw.description,
    is_archived: raw.is_archived,
    default_enabled: raw.default_enabled,
    initial_value: raw.initial_value,
  };
}

function toWeight(raw: any) {
  return {
    id: raw.id,
    multivariate_feature_option: raw.multivariate_feature_option,
    percentage_allocation: raw.percentage_allocation,
  };
}

function toState(raw: any) {
  let identity = raw.identity;
  if (identity && typeof identity === "object") {
    identity = { id: identity.id };
  }

  return {
    id: raw.id,
    feature: raw.feature,
    enabled: raw.enabled,
    feature_state_value: raw.feature_state_value,
    feature_segment: raw.feature_segment,
    identity,
    multivariate_feature_state_values: raw.multivariate_feature_state_values
      ?.slice(0, 50)
      .map(toWeight),
  };
}

export { toFlag as feature, toState as state };

function toVariant(raw: any) {
  let value = raw.string_value;
  if (raw.type === "bool") {
    value = raw.boolean_value;
  } else if (raw.type === "int") {
    value = raw.integer_value;
  }

  return {
    id: raw.id,
    key: raw.key,
    value,
    weight: raw.default_percentage_allocation,
  };
}

export function isDefault(row: any) {
  return row.feature_segment == null && row.identity == null;
}

async function defaultState(ctx: RunContext, featureId: number) {
  const path = `${E(ctx)}/featurestates/?feature=${featureId}`;
  const states = await listAll(ctx, path, Infinity);
  const row = states.find((row) => row.feature === featureId && isDefault(row));
  return row ? toState(row) : null;
}

export const listFlags = defineTool({
  name: "list_flags",
  description: "List project flags, optionally filtered by name.",
  parameters: z.object({ search: z.string().optional() }),
  run: async ({ search }, ctx) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const rows = await listAll(ctx, `${P(ctx)}/features/${query}`);
    return rows.map(toFlag);
  },
});

export const getFlag = defineTool({
  name: "get_flag",
  description: "Read a flag, its default state in this environment, and its multivariate options.",
  parameters: z.object({ featureId: z.number().int() }),
  run: async ({ featureId }, ctx) => {
    const path = `${P(ctx)}/features/${featureId}/`;
    const [data, envState, variants] = await Promise.all([
      ctx.flagsmith.get(path),
      defaultState(ctx, featureId),
      listAll(ctx, path + "mv-options/"),
    ]);
    return {
      feature: toFlag(data),
      state: envState,
      variants: variants.map(toVariant),
    };
  },
});

export const createFlag = defineTool({
  name: "create_flag",
  description: "Create a project flag with its initial value and default enabled state.",
  parameters: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(["STANDARD", "MULTIVARIATE"]),
    initialValue: z.string().optional(),
    defaultEnabled: z.boolean(),
  }),
  needsApproval: true,
  run: async ({ name, description, type, initialValue, defaultEnabled }, ctx) => {
    const data = await ctx.flagsmith.post(`${P(ctx)}/features/`, {
      name,
      description,
      type,
      initial_value: initialValue,
      default_enabled: defaultEnabled,
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Created flag ${name}.`,
    });
    return toFlag(data);
  },
});

// Only the mv-options endpoint accepts writable variant keys.
export const addVariant = defineTool({
  name: "add_variant",
  description:
    "Add a keyed string variant to a multivariate flag. " +
    "Weight is its default allocation percentage.",
  parameters: z.object({
    featureId: z.number().int(),
    key: z.string().min(1),
    value: z.string(),
    weight: z.number().min(0).max(100),
  }),
  needsApproval: true,
  run: async ({ featureId, key, value, weight }, ctx) => {
    const data = await ctx.flagsmith.post(`${P(ctx)}/features/${featureId}/mv-options/`, {
      feature: featureId,
      key,
      type: "unicode",
      string_value: value,
      default_percentage_allocation: weight,
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Added variant ${key} to flag ${featureId}.`,
    });
    return toVariant(data);
  },
});

// Legacy environments update the state ID, which differs from the project feature ID.
export const updateFlagState = defineTool({
  name: "update_flag_state",
  description: "Change a flag's default enabled state or value in a legacy environment.",
  parameters: z.object({
    featureId: z.number().int(),
    enabled: z.boolean().optional(),
    value: scalar.optional(),
  }),
  needsApproval: true,
  run: async ({ featureId, enabled, value }, ctx) => {
    if (enabled === undefined && value === undefined) {
      throw new Error("Supply enabled or value.");
    }
    const current = await defaultState(ctx, featureId);
    if (!current) {
      throw new Error(`No default state for flag ${featureId} in this environment.`);
    }
    const data = await ctx.flagsmith.patch(`${E(ctx)}/featurestates/${current.id}/`, {
      enabled,
      feature_state_value: value,
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Updated the default state of flag ${featureId}.`,
    });
    return {
      id: current.id,
      feature: featureId,
      enabled: data.enabled,
      value: value ?? current.feature_state_value,
    };
  },
});

export const archiveFlag = defineTool({
  name: "archive_flag",
  description: "Archive a project flag across environments.",
  parameters: z.object({ featureId: z.number().int() }),
  needsApproval: true,
  run: async ({ featureId }, ctx) => {
    const data = await ctx.flagsmith.patch(`${P(ctx)}/features/${featureId}/`, {
      is_archived: true,
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Archived flag ${featureId}.`,
    });
    return toFlag(data);
  },
});

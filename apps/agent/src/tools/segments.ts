import { z } from "zod";
import type { RunContext } from "../runs/context";
import { defineTool } from "./helpers";
import { listAll } from "./list";
import { E, P } from "./paths";

function toSegment(raw: any) {
  return { id: raw.id, name: raw.name };
}

export { toSegment as segment };

const condition = z.object({
  property: z.string(),
  operator: z.string().min(1),
  value: z.string(),
});
const overrideValue = z.union([z.string(), z.number().int(), z.boolean()]);

export function segmentRules(match: "all" | "any", conditions: z.infer<typeof condition>[]) {
  const group = {
    type: match.toUpperCase(),
    conditions,
    rules: [],
  };
  return [
    {
      type: "ALL",
      conditions: [],
      rules: [group],
    },
  ];
}

function typedValue(value?: z.infer<typeof overrideValue>) {
  if (typeof value === "boolean") {
    return { type: "bool", boolean_value: value };
  }
  if (typeof value === "number") {
    return { type: "int", integer_value: value };
  }
  return { type: "unicode", string_value: value ?? null };
}

export async function createOverride(
  ctx: RunContext,
  featureId: number,
  segmentId: number,
  enabled: boolean,
  value?: z.infer<typeof overrideValue>,
) {
  const row = await ctx.flagsmith.post(`${E(ctx)}/features/${featureId}/create-segment-override/`, {
    feature_segment: { segment: segmentId },
    enabled,
    feature_state_value: typedValue(value),
  });
  ctx.emit({
    type: "flagsmith.changed",
    source: "agent",
    summary: `Created an override for flag ${featureId} in segment ${segmentId}.`,
  });
  return {
    stateId: row.id,
    associationId: row.feature_segment?.id,
    segmentId,
    enabled,
  };
}

export const listSegments = defineTool({
  name: "list_segments",
  description: "List the project's targeting segments.",
  parameters: z.object({}),
  run: async (_input, ctx) => {
    const rows = await listAll(ctx, `${P(ctx)}/segments/`);
    return rows.map(toSegment);
  },
});

export const createSegment = defineTool({
  name: "create_segment",
  description:
    "Create a project segment that matches all or any of the supplied trait conditions.",
  parameters: z.object({
    name: z.string().min(1),
    match: z.enum(["all", "any"]),
    conditions: condition.array().min(1),
  }),
  needsApproval: true,
  run: async ({ name, match, conditions }, ctx) => {
    const data = await ctx.flagsmith.post(`${P(ctx)}/segments/`, {
      name,
      rules: segmentRules(match, conditions),
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Created segment ${name}.`,
    });
    return toSegment(data);
  },
});

export const addSegmentOverride = defineTool({
  name: "add_segment_override",
  description:
    "Set a flag's enabled state and optional value for members of a segment in this environment.",
  parameters: z.object({
    featureId: z.number().int(),
    segmentId: z.number().int(),
    enabled: z.boolean(),
    value: overrideValue.optional(),
  }),
  needsApproval: true,
  run: async ({ featureId, segmentId, enabled, value }, ctx) =>
    createOverride(ctx, featureId, segmentId, enabled, value),
});

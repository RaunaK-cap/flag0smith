import { z } from "zod";
import type { RunContext } from "../runs/context";
import { defineTool } from "./helpers";
import { listAll } from "./list";
import { P } from "./paths";
import { createOverride, segmentRules } from "./segments";

const rolloutName = (featureId: number) => `flagpilot-rollout-${featureId}`;

async function findSegment(ctx: RunContext, name: string) {
  const segments = await listAll(ctx, `${P(ctx)}/segments/`, Infinity);
  return segments.find((s) => s.name === name);
}

async function enableOverride(ctx: RunContext, featureId: number, segmentId: number) {
  const filter = `environment=${ctx.target.environmentId}&feature=${featureId}`;
  const associations = await listAll(ctx, `features/feature-segments/?${filter}`, Infinity);
  const association = associations.find((row) => row.segment === segmentId);
  if (!association) {
    await createOverride(ctx, featureId, segmentId, true);
    return;
  }
  const path = `features/featurestates/?${filter}&feature_segment=${association.id}`;
  const states = await listAll(ctx, path, 2);
  if (states.length !== 1) {
    throw new Error(
      `Expected one state for rollout association ${association.id}, found ${states.length}.`,
    );
  }
  if (states[0].enabled) {
    return;
  }
  await ctx.flagsmith.patch(`features/featurestates/${states[0].id}/`, { enabled: true });
  ctx.emit({
    type: "flagsmith.changed",
    source: "agent",
    summary: `Enabled the rollout override for flag ${featureId}.`,
  });
}

export const rolloutToPercentage = defineTool({
  name: "rollout_to_percentage",
  description:
    "Set the percentage split on a project's rollout segment and " +
    "enable its flag override in this environment.",
  parameters: z.object({ featureId: z.number().int(), percentage: z.number().min(0).max(100) }),
  needsApproval: true,
  run: async ({ featureId, percentage }, ctx) => {
    const name = rolloutName(featureId);
    const existing = await findSegment(ctx, name);
    const condition = {
      operator: "PERCENTAGE_SPLIT",
      property: "",
      value: String(percentage),
    };
    const body = { name, rules: segmentRules("all", [condition]) };
    const path = `${P(ctx)}/segments/`;
    let data;
    if (existing) {
      data = await ctx.flagsmith.put(`${path}${existing.id}/`, body);
    } else {
      data = await ctx.flagsmith.post(path, body);
    }
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Set the rollout segment for flag ${featureId} to ${percentage}%.`,
    });
    await enableOverride(ctx, featureId, data.id);
    return {
      featureId,
      segmentId: data.id,
      percentage,
    };
  },
});

export const removeRollout = defineTool({
  name: "remove_rollout",
  description: "Remove a flag's project-wide rollout segment and its associated overrides.",
  parameters: z.object({ featureId: z.number().int() }),
  needsApproval: true,
  run: async ({ featureId }, ctx) => {
    const existing = await findSegment(ctx, rolloutName(featureId));
    if (!existing) {
      return { featureId, removed: false };
    }
    await ctx.flagsmith.delete(`${P(ctx)}/segments/${existing.id}/`);
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Removed the rollout segment for flag ${featureId}.`,
    });
    return {
      featureId,
      segmentId: existing.id,
      removed: true,
    };
  },
});

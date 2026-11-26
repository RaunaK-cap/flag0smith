import type { VariantResult } from "@flagpilot/shared";
import { z } from "zod";
import { FlagsmithError } from "../clients/flagsmith";
import type { RunContext } from "../runs/context";
import { defineTool } from "./helpers";
import { listAll } from "./list";
import { E } from "./paths";

const aggregation = z.enum(["occurrence", "count", "sum", "mean"]);
const direction = z.enum(["up", "down", "informational"]);

function toMetric(raw: any) {
  return {
    id: raw.id,
    name: raw.name,
    aggregation: raw.aggregation,
    direction: raw.direction,
    event: raw.definition?.event,
  };
}

function toExperiment(raw: any) {
  let feature = raw.feature;
  if (feature && typeof feature === "object") {
    feature = { id: feature.id, name: feature.name };
  }
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    feature,
  };
}

const experimentInput = z.object({ experimentId: z.number().int() });
const percentage = z.number().min(0).max(100);

function experimentPath(ctx: RunContext, id: number) {
  return `${E(ctx)}/experiments/${id}/`;
}

export const listMetrics = defineTool({
  name: "list_metrics",
  description:
    "List metric IDs, event names, aggregations, and beneficial directions in this environment.",
  parameters: z.object({}),
  run: async (_input, ctx) => {
    const rows = await listAll(ctx, `${E(ctx)}/experiment-metrics/`);
    return rows.map(toMetric);
  },
});

export const createMetric = defineTool({
  name: "create_metric",
  description: "Define an experiment metric for an exact, case-sensitive event name.",
  parameters: z.object({
    name: z.string().min(1),
    event: z.string().min(1),
    aggregation,
    direction,
  }),
  needsApproval: true,
  run: async ({ name, event, aggregation, direction }, ctx) => {
    const data = await ctx.flagsmith.post(`${E(ctx)}/experiment-metrics/`, {
      name,
      aggregation,
      direction,
      definition: { version: 1, event },
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Created metric ${name} for event ${event}.`,
    });
    return toMetric(data);
  },
});

export const listExperiments = defineTool({
  name: "list_experiments",
  description: "List experiments in this environment, optionally filtered by lifecycle status.",
  parameters: z.object({
    status: z.enum(["created", "running", "paused", "completed"]).optional(),
  }),
  run: async ({ status }, ctx) => {
    const query = status ? `?status=${status}` : "";
    const rows = await listAll(ctx, `${E(ctx)}/experiments/${query}`);
    return rows.map(toExperiment);
  },
});

function toAudience(raw: any) {
  if (raw == null) {
    return raw;
  }
  return {
    match: raw.match,
    segments: raw.segments?.map((segment: any) => ({ id: segment.id, name: segment.name })),
    segment_ids: raw.segment_ids,
  };
}

function toRollout(raw: any) {
  if (raw == null) {
    return raw;
  }
  const value = raw.feature_state_value;
  return {
    enabled: raw.enabled,
    rollout_percentage: raw.rollout_percentage,
    feature_state_value: value && { type: value.type, value: value.value },
    multivariate_feature_state_values: raw.multivariate_feature_state_values?.map((row: any) => ({
      multivariate_feature_option: row.multivariate_feature_option,
      percentage_allocation: row.percentage_allocation,
    })),
    audience: toAudience(raw.audience),
  };
}

function toExperimentDetail(raw: any) {
  return {
    ...toExperiment(raw),
    hypothesis: raw.hypothesis,
    metrics: raw.metrics?.map((row: any) => ({
      metric: row.metric,
      metric_name: row.metric_name,
      expected_direction: row.expected_direction,
    })),
    experiment_rollout: toRollout(raw.experiment_rollout),
    rollout_decision: raw.rollout_decision,
    rollout_variant: raw.rollout_variant,
  };
}

export const getExperiment = defineTool({
  name: "get_experiment",
  description:
    "Inspect an experiment's hypothesis, rollout, attached metrics, and current status.",
  parameters: experimentInput,
  run: async ({ experimentId }, ctx) => {
    const data = await ctx.flagsmith.get(experimentPath(ctx, experimentId));
    return toExperimentDetail(data);
  },
});

async function attachedMetric(ctx: RunContext, id: number) {
  const definition = await ctx.flagsmith.get(`${E(ctx)}/experiment-metrics/${id}/`);
  return {
    metric: id,
    expected_direction: definition.direction === "down" ? "decrease" : "increase",
  };
}

export const createExperiment = defineTool({
  name: "create_experiment",
  description:
    "Create an experiment on a multivariate flag. " +
    "Treatment weights split enrolled visitors and the remainder receives control.",
  parameters: z.object({
    featureId: z.number().int(),
    name: z.string().min(1),
    hypothesis: z.string().min(1),
    metricIds: z.number().int().array(),
    controlValue: z.string(),
    rolloutPercentage: percentage.optional(),
    variants: z.array(z.object({ optionId: z.number().int(), percentage })).min(1),
  }),
  needsApproval: true,
  run: async (input, ctx) => {
    const { featureId, name, hypothesis, metricIds, controlValue, rolloutPercentage, variants } =
      input;
    const metrics = await Promise.all(metricIds.map((id) => attachedMetric(ctx, id)));
    const weights = variants.map((variant) => ({
      multivariate_feature_option: variant.optionId,
      percentage_allocation: variant.percentage,
    }));
    const data = await ctx.flagsmith.post(`${E(ctx)}/experiments/`, {
      feature: featureId,
      name,
      hypothesis,
      metrics,
      experiment_rollout: {
        enabled: true,
        rollout_percentage: rolloutPercentage ?? 100,
        feature_state_value: { type: "string", value: controlValue },
        multivariate_feature_state_values: weights,
      },
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Created experiment ${name}.`,
    });
    return toExperiment(data);
  },
});

export const startExperiment = defineTool({
  name: "start_experiment",
  description: "Start a new experiment or resume a paused experiment.",
  parameters: experimentInput,
  needsApproval: true,
  run: async ({ experimentId }, ctx) => {
    const data = await ctx.flagsmith.post(experimentPath(ctx, experimentId) + "start/");
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Started experiment ${experimentId}.`,
    });
    return toExperiment(data);
  },
});

export const pauseExperiment = defineTool({
  name: "pause_experiment",
  description: "Pause a running experiment.",
  parameters: experimentInput,
  needsApproval: true,
  run: async ({ experimentId }, ctx) => {
    const data = await ctx.flagsmith.post(experimentPath(ctx, experimentId) + "pause/");
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Paused experiment ${experimentId}.`,
    });
    return toExperiment(data);
  },
});

export const completeExperiment = defineTool({
  name: "complete_experiment",
  description:
    "End an experiment and apply its outcome. Supply a variant option ID when choosing a variant.",
  parameters: experimentInput.extend({
    decision: z.enum(["control", "variant", "disable"]),
    variantOptionId: z.number().int().optional(),
  }),
  needsApproval: true,
  run: async ({ experimentId, decision, variantOptionId }, ctx) => {
    if (decision === "variant" && variantOptionId === undefined) {
      throw new Error("Supply the winning variantOptionId.");
    }
    const data = await ctx.flagsmith.post(experimentPath(ctx, experimentId) + "complete/", {
      rollout_decision: decision,
      rollout_variant: decision === "variant" ? variantOptionId : undefined,
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Completed experiment ${experimentId} with decision ${decision}.`,
    });
    return toExperiment(data);
  },
});

export const refreshResults = defineTool({
  name: "refresh_results",
  description:
    "Queue a results refresh after traffic arrives. " +
    "Flagsmith allows one refresh every five minutes.",
  parameters: experimentInput,
  needsApproval: false,
  run: async ({ experimentId }, ctx) => {
    try {
      await ctx.flagsmith.post(experimentPath(ctx, experimentId) + "results/refresh/");
    } catch (error) {
      if (error instanceof FlagsmithError && error.status === 429) {
        return { ok: false, reason: "cooldown" };
      }
      throw error;
    }
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Queued a results refresh for experiment ${experimentId}.`,
    });
    return { ok: true };
  },
});

function summarizeVariant(key: string, counts: any, comparison: any) {
  return {
    key,
    exposures: counts?.n,
    conversions: counts?.sum,
    rate: counts?.n ? counts.sum / counts.n : null,
    lift: comparison?.lift,
    ciLow: comparison?.ci_low,
    ciHigh: comparison?.ci_high,
    chanceToWin: comparison?.chance_to_win,
  };
}

function summarizeMetric(raw: any) {
  const variants = Object.entries(raw.variants ?? {}).map(([key, counts]) =>
    summarizeVariant(key, counts, raw.inference?.[key]),
  );
  return { metricId: raw.metric_id, variants };
}

function isEnoughData(metric: ReturnType<typeof summarizeMetric>) {
  const treatments = metric.variants.filter((variant) => variant.key !== "control");
  return treatments.length > 0 && treatments.every((variant) => variant.lift != null);
}

function toDashboardVariant(variant: ReturnType<typeof summarizeVariant>): VariantResult {
  let credibleInterval: [number, number] | undefined;
  if (variant.ciLow != null && variant.ciHigh != null) {
    credibleInterval = [variant.ciLow * 100, variant.ciHigh * 100];
  }
  return {
    key: variant.key,
    exposures: variant.exposures,
    conversions: variant.conversions,
    delta: variant.lift == null ? undefined : variant.lift * 100,
    credibleInterval,
    chanceToBeatControl: variant.chanceToWin,
  };
}

export const getResults = defineTool({
  name: "get_results",
  description:
    "Read the latest results, sample ratio warning, and " +
    "pairwise lift and probability against control.",
  parameters: experimentInput,
  run: async ({ experimentId }, ctx) => {
    const path = experimentPath(ctx, experimentId);
    const [info, data] = await Promise.all([
      ctx.flagsmith.get(path),
      ctx.flagsmith.get(path + "results/"),
    ]);
    const snapshot = data?.results;
    const payload = snapshot?.payload;
    const rows: any[] = payload?.metrics ?? [];
    const metrics = rows.map(summarizeMetric);
    const variants = metrics[0]?.variants ?? [];

    ctx.emit({
      type: "results.updated",
      experimentId,
      status: info.status,
      variants: variants.map(toDashboardVariant),
    });

    let note;
    if (!payload) {
      note = "No results snapshot yet.";
    } else if (!metrics.length || !metrics.every(isEnoughData)) {
      note = "Insufficient data for a treatment comparison.";
    }
    return {
      status: info.status,
      asOf: snapshot?.as_of ?? null,
      isFinal: snapshot?.is_final ?? false,
      srmWarning: payload?.srm_p_value != null && payload.srm_p_value < 0.001,
      metrics,
      note,
    };
  },
});

function toWarehouseConnection(raw: any) {
  return {
    id: raw.id,
    warehouse_type: raw.warehouse_type,
    status: raw.status,
    name: raw.name,
    total_events_received: raw.total_events_received,
    last_event_received_at: raw.last_event_received_at,
  };
}

export const warehouseStatus = defineTool({
  name: "warehouse_status",
  description: "Check the environment's warehouse connection and the latest event ingestion time.",
  parameters: z.object({}),
  run: async (_input, ctx) => {
    const rows = await listAll(ctx, `${E(ctx)}/warehouse-connections/`);
    return rows.map(toWarehouseConnection);
  },
});

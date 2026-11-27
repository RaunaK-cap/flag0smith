// Read-only Flagsmith data for the dashboard's Flagsmith pages (Flags, Experiments, Segments, ...).
// Demo mode uses the server's keys. "Connect your own" sends its keys in x-flagsmith-* headers,
// which are used for this one request and never saved.

import { Router, type Request, type Response } from "express";
import { config } from "../config";
import { createRunContext, type RunContext, type RunTarget } from "../runs/context";
import { listAll } from "../tools/list";
import { E, P } from "../tools/paths";

export const flagsmithRouter = Router();

function contextFrom(req: Request): RunContext {
  const token = req.header("x-flagsmith-token");
  const target: RunTarget = token
    ? {
        ...config.demo,
        flagsmithToken: token,
        flagsmithApiUrl: req.header("x-flagsmith-api-url") || config.demo.flagsmithApiUrl,
        projectId: Number(req.header("x-flagsmith-project")),
        environmentKey: req.header("x-flagsmith-environment-key") ?? "",
        githubToken: "",
        githubRepo: "",
      }
    : config.demo;
  return createRunContext("dashboard", target, () => {});
}

// Wraps a handler so errors become a JSON { error } instead of crashing.
function handle(load: (ctx: RunContext, req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    const ctx = contextFrom(req);
    if (!ctx.target.flagsmithToken) {
      return res.status(400).json({ error: "No Flagsmith key. Add one on the Connect page or in the server .env." });
    }
    try {
      res.json(await load(ctx, req));
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
    }
  };
}

flagsmithRouter.get(
  "/flagsmith/flags",
  handle(async (ctx) => {
    const [features, states, tags] = await Promise.all([
      listAll(ctx, `${P(ctx)}/features/`, 200),
      listAll(ctx, `${E(ctx)}/featurestates/`, 500),
      listAll(ctx, `${P(ctx)}/tags/`, 200),
    ]);
    const tagNames = new Map(tags.map((tag: any) => [tag.id, tag.label]));

    return features.map((feature: any) => {
      // The environment default state (not a segment or identity override).
      const state = states.find(
        (s: any) => s.feature === feature.id && s.feature_segment == null && s.identity == null,
      );
      return {
        id: feature.id,
        name: feature.name,
        type: feature.type,
        description: feature.description,
        archived: feature.is_archived ?? false,
        createdAt: feature.created_date,
        tags: (feature.tags ?? []).map((id: number) => tagNames.get(id) ?? String(id)),
        enabled: state?.enabled ?? feature.default_enabled ?? false,
        value: state?.feature_state_value ?? feature.initial_value ?? null,
        variants: (feature.multivariate_options ?? []).map((option: any) => ({
          id: option.id,
          key: option.key,
          value: option.string_value ?? option.integer_value ?? option.boolean_value,
          weight: option.default_percentage_allocation,
        })),
      };
    });
  }),
);

flagsmithRouter.get(
  "/flagsmith/experiments",
  handle(async (ctx) => {
    const experiments = await listAll(ctx, `${E(ctx)}/experiments/`, 100);
    return experiments.map((experiment: any) => ({
      id: experiment.id,
      name: experiment.name,
      hypothesis: experiment.hypothesis,
      status: experiment.status,
      feature: typeof experiment.feature === "object" ? experiment.feature?.name : experiment.feature,
      startedAt: experiment.started_at,
      endedAt: experiment.ended_at,
      rolloutDecision: experiment.rollout_decision,
      metrics: (experiment.metrics ?? []).map((m: any) => m.metric_name ?? m.metric),
    }));
  }),
);

flagsmithRouter.get(
  "/flagsmith/experiments/:id/results",
  handle(async (ctx, req) => {
    const data = await ctx.flagsmith.get(`${E(ctx)}/experiments/${Number(req.params.id)}/results/`);
    const payload = data?.results?.payload;
    const metric = payload?.metrics?.[0];
    if (!metric) return { asOf: data?.results?.as_of ?? null, variants: [] };

    return {
      asOf: data.results.as_of,
      srmWarning: payload.srm_p_value != null && payload.srm_p_value < 0.001,
      variants: Object.entries(metric.variants).map(([key, counts]: [string, any]) => {
        const inference = metric.inference?.[key];
        return {
          key,
          exposures: counts.n,
          conversions: counts.sum,
          delta: inference ? inference.lift * 100 : undefined,
          chanceToBeatControl: inference?.chance_to_win,
        };
      }),
    };
  }),
);

flagsmithRouter.get(
  "/flagsmith/segments",
  handle(async (ctx) => {
    const segments = await listAll(ctx, `${P(ctx)}/segments/`, 200);
    return segments.map((segment: any) => ({
      id: segment.id,
      name: segment.name,
      description: segment.description,
      rules: segment.rules ?? [],
    }));
  }),
);

flagsmithRouter.get(
  "/flagsmith/environments",
  handle(async (ctx) => {
    const environments = await listAll(ctx, `environments/?project=${ctx.target.projectId}`, 50);
    return environments.map((environment: any) => ({
      id: environment.id,
      name: environment.name,
      apiKey: environment.api_key,
      current: environment.api_key === ctx.target.environmentKey,
    }));
  }),
);

// Default flag states of two environments side by side, to spot differences.
flagsmithRouter.get(
  "/flagsmith/environments/compare",
  handle(async (ctx, req) => {
    const left = String(req.query.left ?? "");
    const right = String(req.query.right ?? "");
    const [features, leftStates, rightStates] = await Promise.all([
      listAll(ctx, `${P(ctx)}/features/`, 200),
      listAll(ctx, `environments/${encodeURIComponent(left)}/featurestates/`, 500),
      listAll(ctx, `environments/${encodeURIComponent(right)}/featurestates/`, 500),
    ]);
    const defaultState = (states: any[], featureId: number) =>
      states.find((s) => s.feature === featureId && s.feature_segment == null && s.identity == null);

    return features.map((feature: any) => {
      const a = defaultState(leftStates, feature.id);
      const b = defaultState(rightStates, feature.id);
      return {
        flag: feature.name,
        left: { enabled: a?.enabled ?? false, value: a?.feature_state_value ?? null },
        right: { enabled: b?.enabled ?? false, value: b?.feature_state_value ?? null },
        different: a?.enabled !== b?.enabled || a?.feature_state_value !== b?.feature_state_value,
      };
    });
  }),
);

flagsmithRouter.get(
  "/flagsmith/audit",
  handle(async (ctx) => {
    const page = await ctx.flagsmith.get(`${P(ctx)}/audit/?page_size=50`);
    return (page?.results ?? []).map((entry: any) => ({
      id: entry.id,
      at: entry.created_date,
      log: entry.log,
      author: entry.author?.email ?? entry.author?.first_name ?? (entry.is_system_event ? "system" : "api key"),
      type: entry.related_object_type,
    }));
  }),
);

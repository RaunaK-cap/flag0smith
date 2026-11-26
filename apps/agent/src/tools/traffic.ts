import { runTraffic, type TrafficOptions, type TrafficStats } from "@flagpilot/simulator";
import { z } from "zod";
import type { RunContext } from "../runs/context";
import { defineTool } from "./helpers";

type Simulation = {
  controller: AbortController;
  stats: TrafficStats;
  status: "running" | "stopping" | "stopped" | "completed" | "failed";
  done?: Promise<void>;
  error?: string;
};

const simulations = new Map<string, Simulation>();

async function simulate(ctx: RunContext, simulation: Simulation, options: TrafficOptions) {
  const pendingVariants = new Set<string>();
  function recordTick(variant: string, stats: TrafficStats) {
    simulation.stats = stats;
    pendingVariants.add(variant);
  }

  function flushTicks() {
    for (const variant of pendingVariants) {
      ctx.emit({
        type: "traffic.tick",
        variant,
        ...simulation.stats[variant],
      });
    }
    pendingVariants.clear();
  }

  const timer = setInterval(flushTicks, 500);
  const signal = simulation.controller.signal;
  try {
    simulation.stats = await runTraffic(options, recordTick, signal);
    simulation.status = signal.aborted ? "stopped" : "completed";
  } catch (error) {
    simulation.status = "failed";
    simulation.error = error instanceof Error ? error.message : String(error);
  } finally {
    clearInterval(timer);
    flushTicks();
  }
}

function statusOf(simulation?: Simulation) {
  return {
    status: simulation?.status ?? "idle",
    stats: simulation?.stats ?? {},
    error: simulation?.error,
  };
}

export const startTraffic = defineTool({
  name: "start_traffic",
  description:
    "Simulate experiment visitors in the background and send conversions. " +
    "Lifts are relative changes to baseRate, with no lift for an A/A test.",
  parameters: z.object({
    flag: z.string().min(1),
    event: z.string().min(1),
    visitors: z.number().int().positive().nullish(),
    baseRate: z.number().min(0).max(1).nullish(),
    lifts: z.array(z.object({ key: z.string(), lift: z.number() })).optional(),
  }),
  needsApproval: true,
  run: async ({ flag, event, visitors, baseRate, lifts }, ctx) => {
    const previous = simulations.get(ctx.runId);
    if (previous?.status === "running" || previous?.status === "stopping") {
      return statusOf(previous);
    }
    if (!ctx.target.serverKey) {
      throw new Error("Missing Flagsmith server key.");
    }
    const simulation: Simulation = {
      controller: new AbortController(),
      status: "running",
      stats: {},
    };
    simulations.set(ctx.runId, simulation);
    simulation.done = simulate(ctx, simulation, {
      environmentKey: ctx.target.serverKey,
      apiUrl: ctx.target.flagsmithApiUrl,
      flag,
      event,
      visitors: visitors ?? 400,
      baseRate: baseRate ?? 0.1,
      lifts: Object.fromEntries((lifts ?? []).map(({ key, lift }) => [key, lift])),
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Started traffic simulation for flag ${flag}.`,
    });
    return statusOf(simulation);
  },
});

export const stopTraffic = defineTool({
  name: "stop_traffic",
  description: "Stop this run's simulation and wait for buffered SDK events to flush.",
  parameters: z.object({}),
  run: async (_input, ctx) => {
    const simulation = simulations.get(ctx.runId);
    if (simulation?.status === "running") {
      simulation.status = "stopping";
      simulation.controller.abort();
    }
    await simulation?.done;
    return statusOf(simulation);
  },
});

export const trafficStatus = defineTool({
  name: "traffic_status",
  description: "Read this run's simulation status and per-variant exposure and conversion totals.",
  parameters: z.object({}),
  run: async (_input, ctx) => statusOf(simulations.get(ctx.runId)),
});

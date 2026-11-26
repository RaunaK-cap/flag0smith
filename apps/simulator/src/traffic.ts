import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Flag, Flagsmith } from "@flagsmith/nodejs";

export type TrafficOptions = {
  environmentKey: string;
  apiUrl?: string;
  flag: string;
  event: string;
  visitors: number;
  baseRate: number;
  lifts: Record<string, number>;
  delayMs?: number;
};

export type TrafficStats = Record<string, { exposures: number; conversions: number }>;

function sdkEndpoint(apiUrl?: string) {
  if (!apiUrl) {
    return {};
  }
  const base = new URL(apiUrl.replace(/\/+$/, "") + "/");
  // The SDK chooses its own events endpoint for Flagsmith Cloud.
  if (
    base.href === "https://api.flagsmith.com/api/v1/" ||
    base.href === "https://edge.api.flagsmith.com/api/v1/"
  ) {
    return {};
  }
  if (!base.pathname.endsWith("/api/v1/")) {
    throw new Error("The Flagsmith API URL must end in /api/v1/.");
  }
  return { apiUrl: base.href, eventProcessorConfig: { eventsApiUrl: new URL("../", base).href } };
}

export async function runTraffic(
  options: TrafficOptions,
  onTick: (variant: string, stats: TrafficStats) => void,
  signal?: AbortSignal,
): Promise<TrafficStats> {
  const { environmentKey, flag, event, visitors, baseRate, lifts, delayMs = 50 } = options;
  if (!environmentKey || !flag || !event) {
    throw new Error("Supply an environment key, flag, and event name.");
  }

  const sdk = new Flagsmith({
    environmentKey,
    enableEvents: true,
    ...sdkEndpoint(options.apiUrl),
  });
  const runId = randomUUID();
  const stats: TrafficStats = Object.create(null);
  try {
    for (let i = 0; i < visitors && !signal?.aborted; i++) {
      const identifier = `sim-${runId}-${i}`;
      const result = await sdk.getExperimentFlag(flag, identifier);
      if (result instanceof Flag && result.enabled && result.experiment?.inExperiment) {
        const variant = result.variant ?? "control";
        stats[variant] ??= { exposures: 0, conversions: 0 };
        const counts = stats[variant];
        counts.exposures++;

        const lift = Object.hasOwn(lifts, variant) ? lifts[variant] : 0;
        const conversionRate = baseRate * (1 + lift);
        if (!signal?.aborted && Math.random() < conversionRate) {
          sdk.trackEvent(event, { identifier, value: 1 });
          counts.conversions++;
        }
        onTick(variant, stats);
      }

      if (delayMs && i + 1 < visitors) {
        try {
          await delay(delayMs, undefined, { signal });
        } catch (error) {
          if (!signal?.aborted) {
            throw error;
          }
          break;
        }
      }
    }
    return stats;
  } finally {
    await sdk.close();
  }
}

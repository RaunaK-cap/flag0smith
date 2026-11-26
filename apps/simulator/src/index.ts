import { parseArgs } from "node:util";
import { runTraffic, type TrafficStats } from "./traffic";

function parseLifts(entries: string[]) {
  const lifts: Record<string, number> = Object.create(null);
  for (const entry of entries) {
    const [key, value, extra] = entry.split("=");
    if (!key || !value?.trim() || extra !== undefined) {
      throw new Error(`Invalid --lift ${entry}. Use key=0.12.`);
    }
    lifts[key] = Number(value);
  }
  return lifts;
}

async function main() {
  const { values } = parseArgs({
    options: {
      flag: { type: "string" },
      event: { type: "string" },
      visitors: { type: "string", default: "400" },
      base: { type: "string", default: "0.1" },
      lift: {
        type: "string",
        multiple: true,
        default: [],
      },
    },
  });
  const environmentKey = process.env.FLAGSMITH_SERVER_KEY;
  if (!environmentKey || !values.flag || !values.event) {
    throw new Error(
      "Set FLAGSMITH_SERVER_KEY and supply --flag NAME --event NAME " +
        "[--visitors 400] [--base 0.1] [--lift key=0.12].",
    );
  }
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  let lastPrint = 0;
  function printProgress(variant: string, stats: TrafficStats) {
    const now = Date.now();
    if (now - lastPrint < 1000) {
      return;
    }
    lastPrint = now;
    const { exposures, conversions } = stats[variant];
    console.log(`${variant}: ${exposures} exposed, ${conversions} converted`);
  }

  try {
    const stats = await runTraffic(
      {
        environmentKey,
        apiUrl: process.env.FLAGSMITH_API_URL,
        flag: values.flag,
        event: values.event,
        visitors: Number(values.visitors),
        baseRate: Number(values.base),
        lifts: parseLifts(values.lift),
      },
      printProgress,
      controller.signal,
    );
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    process.off("SIGINT", stop);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

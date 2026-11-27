// DEV ONLY: plays a realistic run through the real event store, SSE stream and approval flow,
// without calling OpenAI or Flagsmith. Used to build and test the dashboard.
// Enabled only when ENABLE_SAMPLE_RUN=1. Every number here is made up.

import type { AgentName, RunEvent } from "@flagpilot/shared";
import { waitForApproval } from "../runs/approvals";
import { createRun, emit } from "../runs/store";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function startSampleRun(): string {
  const question = "Will showing yearly pricing first get more checkout clicks? (sample run)";
  const runId = createRun(question);
  play(runId, question);
  return runId;
}

async function play(runId: string, question: string) {
  const send = (event: RunEvent) => emit(runId, event);
  let call = 0;

  async function say(agent: AgentName, text: string) {
    for (const word of text.split(" ")) {
      send({ type: "agent.text", agent, delta: word + " " });
      await sleep(25);
    }
  }

  async function tool(agent: AgentName, name: string, input: unknown, output: unknown, approve = false) {
    const callId = `call_${++call}`;
    if (approve) {
      send({ type: "run.status", status: "waiting_approval" });
      send({ type: "approval.needed", approvalId: callId, agent, tool: name, input });
      const approved = await waitForApproval(runId, callId);
      send({ type: "approval.resolved", approvalId: callId, approved });
      send({ type: "run.status", status: "running" });
      if (!approved) return false;
    }
    send({ type: "tool.called", agent, callId, tool: name, input });
    await sleep(400);
    send({ type: "tool.result", agent, callId, tool: name, output, ok: true });
    return true;
  }

  send({ type: "run.started", question, mode: "demo" });
  send({ type: "agent.started", agent: "orchestrator", task: question });
  await say("orchestrator", "I'll plan the experiment first, then set it up in Flagsmith.");

  send({ type: "agent.started", agent: "planner", parent: "orchestrator", task: "Design an A/B test for yearly-first pricing." });
  await tool("planner", "list_flags", { search: "pricing" }, []);
  await say(
    "planner",
    "Hypothesis: if we show yearly billing first, checkout clicks go up, because the monthly price looks cheaper next to it.\nFlag: pricing_yearly_first · variants: control, yearly_first · metric: checkout_click (occurrence, up) · split 50/50.",
  );
  send({ type: "agent.finished", agent: "planner", output: "Plan ready" });

  send({ type: "agent.started", agent: "flag_engineer", parent: "orchestrator", task: "Create the flag, variant, metric and experiment." });
  if (!(await tool("flag_engineer", "create_flag", { name: "pricing_yearly_first", type: "MULTIVARIATE", initialValue: "control", defaultEnabled: true }, { id: 42, name: "pricing_yearly_first" }, true))) {
    send({ type: "run.finished", status: "cancelled", summary: "Stopped: you rejected creating the flag." });
    return;
  }
  send({ type: "flagsmith.changed", source: "agent", summary: "Created flag pricing_yearly_first." });
  await tool("flag_engineer", "add_variant", { featureId: 42, key: "yearly_first", value: "yearly_first", weight: 0 }, { id: 7, key: "yearly_first" });
  send({ type: "flagsmith.changed", source: "agent", summary: "Added variant yearly_first." });
  await tool("flag_engineer", "create_metric", { name: "Checkout click", event: "checkout_click", aggregation: "occurrence", direction: "up" }, { id: 3 });
  send({ type: "flagsmith.changed", source: "agent", summary: "Created metric checkout_click." });
  await tool("flag_engineer", "create_experiment", { featureId: 42, name: "Yearly first", metricIds: [3], variants: [{ optionId: 7, percentage: 50 }] }, { id: 11, status: "created" });
  send({ type: "flagsmith.changed", source: "agent", summary: "Created experiment Yearly first (not started)." });
  await say("flag_engineer", "Flag 42, metric 3 and experiment 11 are ready.");
  send({ type: "agent.finished", agent: "flag_engineer", output: "Created flag 42, metric 3, experiment 11" });

  send({ type: "agent.started", agent: "coder", parent: "orchestrator", task: "Put the yearly-first pricing behind the flag and open a PR." });
  await tool("coder", "list_repo_files", {}, ["src/sections/Pricing.tsx", "src/flagsmith.ts"]);
  await tool("coder", "read_repo_file", { path: "src/sections/Pricing.tsx" }, "export function Pricing() { … }");
  await tool("coder", "open_pull_request", { branch: "flagpilot/pricing-yearly-first", title: "Experiment: yearly pricing first" }, { number: 4, url: "https://github.com/example/cloudnote-demo/pull/4" }, true);
  send({ type: "pr.opened", url: "https://github.com/example/cloudnote-demo/pull/4", number: 4, title: "Experiment: yearly pricing first" });
  send({ type: "agent.finished", agent: "coder", output: "PR #4 opened" });

  await say("orchestrator", "PR is merged. Starting the experiment and sending demo traffic.");
  await tool("orchestrator", "start_experiment", { experimentId: 11 }, { id: 11, status: "running" }, true);
  send({ type: "flagsmith.changed", source: "agent", summary: "Started experiment 11." });
  await tool("orchestrator", "start_traffic", { flag: "pricing_yearly_first", event: "checkout_click", visitors: 600, lifts: [{ key: "yearly_first", lift: 0.12 }] }, { status: "running" });

  const counts: Record<string, { exposures: number; conversions: number }> = {
    control: { exposures: 0, conversions: 0 },
    yearly_first: { exposures: 0, conversions: 0 },
  };
  for (let i = 0; i < 600; i++) {
    const variant = Math.random() < 0.5 ? "control" : "yearly_first";
    const rate = variant === "control" ? 0.1 : 0.112;
    counts[variant].exposures++;
    if (Math.random() < rate) counts[variant].conversions++;
    if (i % 6 === 0) {
      for (const [key, value] of Object.entries(counts)) {
        send({ type: "traffic.tick", variant: key, ...value });
      }
      await sleep(60);
    }
  }

  send({ type: "agent.started", agent: "analyst", parent: "orchestrator", task: "Read the results of experiment 11." });
  await tool("analyst", "get_results", { experimentId: 11 }, { status: "running" });
  send({
    type: "results.updated",
    experimentId: 11,
    status: "running",
    variants: [
      { key: "control", exposures: counts.control.exposures, conversions: counts.control.conversions },
      {
        key: "yearly_first",
        exposures: counts.yearly_first.exposures,
        conversions: counts.yearly_first.conversions,
        delta: 11.4,
        credibleInterval: [2.1, 20.6],
        chanceToBeatControl: 0.96,
      },
    ],
  });
  await say("analyst", "Verdict: winner yearly_first. +11.4% checkout clicks, 96% chance it beats control. The interval does not cross zero.");
  send({ type: "agent.finished", agent: "analyst", output: "winner: yearly_first" });

  send({ type: "agent.started", agent: "janitor", parent: "orchestrator", task: "End experiment 11 and roll out yearly_first." });
  await tool("janitor", "complete_experiment", { experimentId: 11, decision: "variant", variantOptionId: 7 }, { status: "completed" }, true);
  send({ type: "flagsmith.changed", source: "agent", summary: "Completed experiment 11 and rolled out yearly_first." });
  send({ type: "agent.finished", agent: "janitor", output: "Rolled out yearly_first" });

  const summary =
    "Yearly-first pricing won: +11.4% checkout clicks (96% chance to beat control).\nRolled out to everyone. Next: merge the cleanup PR that removes the old pricing code.";
  send({ type: "agent.finished", agent: "orchestrator", output: summary });
  send({ type: "run.finished", status: "done", summary });
}

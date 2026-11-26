import { Router } from "express";
import { config } from "../config";
import { executeRun } from "../runs/execute";
import type { RunTarget } from "../runs/context";
import { createRun, emit, getEvents, getRun, listRuns, subscribe } from "../runs/store";
import { resolveApproval } from "../runs/approvals";
import { openSse } from "./sse";

export const runsRouter = Router();

// Start a run. Demo mode uses our own Flagsmith project + demo repo.
// Connected mode sends the user's own keys; they are used for this run only and never saved.
runsRouter.post("/runs", (req, res) => {
  const question = String(req.body?.question ?? "").trim();
  if (!question) return res.status(400).json({ error: "question is required" });

  const mode = req.body?.mode === "connected" ? "connected" : "demo";
  const target: RunTarget = mode === "demo" ? config.demo : readConnectedTarget(req.body?.target);
  if (!target.flagsmithToken) return res.status(400).json({ error: "Flagsmith token is missing" });

  const runId = createRun(question);
  emit(runId, { type: "run.started", question, mode });
  executeRun(runId, question, mode, target); // runs in the background, events go to the stream

  res.status(201).json({ runId });
});

runsRouter.get("/runs", (_req, res) => {
  res.json(listRuns());
});

runsRouter.get("/runs/:id", (req, res) => {
  const run = getRun(req.params.id);
  if (!run) return res.status(404).json({ error: "run not found" });
  res.json({ ...run, events: getEvents(run.id) });
});

// Live stream. Sends past events first (replay), then new ones as they happen.
runsRouter.get("/runs/:id/stream", (req, res) => {
  const run = getRun(req.params.id);
  if (!run) return res.status(404).json({ error: "run not found" });

  const after = Number(req.header("Last-Event-ID") ?? req.query.after ?? 0);
  const sse = openSse(req, res);

  // Both steps run synchronously, so no event can slip in between them.
  for (const event of getEvents(run.id, after)) sse.send(event, event.seq);
  const unsubscribe = subscribe(run.id, (event) => sse.send(event, event.seq));
  sse.onClose(unsubscribe);
});

runsRouter.post("/runs/:id/approvals/:approvalId", (req, res) => {
  const approved = req.body?.approved === true;
  const ok = resolveApproval(req.params.id, req.params.approvalId, approved);
  if (!ok) return res.status(404).json({ error: "no pending approval with that id" });
  res.json({ ok: true });
});

function readConnectedTarget(body: any): RunTarget {
  return {
    flagsmithApiUrl: String(body?.flagsmithApiUrl || config.demo.flagsmithApiUrl),
    flagsmithToken: String(body?.flagsmithToken ?? ""),
    projectId: Number(body?.projectId ?? 0),
    environmentId: Number(body?.environmentId ?? 0),
    environmentKey: String(body?.environmentKey ?? ""),
    serverKey: String(body?.serverKey ?? ""),
    githubToken: String(body?.githubToken ?? ""),
    githubRepo: String(body?.githubRepo ?? ""),
  };
}

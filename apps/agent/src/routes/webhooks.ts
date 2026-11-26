// Flagsmith calls this URL when a flag changes (set it up under Environment Settings -> Webhooks).
// We push the change to every open dashboard via the global live feed.

import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, raw } from "express";
import { config } from "../config";
import { broadcast, subscribeGlobal } from "../runs/store";
import { openSse } from "./sse";

export const webhooksRouter = Router();

webhooksRouter.post("/webhooks/flagsmith", raw({ type: "*/*" }), (req, res) => {
  const body: Buffer = req.body;

  if (config.webhookSecret && !validSignature(body, req.header("X-Flagsmith-Signature"))) {
    return res.status(401).json({ error: "bad signature" });
  }

  const payload = JSON.parse(body.toString("utf8") || "{}");
  broadcast({
    type: "flagsmith.changed",
    source: "webhook",
    summary: describe(payload),
    data: payload,
  });
  res.json({ ok: true });
});

webhooksRouter.get("/live/stream", (req, res) => {
  const sse = openSse(req, res);
  const unsubscribe = subscribeGlobal((event) => sse.send(event));
  sse.onClose(unsubscribe);
});

function validSignature(body: Buffer, signature?: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", config.webhookSecret).update(body).digest("hex");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function describe(payload: any): string {
  const state = payload?.data?.new_state;
  const name = state?.feature?.name ?? "a flag";
  if (!state) return `Flagsmith event: ${payload?.event_type ?? "unknown"}`;
  return `${name} is now ${state.enabled ? "ON" : "OFF"}${state.feature_state_value != null ? ` (value: ${state.feature_state_value})` : ""}`;
}

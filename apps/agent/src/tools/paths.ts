import type { RunContext } from "../runs/context";

export function P(ctx: RunContext) {
  return `projects/${ctx.target.projectId}`;
}

export function E(ctx: RunContext) {
  const key = encodeURIComponent(ctx.target.environmentKey);
  return `environments/${key}`;
}

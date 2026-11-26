import { z } from "zod";
import { FlagsmithError } from "../clients/flagsmith";
import type { RunContext } from "../runs/context";
import { feature as toFlag } from "./flags";
import { defineTool } from "./helpers";
import { listAll } from "./list";
import { E, P } from "./paths";

function toAuditEntry(raw: any) {
  return {
    created_date: raw.created_date,
    log: raw.log,
    related_object_type: raw.related_object_type,
    related_object_id: raw.related_object_id,
  };
}

async function audit(ctx: RunContext, search: string | undefined, limit: number) {
  const params = new URLSearchParams({ page_size: String(limit) });
  if (search) {
    params.set("search", search);
  }

  const rows = await listAll(ctx, `${P(ctx)}/audit/?${params}`, limit);
  return rows.map(toAuditEntry);
}

export const getAuditLog = defineTool({
  name: "get_audit_log",
  description: "Read recent project audit entries, optionally filtered by search text.",
  parameters: z.object({
    search: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  run: async ({ search, limit }, ctx) => audit(ctx, search, limit ?? 20),
});

export const getFlagHistory = defineTool({
  name: "get_flag_history",
  description: "Find recent project audit entries mentioning a flag by its current name.",
  parameters: z.object({ featureId: z.number().int() }),
  run: async ({ featureId }, ctx) => {
    const flag = await ctx.flagsmith.get(`${P(ctx)}/features/${featureId}/`);
    return audit(ctx, flag.name, 20);
  },
});

export const findStaleFlags = defineTool({
  name: "find_stale_flags",
  description:
    "Find flags with Flagsmith's STALE tag, or list enabled flags " +
    "without variants as candidates with their latest audit date.",
  parameters: z.object({}),
  run: async (_input, ctx) => {
    try {
      const tags = await listAll(ctx, `${P(ctx)}/tags/`, Infinity);
      const stale = tags.find((t) => t.type === "STALE");
      if (stale) {
        const flags = await listAll(ctx, `${P(ctx)}/features/?tags=${stale.id}`);
        if (flags.length) {
          return { source: "STALE", flags: flags.map(toFlag) };
        }
      }
    } catch (error) {
      if (!(error instanceof FlagsmithError) || ![402, 403].includes(error.status)) {
        throw error;
      }
    }
    const path = `${P(ctx)}/features/?environment=${ctx.target.environmentId}`;
    const flags = await listAll(ctx, path, Infinity);
    const candidates = [];
    for (const flag of flags) {
      if (!flag.environment_feature_state?.enabled || flag.multivariate_options?.length) {
        continue;
      }
      const [last] = await audit(ctx, flag.name, 1);
      candidates.push({
        id: flag.id,
        name: flag.name,
        lastAuditDate: last?.created_date ?? null,
      });
      if (candidates.length === 50) {
        break;
      }
    }
    return { source: "candidates", candidates };
  },
});

export const registerWebhook = defineTool({
  name: "register_webhook",
  description: "Register an enabled environment webhook with an optional signing secret.",
  parameters: z.object({ url: z.url(), secret: z.string().optional() }),
  needsApproval: true,
  run: async ({ url, secret }, ctx) => {
    const data = await ctx.flagsmith.post(`${E(ctx)}/webhooks/`, {
      url,
      enabled: true,
      secret,
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Registered environment webhook ${data.id}.`,
    });
    return {
      id: data.id,
      url: data.url,
      enabled: data.enabled,
    };
  },
});

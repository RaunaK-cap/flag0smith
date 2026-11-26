import { z } from "zod";
import { scalar } from "./flags";
import { defineTool } from "./helpers";
import { E } from "./paths";

function toIdentity(raw: any) {
  return { identifier: raw.identifier, identity_uuid: raw.identity_uuid };
}

function toEvaluatedFlag(raw: any) {
  return {
    flag: raw.feature?.name,
    enabled: raw.enabled,
    value: raw.feature_state_value,
  };
}

const trait = z.object({ trait_key: z.string(), trait_value: scalar.nullable() });
const requestedTraits = trait.array().optional();

export const findIdentity = defineTool({
  name: "find_identity",
  description:
    "Search Cloud edge identities by identifier prefix. " +
    "Quote the query to search for an exact identifier.",
  parameters: z.object({ query: z.string().min(1) }),
  run: async ({ query }, ctx) => {
    const params = new URLSearchParams({ q: query });
    const identities = [];
    do {
      const page = await ctx.flagsmith.get(`${E(ctx)}/edge-identities/?${params}`);
      const rows: any[] = (page.results ?? []).slice(0, 50 - identities.length);
      identities.push(...rows.map(toIdentity));
      if (!page.last_evaluated_key) {
        break;
      }
      params.set("last_evaluated_key", page.last_evaluated_key);
    } while (identities.length < 50);
    return identities;
  },
});

// The SDK GET evaluates stored traits. Supplied traits can only verify the evaluation context.
export const getIdentityFlags = defineTool({
  name: "get_identity_flags",
  description:
    "Read evaluated flags for an identifier. Optional traits must match its stored traits.",
  parameters: z.object({ identifier: z.string().min(1), traits: requestedTraits }),
  run: async ({ identifier, traits }, ctx) => {
    const url = new URL(ctx.target.flagsmithApiUrl.replace(/\/$/, "") + "/identities/");
    url.searchParams.set("identifier", identifier);
    const response = await fetch(url, {
      headers: { "X-Environment-Key": ctx.target.environmentKey },
    });
    if (!response.ok) {
      throw new Error(`Identity evaluation failed with HTTP ${response.status}.`);
    }
    const data: any = await response.json();
    for (const expected of traits ?? []) {
      const matches = data.traits?.some(
        (item: any) =>
          item.trait_key === expected.trait_key && item.trait_value === expected.trait_value,
      );
      if (!matches) {
        throw new Error(
          `The SDK GET evaluates stored traits. Supplied trait ${expected.trait_key} differs.`,
        );
      }
    }
    return (data.flags ?? []).slice(0, 50).map(toEvaluatedFlag);
  },
});

// The by-identifier endpoint repeats "environments" and has no trailing slash.
export const setIdentityOverride = defineTool({
  name: "set_identity_override",
  description: "Set a flag override for a Cloud edge identity by its external identifier.",
  parameters: z.object({
    identifier: z.string().min(1),
    featureId: z.number().int(),
    enabled: z.boolean(),
    value: scalar.optional(),
  }),
  needsApproval: true,
  run: async ({ identifier, featureId, enabled, value }, ctx) => {
    await ctx.flagsmith.put(`environments/${E(ctx)}/edge-identities-featurestates`, {
      identifier,
      feature: featureId,
      enabled,
      feature_state_value: value,
    });
    ctx.emit({
      type: "flagsmith.changed",
      source: "agent",
      summary: `Set the override for flag ${featureId} on identity ${identifier}.`,
    });
    return {
      identifier,
      featureId,
      enabled,
      value,
    };
  },
});

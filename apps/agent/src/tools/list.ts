import type { RunContext } from "../runs/context";

export async function listAll(ctx: RunContext, path: string, limit = 50): Promise<any[]> {
  const rows: any[] = [];
  const resourcePath = path.split("?")[0];
  let next = path;

  while (next && rows.length < limit) {
    const page = await ctx.flagsmith.get(next);
    const items = Array.isArray(page) ? page : (page?.results ?? []);
    rows.push(...items.slice(0, limit - rows.length));

    if (!page?.next) {
      break;
    }
    // Keep the original resource path and use only the pagination query from the next link.
    const nextUrl = new URL(page.next, ctx.target.flagsmithApiUrl);
    next = resourcePath + nextUrl.search;
  }

  return rows;
}

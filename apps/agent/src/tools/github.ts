import { z } from "zod";
import { defineTool } from "./helpers";

export const listRepoFiles = defineTool({
  name: "list_repo_files",
  description: "List all file paths in the app's GitHub repo.",
  parameters: z.object({}),
  run: async (_input, ctx) => ctx.github.listFiles(),
});

export const readRepoFile = defineTool({
  name: "read_repo_file",
  description: "Read one file from the app's GitHub repo.",
  parameters: z.object({ path: z.string() }),
  run: async ({ path }, ctx) => ctx.github.readFile(path),
});

export const openPullRequest = defineTool({
  name: "open_pull_request",
  description:
    "Create a branch with the given file changes and open a pull request. Give the FULL new content of each changed file. content: null deletes a file.",
  parameters: z.object({
    branch: z.string().describe("e.g. flagpilot/pricing-annual-first"),
    title: z.string(),
    body: z.string().describe("Markdown: hypothesis, flag, variants, metric"),
    changes: z.array(z.object({ path: z.string(), content: z.string().nullable() })),
  }),
  needsApproval: true,
  run: async (input, ctx) => {
    const pr = await ctx.github.openPullRequest(input);
    ctx.emit({ type: "pr.opened", url: pr.url, number: pr.number, title: input.title });
    return pr;
  },
});

export const pullRequestStatus = defineTool({
  name: "pull_request_status",
  description: "Check if a pull request is open, closed or merged.",
  parameters: z.object({ number: z.number() }),
  run: async ({ number }, ctx) => ctx.github.pullRequestStatus(number),
});

// Reads settings from environment variables (Bun loads .env automatically).

export const config = {
  port: Number(process.env.PORT ?? 4000),

  // Demo mode settings. "Connect your own" mode passes its own values per run instead.
  demo: {
    flagsmithApiUrl: process.env.FLAGSMITH_API_URL ?? "https://api.flagsmith.com/api/v1",
    flagsmithToken: process.env.FLAGSMITH_ADMIN_TOKEN ?? "",
    projectId: Number(process.env.FLAGSMITH_PROJECT_ID ?? 0),
    environmentId: Number(process.env.FLAGSMITH_ENVIRONMENT_ID ?? 0),
    environmentKey: process.env.FLAGSMITH_ENVIRONMENT_KEY ?? "",
    serverKey: process.env.FLAGSMITH_SERVER_KEY ?? "",
    githubToken: process.env.GITHUB_TOKEN ?? "",
    githubRepo: process.env.GITHUB_REPO ?? "",
  },

  webhookSecret: process.env.FLAGSMITH_WEBHOOK_SECRET ?? "",
};

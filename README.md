# FlagPilot

An AI teammate that runs product experiments end to end with [Flagsmith](https://flagsmith.com).

You ask a question like *"Will showing yearly pricing first get more checkout clicks?"*.
FlagPilot plans the A/B test, sets it up in Flagsmith, opens a pull request with the variant code,
runs the experiment, reads Flagsmith's Bayesian results, and rolls out the winner.
**A human approves every change**, and every step streams live to the dashboard.

Built for the WeMakeDevs × Flagsmith hackathon (Toggle Wars).

## How it works

```
question → planner → flag engineer → coder (PR) → experiment → analyst → janitor (rollout + cleanup)
                         ⏸ approve        ⏸ approve        ⏸ approve        ⏸ approve
```

- **Agents:** an orchestrator with five sub-agents (OpenAI Agents SDK), each with its own Flagsmith or GitHub tools.
- **Flagsmith:** flags, multivariate variants, segments, environments, identities, experiments, metrics, results, gradual rollouts, audit log, webhooks.
- **Live:** every agent message, tool call, approval and traffic tick is streamed over SSE and saved, so runs can be replayed.

## Repo layout

| Path | What |
|---|---|
| `apps/agent` | Backend: Bun + Express + OpenAI Agents SDK, SSE stream, approvals, tools |
| `apps/web` | Dashboard: Next.js + Tailwind + shadcn/ui |
| `apps/simulator` | Simulated visitors for demo experiments (uses the Flagsmith Node SDK) |
| `packages/shared` | Event types shared by backend and dashboard |
| `skills/flagsmith-experiment-lifecycle` | Agent Skill: the whole experiment job via the Flagsmith CLI |
| `docker-compose.yml` | Self-hosted Flagsmith (with Experimentation) + the agent |
| `docs/flagsmith-api.md` | Verified notes on the Flagsmith API endpoints used |

## Run locally

```bash
bun install
cp .env.example .env          # fill in your keys
bun run dev:agent             # backend on http://localhost:4000
cd apps/web && bun dev        # dashboard on http://localhost:3000
```

Self-hosted Flagsmith instead of Cloud: `docker compose up` (see comments in `docker-compose.yml`).

> Work in progress — demo landing page, full setup guide and demo video coming before submission.

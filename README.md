# FlagPilot

**Ask a product question. AI agents run the whole A/B test in [Flagsmith](https://flagsmith.com), and you approve every change.**

You type *"Will showing yearly pricing first get more checkout clicks?"*. FlagPilot then:

1. plans the test,
2. creates the flag in Flagsmith,
3. opens a pull request with the code,
4. starts the experiment,
5. reads Flagsmith's results,
6. rolls out the winner,
7. opens a cleanup PR.

Every step streams live to the dashboard.

Built for the WeMakeDevs × Flagsmith hackathon (Toggle Wars).

---

## Contents

1. [Flagsmith in 1 minute](#1-flagsmith-in-1-minute)
2. [The problem](#2-the-problem)
3. [What FlagPilot does (a full example)](#3-what-flagpilot-does-a-full-example)
4. [The agents](#4-the-agents)
5. [Flagsmith features used](#5-flagsmith-features-used)
6. [How the pieces fit together](#6-how-the-pieces-fit-together)
7. [The database](#7-the-database)
8. [Demo mode vs your own project](#8-demo-mode-vs-your-own-project)
9. [Setup](#9-setup)
10. [Run it](#10-run-it)
11. [Troubleshooting](#11-troubleshooting)
12. [Deploy](#12-deploy)
13. [Repo layout](#13-repo-layout)

---

## 1. Flagsmith in 1 minute

Flagsmith is **an on/off switchboard for the features in your app**.

| Word | Meaning | Example |
|---|---|---|
| **Feature flag** | A switch in your code. Flip it in Flagsmith and the app changes without a redeploy. | `if (flag.enabled) showNewButton()` |
| **Multivariate flag** | A flag with versions (variants), not just on/off. | `control` = monthly first, `yearly_first` = yearly first |
| **Environment** | A separate copy of all flags, e.g. Development and Production. | We use **Development** |
| **Identity** | One user or visitor. Flagsmith remembers which variant they got. | `visitor_42` |
| **Segment** | A group of identities matched by rules. | "users from India" |
| **Metric** | What you measure. | `checkout_click` events |
| **Experiment (A/B test)** | Splits visitors between variants and measures the metric for each. | 50% see A, 50% see B |
| **Results** | Flagsmith's Bayesian statistics. | "B is +12%, 96% chance to beat control" |
| **Rollout** | Give the winning variant to everyone. | 100% yearly first |
| **Audit log** | Who changed what, when. | "FlagPilot created `pricing_yearly_first`" |

## 2. The problem

Running **one** A/B test properly is a lot of manual work across 3 tools:

> decide what to test → create flag + variants in Flagsmith → write code in the app → create metric + experiment → wait for traffic → read the statistics → roll out the winner → delete the old code

It takes days, and most teams stop halfway. Flags then pile up and nobody cleans them.

**FlagPilot turns all of that into one question and a few "Approve" clicks.**

## 3. What FlagPilot does (a full example)

You type: **"Will showing yearly pricing first get more checkout clicks?"**

| # | Who | What happens | Where you see it |
|---|---|---|---|
| 1 | **Planner** | Turns the question into a plan: variant A = monthly first (control), variant B = yearly first, metric = `checkout_click`. | Chat |
| 2 | **Flag engineer** | Creates the multivariate flag `pricing_yearly_first` with its 2 variants. ⏸ *asks for approval* | Approval card → Flagsmith → Features |
| 3 | **Coder** | Reads the landing-page repo, writes the variant code, and **opens a pull request**. | PR card → GitHub |
| 4 | **You** | Review and **merge** the PR. Vercel deploys the landing page. | GitHub |
| 5 | **Flag engineer** | Creates the metric and the experiment, then starts it. ⏸ *approval* | Flagsmith → Experiments |
| 6 | **Simulator** | Sends fake visitors (demo mode only). Each one gets a variant from Flagsmith and some click checkout. Variant B has a hidden +12% lift. | Live traffic chart |
| 7 | **Analyst** | Refreshes and reads Flagsmith's results: "Yearly first: +12%, 96% chance to win." | Results card |
| 8 | **Janitor** | Completes the experiment, rolls out the winner. ⏸ *approval* | Flagsmith |
| 9 | **Coder / Janitor** | Opens a **cleanup PR** that removes the losing code and the flag check. | PR card |

**You only ask and approve. The agents do the rest.**

Other things you can ask:

- *"Which flags look stale and can be cleaned up?"* (read-only, the janitor checks flags, experiments and the audit log)
- *"Roll out new_signup_form to 10% of users."*
- *"Compare Development and Production flags."*

## 4. The agents

One **orchestrator** (the manager) reads your request and hands each step to a specialist. Each agent only gets the tools it needs. **Every tool that changes something waits for a human "Approve" first.**

| Agent | Job | Example tools |
|---|---|---|
| **Orchestrator** | Runs the whole flow, talks to you | delegates, `start_traffic`, `pull_request_status` |
| **Planner** | Designs one clean experiment | `list_flags`, `list_metrics`, `list_segments` (read only) |
| **Flag engineer** | Builds everything in Flagsmith | `create_flag`, `add_variant`, `create_metric`, `create_experiment`, `start_experiment`, `create_segment`, `set_identity_override` |
| **Coder** | Writes code and opens PRs (never merges) | `list_repo_files`, `read_repo_file`, `open_pull_request` |
| **Analyst** | Reads the statistics | `refresh_results`, `get_results` |
| **Janitor** | Rollout and cleanup | `complete_experiment`, `rollout_to_percentage`, `archive_flag`, `find_stale_flags`, `get_audit_log` |

Built with the OpenAI Agents SDK. The LLM is **Gemini** by default (free tier), or OpenAI if you set an OpenAI key.

## 5. Flagsmith features used

There are 32 Flagsmith tools, calling the Flagsmith Admin API and the Node SDK:

- **Flags:** create, multivariate variants, enable/disable, archive
- **Segments:** create, segment overrides
- **Environments:** list, compare, clone
- **Identities:** find a user, see their flags, per-user overrides
- **Experimentation:** warehouse status, metrics, create/start/pause/complete experiments, refresh and read Bayesian results
- **Rollouts:** gradual percentage rollouts
- **History:** audit log, flag history, stale-flag detection, webhooks
- **SDK** (simulator + landing page): `getExperimentFlag`, `trackEvent`

Two more tracks:

- **Self-hosted (Track 03):** `docker compose up` runs Flagsmith with Experimentation on your machine.
- **Agent Skill (Track 04):** `skills/flagsmith-experiment-lifecycle` does the same job from any coding agent via the Flagsmith CLI.

## 6. How the pieces fit together

There are 3 apps and 2 outside services:

```
 ┌──────────────┐  question / approve   ┌──────────────────┐   Admin API    ┌─────────────┐
 │  Dashboard   │ ────────────────────▶ │  Agent backend   │ ─────────────▶ │  Flagsmith  │
 │  (Next.js)   │ ◀──── live events ─── │ (Node + Express) │                │             │
 └──────────────┘    (SSE stream)       │   + agents       │ ── Gemini ──▶ LLM
                                        │   + SQLite       │                └──────▲──────┘
                                        └────────┬─────────┘                       │ which variant?
                                                 │ opens PRs                       │ track click
                                                 ▼                                 │
                                        ┌──────────────────┐   deploys    ┌──────────────────┐
                                        │ GitHub: cloudnote│ ───────────▶ │  Landing page    │
                                        │      -demo       │   (Vercel)   │ (cloudnote-demo) │
                                        └──────────────────┘              └──────────────────┘
                                                                     ▲ fake visitors (simulator)
```

- **Dashboard** (`apps/web`): where you chat, approve, and watch everything live. It also has pages for Flags, Experiments, Segments, Environments and the Audit log.
- **Agent backend** (`apps/agent`): runs the agents, calls Flagsmith and GitHub, saves everything, and streams events.
- **Landing page** (separate repo `cloudnote-demo`): a real website whose pricing section is controlled by a Flagsmith flag. The agents change its code through PRs.
- **Simulator** (`apps/simulator`): fake visitors that ask Flagsmith for a variant and send `checkout_click` events.

**How "live" works:** each thing an agent does becomes an **event**, e.g. `agent.started`, `tool.called`, `approval.needed`, `pr.opened` or `results.updated`. The backend saves the event, then pushes it to the dashboard over **Server-Sent Events** (one long HTTP connection). The dashboard draws each event as it arrives.

**How approval works:** a tool that changes something pauses the agent and sends `approval.needed`. The dashboard shows an Approve / Reject card. Your click goes back to the backend, and the agent continues (or skips that step).

## 7. The database

**SQLite**: one file, `flagpilot.sqlite`, next to the backend. There is no database server to install.

| Table | One row is | Holds |
|---|---|---|
| `runs` | one chat | id, question, status (running / waiting_approval / done / failed), time, mode (demo / connected), the agent's conversation memory |
| `events` | one thing that happened in a chat | the event JSON plus an order number (`seq`) |

How it's used:

1. **New question:** a row is added to `runs`.
2. **Every agent step:** an event is **saved** and **streamed** at the same time.
3. **Page refresh:** the dashboard asks for the chat, and the backend **replays** the saved events in order, so nothing is lost.
4. **Follow-up message:** the agent loads its saved memory and continues the same conversation.

**Not saved:** keys from the Connect page. They live in memory only.

**In production:** the file needs a persistent disk. Set `DATA_DIR` to the volume path, e.g. on Railway.

## 8. Demo mode vs your own project

| Mode | Uses | When |
|---|---|---|
| **Demo** (default) | The Flagsmith project + `cloudnote-demo` repo from the backend's `.env` | Always, unless you connect your own |
| **Your project** | The keys you enter on the dashboard's `/connect` page, stored in your browser tab only | When a judge or user wants to try it on their own Flagsmith |

The simulator (fake traffic) only runs in demo mode. Your own project gets real users.

## 9. Setup

### Keys you need (in `flagpilot/.env`)

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | aistudio.google.com/apikey (free). Or set `OPENAI_API_KEY` instead. |
| `MODEL` | Optional. Default `gemini-3.5-flash`. Busy models fall back to `gemini-3.5-flash-lite`, then `gemini-2.5-flash`. |
| `FLAGSMITH_ADMIN_TOKEN` | Flagsmith → your organisation (top left) → Organisation Settings → **API Keys** |
| `FLAGSMITH_PROJECT_ID` | The number in the URL: `app.flagsmith.com/project/`**`56699`**`/...` |
| `FLAGSMITH_ENVIRONMENT_KEY` | The key in the URL: `.../environment/`**`3ALA2EHo...`**`/...` (client-side key) |
| `FLAGSMITH_ENVIRONMENT_ID` | Numeric id. Ask the API: `GET /environments/<environment key>/` → `id` |
| `FLAGSMITH_SERVER_KEY` | Flagsmith left menu → **SDK Keys** → Create Server-side Key (`ser.…`) |
| `GITHUB_TOKEN` | github.com/settings/personal-access-tokens/new. Fine-grained, only the `cloudnote-demo` repo, **Contents** + **Pull requests**: Read and write |
| `GITHUB_REPO` | `owner/cloudnote-demo` |

Write `KEY=value` with **no space** after `=`. `.env` is git-ignored and never pushed.

### In Flagsmith

- Open **Experiments** once. The managed warehouse must exist, because experiments need it.

### Landing page (`cloudnote-demo/.env.local`)

```bash
NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY=<same value as FLAGSMITH_ENVIRONMENT_KEY>
```

It **must be the same environment** as the backend, or the experiment counts visitors in the wrong place.

## 10. Run it

Needs **Bun** (to install packages) and **Node 24** (to run the backend).

```bash
bun install

# terminal 1: agent backend → http://localhost:4000
bun run dev:agent

# terminal 2: dashboard → http://localhost:3000
cd apps/web && bun run dev
```

Then open http://localhost:3000:

1. Quick test (changes nothing): *"Which flags look stale and can be cleaned up?"*
2. Full demo: *"Will showing yearly pricing first get more checkout clicks?"* Approve each step, and merge the PR on GitHub when asked.

Other commands:

| Command | What |
|---|---|
| `bun run simulate` | Run the fake-visitor simulator by hand |
| `bun run typecheck` | Type-check backend + simulator |
| `docker compose up` | Self-hosted Flagsmith (see comments in `docker-compose.yml`) |

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Run stuck on "orchestrator started", no error | Gemini model busy or rate-limited (free tier) | It falls back automatically after ≤25s. To skip the busy model, set `MODEL=gemini-3.5-flash-lite`. |
| Backend log: `[llm] gemini-3.5-flash is busy (429)` | Free-tier quota for that model is used up | Normal. The fallback model is used. Quota resets daily. |
| Everything hangs on a phone hotspot | Broken IPv6 on the network | The backend runs on Node (falls back to IPv4). Ethernet / normal Wi-Fi is fine. |
| Dashboard on a phone: buttons do nothing | Next.js dev server blocks other addresses | Already allowed in `next.config.ts` for `10.*`, `192.168.*`, `172.*`. Restart the dev server after config changes. |
| Sidebar says "Backend offline" | Backend not running | `bun run dev:agent` |
| `401` from Flagsmith | Wrong / expired admin token | New key in Organisation Settings → API Keys |
| Results empty | Fewer than 50 visitors per variant, or refreshed within 5 min | Let traffic run longer. Flagsmith allows 1 refresh per 5 minutes. |

## 12. Deploy

| What | Where | Settings |
|---|---|---|
| Landing page (`cloudnote-demo`) | Vercel, connected to its GitHub repo so merged PRs deploy | `NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY` |
| Agent backend | Railway (or any Docker host), using the `Dockerfile` | All `.env` keys + `DATA_DIR=/data` with a volume on `/data` |
| Dashboard (`apps/web`) | Vercel | `NEXT_PUBLIC_AGENT_URL=https://<your backend>` |

## 13. Repo layout

| Path | What |
|---|---|
| `apps/agent` | Backend: Node + Express + OpenAI Agents SDK, SSE stream, approvals, tools, SQLite |
| `apps/agent/src/agents` | The 6 agents and their instructions |
| `apps/agent/src/tools` | Flagsmith, GitHub and traffic tools (`index.ts` = which agent gets which tool) |
| `apps/agent/src/llm.ts` | Gemini / OpenAI setup, model fallback |
| `apps/agent/src/runs` | Running a chat, approvals, the database |
| `apps/web` | Dashboard: Next.js + Tailwind + shadcn/ui |
| `apps/simulator` | Fake visitors for demo experiments (Flagsmith Node SDK) |
| `packages/shared` | Event types shared by backend and dashboard |
| `skills/flagsmith-experiment-lifecycle` | Agent Skill: the whole experiment job via the Flagsmith CLI |
| `docker-compose.yml` | Self-hosted Flagsmith (with Experimentation) + the agent |
| `docs/flagsmith-api.md` | Verified notes on the Flagsmith API endpoints used |

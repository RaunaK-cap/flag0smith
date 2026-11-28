# Demo video script (~3 min)

Record the full run first, then speed up the waiting parts 2–4×.
Keep the Flagsmith tab open to show that the agents' changes are real.
Zoom the browser to 125% so small text is readable.

## 0:00–0:20 · The problem

*Show: Flagsmith dashboard.*

> "Running one A/B test means flags, code, experiments, statistics and cleanup, across three tools. Most teams never finish. What if you could just ask a question?"

## 0:20–0:35 · Introduce FlagPilot

*Show: FlagPilot home page.*

> "This is FlagPilot. AI agents that run a whole Flagsmith experiment for you, from question to rollout. You approve every change."

## 0:35–1:30 · Live run

*Type: "Will showing yearly pricing first get more checkout clicks?"*

- Agents streaming: "The planner designs the test… the flag engineer wants to create a flag. I approve."
- Switch to Flagsmith → Features: "Here it is, created by the agent."
- PR card: "The coder opened a real PR on my landing page. I merge it, and Vercel deploys it."

## 1:30–2:15 · Experiment and results

- "The experiment starts in Flagsmith, and simulated visitors arrive." *Show: live traffic chart.*
- "The analyst reads Flagsmith's own Bayesian results: yearly first wins by 12%, with a 96% chance to beat control."
- Approve the rollout: "The winner goes live, and the janitor opens a cleanup PR."

## 2:15–2:40 · How it's built

> "Six agents on the OpenAI Agents SDK, running on Gemini, with 32 Flagsmith tools: flags, variants, segments, identities, metrics, experiments, rollouts and the audit log. Everything streams live and every change waits for a human. It also runs on self-hosted Flagsmith with Docker, and ships as an Agent Skill."

## 2:40–3:00 · Close

> "From a question to a shipped winner in minutes, not days. FlagPilot: ask, approve, ship."

---
name: flagsmith-experiment-lifecycle
description: Run a complete A/B experiment with Flagsmith from a product question to a rolled-out winner - plan, create the multivariate flag, metric and experiment, wire the app code, start, read Bayesian results, roll out the winner and clean up. Use when someone asks to A/B test, experiment with, or compare versions of a feature using Flagsmith.
license: MIT
compatibility: Needs the Flagsmith CLI v2+ (logged in, directory bound with flagsmith init), bash, and a Flagsmith environment with a connected warehouse (Experimentation beta).
metadata:
  author: flagpilot
  version: "1.0"
---

# Flagsmith experiment lifecycle

All Flagsmith work goes through `scripts/exp.sh`. Each command prints 1-5 short lines.
Commands that change anything are a **dry run** unless you add `--apply`.

## Safety rules (always)
- Before ANY `--apply`: show the human the dry-run line and wait for an explicit yes.
- Environments whose name contains "prod" also need `FLAGSMITH_CONFIRM_PROD=yes`, set only after the human confirms.
- Never start an experiment before the app code that reads the flag is deployed.
- If results show a sample ratio mismatch warning, do not roll out anything; report it.

## Steps

1. **Check** - `scripts/exp.sh preflight`. Stop and tell the human if there is no warehouse or no login.

2. **Plan** (no tools) - write in 4 lines:
   hypothesis ("If we X, then <metric> goes up, because Y"), flag name (snake_case),
   variants (`key=value`, 1-2 besides control), and ONE metric event that fires early in a visit.

3. **Create** - `scripts/exp.sh create <flag> <event> <key>=<value> --hypothesis "..."`
   (dry run) -> human approves -> same command with `--apply`. Note the experiment id.

4. **Wire the app** - in the app code, read the flag where the variant is shown and track the metric:
   - JS: `flagsmith.getExperimentFlag('<flag>')` ... `flagsmith.trackEvent('<event>')`
   - React: `useExperiment('<flag>')`; Python: `get_experiment_flag("<flag>", identifier=uid)` + `track_event("<event>", identifier=uid)`
   Use the same user identifier for both. Event name must match exactly (case-sensitive).
   Keep control's code path unchanged. Open a PR; a human merges and deploys.

5. **Start** - after deploy: `scripts/exp.sh start <id>` -> approve -> `--apply`.

6. **Read results** - `scripts/exp.sh results <id>`. It prints rates, lift, 95% credible interval,
   probability of beating control, and a verdict. Refresh is limited to once per 5 minutes and each
   variant needs 50+ users before stats appear, so check back instead of looping.

7. **Decide** - verdict `WINNER <key>`: `scripts/exp.sh finish <id> <key>` -> approve -> `--apply`.
   `control wins`: finish with `control`. `inconclusive`: keep running or stop with `control`.

8. **Clean up** - remove the losing code path and the experiment call from the app (PR).
   Optional: `scripts/exp.sh stale 30` lists flags with no changes in 30 days.

## Output to the human
End with one short block: hypothesis, experiment id, verdict with numbers, what was rolled out, next step.

For raw API details (only if a step fails) see `references/api.md`.

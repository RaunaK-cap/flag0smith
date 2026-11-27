#!/usr/bin/env bash
# One script for the whole Flagsmith experiment lifecycle, built on the Flagsmith CLI.
# Every command prints a few short lines, so an agent spends very few tokens reading it.
# Commands that change anything are a DRY RUN unless --apply is given.
#
#   exp.sh preflight
#   exp.sh create  <flag> <event> <variant_key>=<value> [...] [--split 50] [--hypothesis "..."] [--apply]
#   exp.sh start   <experiment_id> [--apply]
#   exp.sh results <experiment_id>
#   exp.sh finish  <experiment_id> <control|variant_key|disable> [--apply]
#   exp.sh stale   [days]

set -euo pipefail

FS="flagsmith --no-input"
APPLY=false
ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--apply" ]]; then APPLY=true; else ARGS+=("$arg"); fi
done
set -- "${ARGS[@]}"

die() { echo "ERROR: $*" >&2; exit 1; }

env_key() {
  local key
  key=$($FS config --jq '.environment.value // empty')
  [[ -n "$key" ]] || die "no environment bound. Run: flagsmith init --project <p> --environment <e>"
  echo "$key"
}

# Production safety: changing a production environment needs an extra explicit confirmation.
guard_write() {
  local what="$1"
  if [[ "$APPLY" != true ]]; then
    echo "DRY RUN: would $what. Re-run with --apply after the human approves."
    exit 0
  fi
  local name
  name=$($FS api "api/v1/environments/$(env_key)/" --jq '.name')
  if [[ "${name,,}" == *prod* && "${FLAGSMITH_CONFIRM_PROD:-}" != "yes" ]]; then
    die "environment '$name' looks like production. Set FLAGSMITH_CONFIRM_PROD=yes after the human confirms."
  fi
}

api() { $FS api "api/v1/environments/$(env_key)/$1" "${@:2}"; }

cmd_preflight() {
  command -v flagsmith >/dev/null || die "Flagsmith CLI missing: curl -fsSL https://get.flagsmith.com | sh"
  $FS auth status >/dev/null 2>&1 || die "not logged in: flagsmith login"
  local env
  env=$(env_key)
  echo "env: $($FS api "api/v1/environments/$env/" --jq '"\(.name) (\(.api_key))"')"
  echo "warehouse: $(api warehouse-connections/ --jq '[.results[]? // .[]? | .status] | join(",") | if . == "" then "NONE - connect one first" else . end')"
  echo "running experiments: $(api 'experiments/?status=running' --jq '[.results[]? | .name] | join(", ") | if . == "" then "none" else . end')"
}

cmd_create() {
  local flag="${1:?flag}" event="${2:?event}"
  shift 2
  local split=50 hypothesis="" variants=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --split) split="$2"; shift 2 ;;
      --hypothesis) hypothesis="$2"; shift 2 ;;
      *=*) variants+=("$1"); shift ;;
      *) die "unknown argument: $1" ;;
    esac
  done
  [[ ${#variants[@]} -gt 0 ]] || die "give at least one variant as key=value"
  [[ -n "$hypothesis" ]] || hypothesis="Changing $flag improves $event"

  guard_write "create flag '$flag' with ${#variants[@]} variant(s), metric '$event', and an experiment (not started)"

  # 1. Multivariate flag (control = its default value). Reuse it if it already exists.
  if ! $FS feature get "$flag" >/dev/null 2>&1; then
    $FS feature create "$flag" --value control --enabled >/dev/null
  fi
  local feature_id
  feature_id=$($FS feature get "$flag" --jq '.id')

  # 2. Keyed variants at weight 0: the experiment sets the real split.
  #    Without a key Flagsmith does not count exposures.
  local per_variant=$(( split / ${#variants[@]} ))
  local project_id
  project_id=$($FS config --jq '.project.value')
  local allocations=""
  for pair in "${variants[@]}"; do
    local key="${pair%%=*}" value="${pair#*=}"
    $FS feature variant add "$flag" --key "$key" --value "$value" --weight 0 >/dev/null 2>&1 || true
    local option_id
    option_id=$($FS api "api/v1/projects/$project_id/features/$feature_id/mv-options/" \
      --jq "[.results[]? // .[]? | select(.key == \"$key\") | .id][0]")
    [[ -n "$allocations" ]] && allocations+=","
    allocations+="{\"multivariate_feature_option\":$option_id,\"percentage_allocation\":$per_variant}"
  done
  allocations="[$allocations]"

  # 3. Metric: the event name must match the app's trackEvent call exactly.
  local metric_id
  metric_id=$(api experiment-metrics/ --jq "[.results[]? | select(.definition.event == \"$event\") | .id][0] // empty")
  if [[ -z "$metric_id" ]]; then
    metric_id=$(printf '{"name":"%s","aggregation":"occurrence","direction":"up","definition":{"version":1,"event":"%s"}}' \
      "$event" "$event" | api experiment-metrics/ -X POST --input - --jq '.id')
  fi

  # 4. Experiment, created but NOT started.
  local experiment_id
  experiment_id=$(cat <<JSON | api experiments/ -X POST --input - --jq '.id'
{"feature":$feature_id,"name":"$flag experiment","hypothesis":"$hypothesis",
 "metrics":[{"metric":$metric_id,"expected_direction":"increase"}],
 "experiment_rollout":{"enabled":true,"rollout_percentage":100,
   "feature_state_value":{"type":"string","value":"control"},
   "multivariate_feature_state_values":$allocations}}
JSON
)
  echo "created: flag=$flag(id $feature_id) metric=$event(id $metric_id) experiment=$experiment_id status=created"
  echo "next: ship code using getExperimentFlag('$flag') + trackEvent('$event'), then: exp.sh start $experiment_id --apply"
}

cmd_start() {
  local id="${1:?experiment_id}"
  guard_write "start experiment $id (real users start getting variants)"
  api "experiments/$id/start/" -X POST --jq '"experiment \(.id): \(.status) since \(.started_at)"'
}

cmd_results() {
  local id="${1:?experiment_id}"
  # Refresh is limited to once per 5 minutes; a cooldown is fine, we read the last snapshot.
  api "experiments/$id/results/refresh/" -X POST >/dev/null 2>&1 || true
  api "experiments/$id/results/" --jq '
    .results as $r
    | if $r == null or $r.payload == null then "no results yet (need traffic; first refresh can take minutes)"
      else
        ($r.payload.metrics[0]) as $m
        | ([$m.variants | to_entries[] | "\(.key): \(.value.sum)/\(.value.n) = \(if .value.n > 0 then (.value.sum / .value.n * 1000 | round / 10) else 0 end)%"] | join(" | ")),
          ([$m.inference | to_entries[] | select(.value != null)
            | "\(.key) vs control: lift \(.value.lift * 1000 | round / 10)%, 95% CI [\(.value.ci_low * 1000 | round / 10), \(.value.ci_high * 1000 | round / 10)], P(beats control) \(.value.chance_to_win * 1000 | round / 10)%"] | join("\n")),
          (if ($r.payload.srm_p_value // 1) < 0.001 then "WARNING: sample ratio mismatch - do not trust these results" else empty end),
          ("verdict: " + (
            [$m.inference | to_entries[] | select(.value != null)] as $inf
            | if ($inf | length) == 0 then "not enough data (need 50+ users and 5+ conversions per variant)"
              elif ($inf | map(select(.value.chance_to_win >= 0.95)) | length) > 0
                then "WINNER " + ($inf | max_by(.value.chance_to_win) | .key)
              elif ($inf | all(.value.chance_to_win <= 0.05)) then "control wins"
              else "inconclusive - keep running" end)),
          "as of \($r.as_of)"
      end'
}

cmd_finish() {
  local id="${1:?experiment_id}" decision="${2:?control|variant_key|disable}"
  local body
  if [[ "$decision" == "control" || "$decision" == "disable" ]]; then
    body="{\"rollout_decision\":\"$decision\"}"
  else
    local feature_id project_id option_id
    feature_id=$(api "experiments/$id/" --jq '.feature | if type == "object" then .id else . end')
    project_id=$($FS config --jq '.project.value')
    option_id=$($FS api "api/v1/projects/$project_id/features/$feature_id/mv-options/" \
      --jq "[.results[]? // .[]? | select(.key == \"$decision\") | .id][0] // empty")
    [[ -n "$option_id" ]] || die "no variant with key '$decision'"
    body="{\"rollout_decision\":\"variant\",\"rollout_variant\":$option_id}"
  fi
  guard_write "end experiment $id and roll out '$decision' to everyone"
  echo "$body" | api "experiments/$id/complete/" -X POST --input - \
    --jq '"experiment \(.id): \(.status), rolled out \(.rollout_decision)"'
  echo "next: remove the losing code path from the app, then delete or archive the flag when no code uses it"
}

cmd_stale() {
  local days="${1:-30}"
  local project_id
  project_id=$($FS config --jq '.project.value')
  local since
  since=$(date -u -d "-$days days" +%s 2>/dev/null || date -u -v-"$days"d +%s)
  # Flags with no audit-log activity in N days are candidates. (Flagsmith's own stale tag is a paid feature.)
  $FS api "api/v1/projects/$project_id/features/?page_size=100" --jq '[.results[] | .name] | .[]' | while read -r name; do
    local last
    last=$($FS api "api/v1/projects/$project_id/audit/?search=$name&page_size=1" --jq '.results[0].created_date // empty')
    if [[ -z "$last" ]] || [[ $(date -u -d "$last" +%s) -lt $since ]]; then
      echo "stale? $name (last change: ${last:-never})"
    fi
  done
}

case "${1:-}" in
  preflight) shift; cmd_preflight "$@" ;;
  create) shift; cmd_create "$@" ;;
  start) shift; cmd_start "$@" ;;
  results) shift; cmd_results "$@" ;;
  finish) shift; cmd_finish "$@" ;;
  stale) shift; cmd_stale "$@" ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac

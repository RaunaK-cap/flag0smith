# Flagsmith Cloud API reference for FlagPilot

**Base URL** `https://api.flagsmith.com/api/v1/`. Append the relative paths below, including the trailing slash. Management requests use `Authorization: Api-Key <token>`. The organisation issues the token from Settings → API Access. Send JSON with `Content-Type: application/json`. SDK endpoints use a separate credential.

Every endpoint below was checked by method and path against the public Cloud OpenAPI schema and the Django source at `98fa536` (still `main` HEAD on 2026-11-27); bodies were checked against serializers. Examples use illustrative IDs. No authenticated Cloud calls were made, so live behaviour (plan gating, beta access) is **UNVERIFIED**. The generated schema omits the experiment results/exposures payloads and several nested bodies; the source fills those in. [Cloud OpenAPI JSON](https://api.flagsmith.com/api/v1/swagger.json) · [Management authentication](https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview/management-api/authentication) · [Pinned API source](https://github.com/Flagsmith/flagsmith/tree/98fa536/api)

## Discovery and keys

| Request | Body | Response and use |
|---|---|---|
| GET `organisations/` | None | Paginated organisations with `id`, `name`. |
| GET `projects/` or `organisations/{orgId}/projects/` | None | Projects with `id`, `name`, `organisation`. The former returns an array. Inspect `use_edge_identities` for identity storage. |
| GET `environments/?project={projectId}` | None | Paginated environments. Save `id` (integer), `api_key` (client-side SDK key), `name`, `project`, `use_v2_feature_versioning` and `minimum_change_request_approvals`. GET `environments/{api_key}/` retrieves one. |
| GET / POST `environments/{api_key}/api-keys/` | POST `{"name":"traffic-simulator"}` | Server-side SDK key records include `id`, `name`, `key`, `active`, `expires_at`. Use the returned `ser.…` key in the simulator. |

In the tables, **P** = `projects/{projectId}`, **E** = `environments/{api_key}`, **F** = `P/features/{featureId}`. The API key in E selects the environment. Keep sending the management token in the header. Ordinary paginated lists return `{count,next,previous,results}`. Follow `next` until null. Edge pagination is documented below.

## Flags, tags and owners

| Request | Example body | Result and gotchas |
|---|---|---|
| GET `P/features/`, GET `F/` | None | Returns feature IDs, UUIDs, names, types, tags, owners, group owners, defaults. List accepts `search`, `tags`, `owners`, `group_owners`, `is_archived`, `lifecycle_stage`. Pass numeric `environment` to include the environment state. |
| POST `P/features/` | `{"name":"checkout_button","type":"MULTIVARIATE","initial_value":"control","default_enabled":true}` | Returns the project feature and its numeric ID. `type` is `STANDARD` or `MULTIVARIATE`. Only `name` is required. Nested `multivariate_options` in this body can set values and `default_percentage_allocation` but `key` is read-only there, so create keyed options via `F/mv-options/` below. |
| PATCH / PUT `F/` | PATCH `{"description":"Checkout CTA","tags":[3]}` | Updated feature. Tags are project-local numeric IDs. Set environment-specific values through feature states. |
| DELETE `F/` | None | Removes the project flag across environments. To archive, PATCH `{"is_archived":true}`. |
| GET / POST `P/tags/`, GET / PATCH / PUT / DELETE `P/tags/{id}/` | POST `{"label":"checkout","color":"#1565C0"}` | Returns `id,label,color,project,is_permanent,type`. A permanent tag exempts flags from stale detection. |
| POST `F/add-owners/` or `F/remove-owners/` | `{"user_ids":[12]}` | Re-read `F/` for the `owners` list. For groups use `add-group-owners/` or `remove-group-owners/` and `{"group_ids":[4]}`. |

### Environment states and versions

| Request | Example body | Result and gotchas |
|---|---|---|
| GET `E/featurestates/?feature={featureId}`, GET `E/featurestates/{stateId}/` | None | Environment default state has its own `id`, `feature`, `enabled`, scalar `feature_state_value`, `multivariate_feature_state_values`. Use the state ID for direct edits. |
| PATCH / PUT `E/featurestates/{stateId}/` | `{"enabled":true,"feature_state_value":"control"}` | Legacy direct update accepts a scalar value through custom view logic despite its read-only appearance in the schema. Legacy default writes return 400 under v2. |
| GET / POST `environments/{numericEnvId}/features/{featureId}/versions/` | POST `{"description":"Change CTA","feature_states_to_update":[{"enabled":true,"feature_state_value":{"type":"unicode","string_value":"Buy"}}]}` | Returns a version `uuid`, `published`, `is_live`, `live_from`. Defaults to draft; `publish_immediately:true` in the POST publishes at once. Also `feature_states_to_create`, `segment_ids_to_delete_overrides`. Omitting `feature_segment` targets the default. Use `feature_states_to_create` for new segment overrides. |
| GET `environment-feature-versions/{uuid}/`; GET `versions/{uuid}/featurestates/` under the same numeric environment and feature | None | First returns version metadata including previous version UUID. Second returns states in that snapshot. POST `…/featurestates/` adds a state to a draft. State detail accepts PATCH / PUT / DELETE on `…/featurestates/{stateId}/` for editable drafts. DELETE `…/versions/{uuid}/` discards a draft. |
| POST `…/versions/{uuid}/publish/` | `{}` for immediate publication or `{"live_from":"2027-01-01T12:00:00Z"}` | Publishes the draft. Re-read metadata for `is_live`. Direct publication is gated when change requests are enforced. |

A simpler alternative (in the schema, path prefix `/api/__future__/`, not `/api/v1/`): `/api/__future__/environments/{api_key}/features/{featureId}/`. GET reads the default and segment overrides. PATCH updates one or both: `{"environment_default":{"enabled":true,"value":{"type":"string","value":"Buy"},"variants":[{"id":23,"weight":50}]},"segment_overrides":[{"segment":{"id":6},"enabled":true,"priority":0,"value":{"type":"string","value":"VIP"}}]}`. `value.type` is `string|integer|boolean`, `variants[].id` is the mv option ID. Also `…/segment-overrides/{segmentId}/`. Works on v1 and on v2 with direct writes enabled. The legacy `/api/v1/` flag-state routes use `unicode|int|bool` types instead. [Flag update examples](https://docs.flagsmith.com/managing-flags/updating-flags) · [Versioning](https://docs.flagsmith.com/managing-flags/feature-versioning) · [Legacy state view](https://github.com/Flagsmith/flagsmith/blob/98fa536/api/features/views.py)

### Multivariate options

GET / POST `F/mv-options/`. GET / PATCH / PUT / DELETE `F/mv-options/{optionId}/`. Create a keyed option with numeric parent feature ID:

```json
{"feature":17,"key":"buy_now","type":"unicode","string_value":"Buy now","default_percentage_allocation":0}
```

`key` is writable only on this endpoint (unique per feature, `control` is reserved). The result includes `id,uuid,feature,key,type` and the typed value and default weight. PATCH e.g. `{"default_percentage_allocation":25}`. Value types are `unicode`, `int`, `bool` with `string_value`, `integer_value`, `boolean_value`. The option ID identifies the variant in rollout writes. Its key identifies the variant in experiment results.

For an existing environment, update the feature state with `multivariate_feature_state_values`. Each entry has its own state-value `id`, an option ID, and a percentage. Send the intended list, retaining existing row IDs on legacy nested updates. Example legacy PATCH:

```json
{"multivariate_feature_state_values":[{"id":82,"multivariate_feature_option":23,"percentage_allocation":50}]}
```

On v2 place the weight list inside the appropriate `feature_states_to_update` item and publish. Weights total at most 100. The base flag receives the remainder. For an experiment, put enrolment and treatment weights in its rollout as shown below.

## Segments and targeting

GET / POST `P/segments/`; GET / PATCH / PUT / DELETE `P/segments/{segmentId}/`. The create response contains `id,uuid,name,project,rules`. Rule `type` is `ALL|ANY|NONE`. Conditions and child rules are distinct arrays. Example matching a plan trait:

```json
{"name":"Pro customers","rules":[{"type":"ALL","conditions":[],"rules":[{"type":"ANY","conditions":[{"property":"plan","operator":"EQUAL","value":"pro"}],"rules":[]}]}]}
```

| Request | Example body | Result and gotchas |
|---|---|---|
| POST `E/features/{featureId}/create-segment-override/` | `{"feature_segment":{"segment":6},"enabled":true,"feature_state_value":{"type":"unicode","string_value":"Early access"}}` | Creates the legacy targeting association and its state together. Read the returned state ID and nested feature-segment ID separately. |
| GET / POST `features/feature-segments/` | POST `{"feature":17,"segment":6,"environment":2}` | Lower-level association. List with `?environment=2&feature=17`. GET / DELETE `features/feature-segments/{id}/`. GET `features/featurestates/?environment=2&feature=17&feature_segment={associationId}` finds the associated state. |
| PATCH `features/featurestates/{stateId}/` | `{"enabled":true,"feature_state_value":{"type":"unicode","string_value":"VIP"}}` | Nested-value legacy route. Preserve targeting on updates. For v2, create/update the override inside a version with `feature_segment: {"segment":6}`. |
| POST `features/feature-segments/update-priorities/` | `[{"id":81,"priority":0},{"id":82,"priority":1}]` | Supply association IDs from the same environment and feature, with distinct priorities. Smaller numbers take precedence. V2 associations must belong to one editable version. Re-read the list for the resulting order. |

## Identities and traits

| Operation | Core database | Edge identities (typical Cloud project) |
|---|---|---|
| List or search | GET `E/identities/?q=alice`. Quoted search such as `q=%22alice%22` matches exactly. Response includes numeric `id`, `identifier`. | GET `E/edge-identities/?q=alice`. Response `{results,last_evaluated_key}`. Pass the opaque cursor until null. Keep `identity_uuid`. Unquoted `q` is a begins-with match, quoted is exact; prefix `dashboard_alias:` searches aliases. POST `E/edge-identities/` creates an identity. By identifier without the UUID: PUT / DELETE `/api/v1/environments/environments/{api_key}/edge-identities-featurestates` (doubled `environments`, no trailing slash) with `{"identifier":"alice","feature":17,"enabled":true,"feature_state_value":"Buy"}`. GET `E/edge-identity-overrides` lists overrides per feature. |
| Read/write traits | GET / POST `E/identities/{id}/traits/`; PATCH / DELETE `…/traits/{traitId}/`. POST e.g. `{"trait_key":"plan","trait_value":"pro"}`. | GET `E/edge-identities/{uuid}/list-traits/`; PUT `…/update-traits/` with one `{"trait_key":"plan","trait_value":"pro"}` object. Returns the trait. Trait persistence must be enabled. |
| Read flags | GET `E/identities/{id}/featurestates/all/` | GET `E/edge-identities/{uuid}/edge-featurestates/all/` |
| Create/read overrides | GET / POST `E/identities/{id}/featurestates/`, PATCH / DELETE `…/featurestates/{stateId}/`. POST e.g. `{"feature":17,"enabled":true,"feature_state_value":"Buy"}`. | GET / POST `E/edge-identities/{uuid}/edge-featurestates/`. Same example. Returned `featurestate_uuid` addresses PUT / DELETE `…/edge-featurestates/{featurestate_uuid}/`. PUT includes the feature. |

For runtime evaluation by an external identifier, SDK GET `identities/?identifier=alice` returns `flags` and `traits` using `X-Environment-Key`. The default Cloud SDK service is on the Edge network. For a management console, use the storage-specific routes above. [Edge views](https://github.com/Flagsmith/flagsmith/blob/98fa536/api/edge_api/identities/views.py) · [Core identity views](https://github.com/Flagsmith/flagsmith/blob/98fa536/api/environments/identities/views.py)

## Cloning and comparing environments

POST `E/clone/` with `{"name":"QA copy"}`. Response includes the new `id,name,api_key,project`. With `"clone_feature_states_async":true`, wait until the new environment reports `is_creating:false` before comparing it.

SDK GET `environment-document/` takes `X-Environment-Key: <server-side environment key>` and no body. Response includes `api_key,name,feature_states,identity_overrides,project` with project segments. For a default-state diff, fetch all pages of each environment's `featurestates/` and join by project feature ID. Compare enabled, typed value and option weights by option ID. Compare segment associations separately by segment ID. A supported single-call Cloud diff is **UNVERIFIED**.

## Experimentation (beta)

All management paths in this section use E, including the client key as path selector. A warehouse connection belongs to one environment. Start with a multivariate flag, a base value for control and at least one treatment with a stable, nonempty option key. The key `control` is reserved. An unkeyed treatment can serve a value without recording usable exposure data. [Setup recipe](https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent) · [Metric definitions](https://docs.flagsmith.com/experimentation/create-metrics)

| Request | Example body | Result and constraints |
|---|---|---|
| GET / POST `E/warehouse-connections/`; GET / PATCH / PUT / DELETE `…/{connectionId}/` | Managed Cloud warehouse: `{"warehouse_type":"flagsmith"}` | `warehouse_type`: `flagsmith|snowflake|clickhouse|databricks|postgres`; `status`: `created|pending_connection|connected|errored`; `name` optional. List takes `?exclude_event_stats=true`. Returns `id,warehouse_type,name,status,status_detail,config,created_at,total_events_received,unique_events_count,last_event_received_at`. External providers use provider-specific `config` and write-only `credentials`. One connection per environment. |
| POST `E/warehouse-connections/{connectionId}/test-warehouse-connection/`; POST `E/warehouse-connections/test-warehouse-connection/`; GET `…/{connectionId}/events/` | First: no body. Second: unsaved `{warehouse_type,config,credentials}` | First returns the connection (`flagsmith` type: re-reads event stats). Second returns `{status,status_detail}`. Third returns `{events:[…],is_truncated}`; 400 if unsupported, 503 if warehouse unreachable. |
| GET / POST `E/experiment-metrics/`, GET / PATCH / PUT / DELETE `…/{metricId}/` | `{"name":"Checkout completed","aggregation":"occurrence","direction":"up","definition":{"version":1,"event":"purchase"}}` | Returns `id,name,description,aggregation,direction,definition,experiments`. Aggregations: `occurrence|count|sum|mean` (default mean). `definition` is `{"version":1,"event":"<name>"}` (version and non-empty event required). Sum/mean need numeric event values. Direction: up, down, informational. Deleting a metric attached to an active experiment returns 409. |
| GET / POST `E/experiments/` | Create example below | List accepts `?status=running&status=paused` (repeatable) and `q`, and adds `status_counts`. Returns `id,feature,name,hypothesis,status,metrics,created_at,updated_at,started_at,ended_at,rollout_decision,rollout_variant`; GET detail adds `experiment_rollout`. Only a MULTIVARIATE feature of the same project is accepted (400). One noncompleted experiment per feature/environment (409 on collision). |
| GET / PATCH / PUT / DELETE `E/experiments/{id}/` | PATCH `{"hypothesis":"Shorter copy increases purchases"}` | Feature is fixed after creation. Use nested metric or rollout endpoints for those edits. Pause or complete before deleting a running experiment. |
| GET / POST `E/experiments/{id}/metrics/`, GET / PATCH / PUT / DELETE `…/metrics/{attachmentId}/` | POST `{"metric":7,"expected_direction":"increase"}` | Attachment has its own ID, `metric,metric_name,aggregation,direction,expected_direction`. Other expectations: decrease, not_increase, not_decrease. |
| PATCH `E/experiments/{id}/rollout/` | Send the full inner `experiment_rollout` object below; optional `"audience":{"match":"any","segment_ids":[6]}` (max 1 segment; empty list = everyone; omitted = unchanged) | Returns updated experiment. Audience can change only before traffic starts. Not allowed via PATCH `E/experiments/{id}/`. |
| POST `E/experiments/{id}/start/`, POST `…/{id}/pause/` | No body | Start enables the rollout override. Statuses: `created`, `running`, `paused`, `completed`. Transitions: created → running, running → paused, running|paused → completed, paused → running. Read `status,started_at`. Invalid transitions return 400. |
| POST `E/experiments/{id}/complete/` | `{"rollout_decision":"control"}` or `{"rollout_decision":"variant","rollout_variant":23}` or `{"rollout_decision":"disable"}` | Ends running or paused experiment, removes rollout override, applies chosen outcome. Response includes `status:"completed",ended_at,rollout_decision,rollout_variant`. Terminal status. |

**Create body.** `feature`, `name`, `hypothesis` and `experiment_rollout` are required by the serializer. Inline metrics are optional. Enrolment is a percentage of eligible identities. Option allocations split the enrolled population. Here 100% enrol and half receive option 23.

```json
{
  "feature": 17,
  "name": "Checkout copy",
  "hypothesis": "Buy now increases checkout completion",
  "metrics": [{"metric": 7, "expected_direction": "increase"}],
  "experiment_rollout": {
    "enabled": true, "rollout_percentage": 100,
    "feature_state_value": {"type": "string", "value": "control"},
    "multivariate_feature_state_values": [{"multivariate_feature_option": 23, "percentage_allocation": 50}]
  }
}
```

### Results and exposures

GET `E/experiments/{id}/results/` and GET `E/experiments/{id}/exposures/` read independent cached computations. POST `…/{id}/results/refresh/` or `…/{id}/exposures/refresh/` with no body queues the corresponding computation (202). Poll GET for a newer `as_of`. Each refresh action has a five-minute cooldown (429). Refresh is refused before first start and after its computation becomes final. The separate GET `E/experiments/results/?feature={featureId}` has a different analytics contract.

The wire shapes below come from the per-experiment views, serializers and dataclasses. Dictionary keys such as `control` and `buy_now` are variant keys. Timestamp strings are ISO datetimes. [Views](https://github.com/Flagsmith/flagsmith/blob/98fa536/api/experimentation/views.py) · [Serializers](https://github.com/Flagsmith/flagsmith/blob/98fa536/api/experimentation/serializers.py) · [Payload types](https://github.com/Flagsmith/flagsmith/blob/98fa536/api/experimentation/dataclasses.py) · [Calculations](https://github.com/Flagsmith/flagsmith/blob/98fa536/api/experimentation/services.py)

```ts
type ByVariant<T> = Record<string, T>
type Series<P> = { granularity: 'hour' | 'day', points: P[] }
type ExposuresSeries = Series<{ bucket: string, new_identities: ByVariant<number> }>
type ConversionsSeries = Series<{ bucket: string, converted_identities: ByVariant<number> }>
type Snapshot<T> = {
  as_of: string | null
  last_error_at: string | null
  refresh_requested_at: string | null
  payload: T | null
  is_final: boolean
}
type ExposuresResponse = { exposures: Snapshot<{
  excluded_identities: number
  timeseries: ExposuresSeries
}> | null }
type ResultsResponse = { results: Snapshot<{
  srm_p_value: number | null
  exposures_timeseries: ExposuresSeries
  metrics: Array<{
    metric_id: number
    variants: ByVariant<{ n: number, sum: number, sum_squares: number }>
    inference: ByVariant<{
      lift: number, ci_low: number, ci_high: number, chance_to_win: number
    } | null>
    conversions_timeseries: ConversionsSeries | null
  }>
}> | null }
```

Example `GET …/results/` (variant keys `control`, `buy_now`; `delta` = `lift`):

```json
{"results":{"as_of":"2026-11-27T10:00:00Z","last_error_at":null,"refresh_requested_at":null,"is_final":false,
 "payload":{"srm_p_value":0.42,"exposures_timeseries":{"granularity":"day","points":[{"bucket":"2026-11-26T00:00:00Z","new_identities":{"control":120,"buy_now":118}}]},
  "metrics":[{"metric_id":7,"variants":{"control":{"n":500,"sum":50,"sum_squares":50},"buy_now":{"n":498,"sum":65,"sum_squares":65}},
   "inference":{"buy_now":{"lift":0.3,"ci_low":0.02,"ci_high":0.58,"chance_to_win":0.98}},"conversions_timeseries":null}]}}}
```

`results` is `null` until the first refresh completes. Typical loop: POST start, send traffic, POST `results/refresh/` (202), wait, GET `results/`.

- Sum the per-bucket `new_identities` for cumulative exposures. The exposures endpoint reports quarantined identities separately. The results payload carries its own denominator series for matching the metric refresh time.
- For occurrence, `sum / n` is conversion rate. Absolute delta is treatment rate minus control rate. The wire field `lift` is relative change: 0.12 means +12%. `ci_low,ci_high` bound the 95% credible interval on relative lift. Inference is keyed by treatment only.
- `chance_to_win` is a 0–1 probability against control, oriented to the metric's beneficial direction. There is no chance-to-be-best across all arms: inference is pairwise treatment vs control only, and `chance_to_win` is flipped (1 − p) for `direction:"down"` metrics. Docs verdicts: winning above 0.95, losing below 0.05, else inconclusive. The dashboard derives the SRM warning when `srm_p_value !== null && srm_p_value < 0.001`.
- SRM requires at least 100 total identities and usable expected shares. Per-arm inference requires 50 identities per arm, plus five conversions per arm for occurrence and a positive control mean. Preserve nulls. For a sample read, `variants.control.sum / variants.control.n` is the control rate. Failed refreshes can leave the previous successful payload in place. [Thresholds](https://github.com/Flagsmith/flagsmith/blob/98fa536/api/experimentation/constants.py) · [Statistical model](https://github.com/Flagsmith/flagsmith/blob/98fa536/api/experimentation/stats.py) · [Analysis guide](https://docs.flagsmith.com/experimentation/analyse-an-experiment)

## Scheduling, approvals and history

| Request | Example body | Result and gotchas |
|---|---|---|
| POST `E/create-change-request/` | Legacy: `{"title":"Enable checkout","feature_states":[{"feature":17,"enabled":true,"live_from":"2027-01-01T12:00:00Z"}]}` | Returns a change request ID and proposed states. On v2 supply `feature_states:[]` and version change sets as below. Use timezone-qualified ISO timestamps. |
| GET `E/list-change-requests/`; GET / PATCH / PUT / DELETE `features/workflows/change-requests/{id}/` | GET has no body | Inspect `approvals,is_approved,is_committed,committed_at,conflicts` on detail. V2 proposals carry `change_sets,environment_feature_versions`. |
| POST `features/workflows/change-requests/{id}/approve/` then POST `…/{id}/commit/` | No body | Re-read request status. Required approvals depend on environment configuration. Committing a future change schedules it. Without an approval requirement, v2 also supports direct scheduled publication via `publish/` with `live_from`. |
| GET `audit/`, `P/audit/` or `organisations/{orgId}/audit/` | None | Paginated. Query parameters include `environments,project,organisation,search,is_organisation_level,is_system_event,page,page_size`. Entries include `created_date,log,author,related_object_type,related_object_id,related_object_uuid`. |
| GET `environments/{numericEnvId}/features/{featureId}/versions/` | None | Version history including draft/published/live state. Retention depends on subscription. GET states within each version for a historical comparison. Legacy edits appear as FEATURE_STATE audit events; v2 publications use EF_VERSION and the UUID. |

Example v2 change request:

```json
{"title":"Schedule checkout","feature_states":[],"change_sets":[{"feature":17,"live_from":"2027-01-01T12:00:00Z","feature_states_to_create":[],"feature_states_to_update":[{"enabled":true,"feature_state_value":{"type":"unicode","string_value":"Buy"}}],"segment_ids_to_delete_overrides":[]}]}
```

Project-level segment changes use GET / POST `P/change-requests/`, with `title` and `segments` in the create body and `P/change-requests/{id}/approve/` and `commit/` for approval and application. [Change requests](https://docs.flagsmith.com/administration-and-security/governance-and-compliance/change-requests) · [Scheduling](https://docs.flagsmith.com/managing-flags/scheduled-flags)

## Webhooks

GET / POST `E/webhooks/` or `organisations/{orgId}/webhooks/`. Create with `{"url":"https://example.com/flagsmith","enabled":true,"secret":"replace-with-shared-secret"}`. Both return configuration fields including `id,url,enabled,created_at,updated_at`. PATCH / PUT / DELETE the configuration at `…/webhooks/{id}/`.

Flag changes produce an HTTP POST to the registered receiver. Selected environment payload fields:

```json
{"event_type":"FLAG_UPDATED","data":{"timestamp":"2026-11-26T12:00:00Z","changed_by":"user@example.com","previous_state":{"enabled":false},"new_state":{"enabled":true,"environment":{"id":2,"name":"QA"},"feature":{"id":17,"name":"checkout_button"},"feature_state_value":"Buy","feature_segment":null,"identity":null}}}
```

Version publication also generates an environment `NEW_VERSION_PUBLISHED` summary. An organisation audit webhook can receive audit records with `created_date,log,author,environment,project,related_object_type,related_object_id,related_object_uuid`. Preserve nullable IDs. With a shared secret, compare `X-Flagsmith-Signature` against the hex HMAC-SHA256 of the original HTTP body bytes keyed by the UTF-8 secret. Re-serializing parsed JSON changes the digest. [Environment payload](https://docs.flagsmith.com/administration-and-security/platform-configuration/environment-settings) · [Organisation audit payload](https://docs.flagsmith.com/administration-and-security/governance-and-compliance/audit-logs)

## Stale flags, code references and health

| Request | Example body | Response and interpretation |
|---|---|---|
| GET `P/tags/`, then GET `P/features/?tags={tagId}` | None | Find the system tag with `type:"STALE"` and filter by ID. Project `stale_flags_limit_days` controls the threshold. |
| POST `P/code-references/` | `{"repository_url":"https://github.com/example/shop","revision":"abc123","code_references":[{"feature_name":"checkout_button","file_path":"src/cart.ts","line_number":12}]}` | Submit a repository scan. Read back with GET `F/code-references/` for repository summaries and matching locations, revisions and scan timestamps. |
| GET `P/feature-health/providers/`, POST same | `{"project":1,"name":"monitor"}` | Provider configuration includes `name,project,webhook_url`. Use the generated URL for incoming health events. |
| GET `P/feature-health/events/`; POST `P/feature-health/events/{id}/dismiss/` | No body | Events identify `id,feature,environment,provider_name,type,reason,created_at`. Dismiss by event ID. |

## Node simulator

Install `@flagsmith/nodejs@^9.1.0` (experiment APIs arrived in 9.1.0; verified in the published 9.1.0 and 9.5.0 packages). Experiment data (`flag.variant`, `flag.experiment`) is set by **remote** identity evaluation only, so do not enable local evaluation. `environmentKey` may be the client-side or a server-side key (docs: events accept both); the SDK sends it as `X-Environment-Key`. `enableEvents: true` is required or `getExperimentFlag`/`trackEvent` throw. Self-hosted: set `apiUrl` and `eventProcessorConfig.eventsApiUrl` (default `https://events.api.flagsmith.com/`; for the Flagsmith-database warehouse use your API URL ending `/api/`; the SDK appends `v1/events`).

| Call | Signature |
|---|---|
| `getExperimentFlag` | `async (featureName, identifier, traits?) => Flag`. Evaluates remotely and records `$flag_exposure` itself only if the flag is enabled and `flag.experiment.inExperiment`. |
| `trackEvent` | sync `(event, {identifier?, value?, traits?, metadata?}) => void`. Names starting with `$` throw. |
| `trackExposureEvent` | sync `(featureName, {identifier, value?, traits?, metadata?})`. Only for flags evaluated elsewhere. |
| `flushEvents` / `close` | `async () => void` / `async (timeoutMs?) => void` (`timeoutMs` in newer versions). Buffer flushes every 10s by default (`eventProcessorConfig.flushInterval`, `maxBuffer`). |

```js
import { randomUUID } from 'node:crypto'
import { Flagsmith } from '@flagsmith/nodejs'

const sdk = new Flagsmith({
  environmentKey: process.env.FLAGSMITH_ENVIRONMENT_KEY,
  enableEvents: true,
  // apiUrl: 'https://flagsmith.example.com/api/v1/',                     // self-hosted only
  // eventProcessorConfig: { eventsApiUrl: 'https://events.example.com/' }, // self-hosted only
})
const run = randomUUID()
try {
  for (let i = 0; i < 300; i++) {
    const identifier = `sim-${run}-${i}`
    const flag = await sdk.getExperimentFlag('checkout_button', identifier)
    if (flag.experiment?.inExperiment && Math.random() < 0.25) {
      sdk.trackEvent('purchase', { identifier, value: 1 })
    }
  }
} finally {
  await sdk.close()
}
```

Use the same identifier for exposure and conversion, and exact (case-sensitive) event names matching the metric `definition.event`. Do not also call `trackExposureEvent` for flags read through `getExperimentFlag`. [SDK guide](https://docs.flagsmith.com/experimentation/run-an-experiment) · [SDK source](https://github.com/Flagsmith/flagsmith-nodejs-client/blob/main/sdk/index.ts)

## Plan limits

| Cloud capability | Verified constraint |
|---|---|
| Scheduled flags and feature/segment change requests | Scale-Up or Enterprise. Environment approval configuration determines whether direct publication is available. [Scheduling](https://docs.flagsmith.com/managing-flags/scheduled-flags) · [Change requests](https://docs.flagsmith.com/administration-and-security/governance-and-compliance/change-requests) |
| Granular permissions on management tokens and OIDC trust relationships | Scale-Up or Enterprise. [Authentication](https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview/management-api/authentication) |
| Stale flag detection | Scale-Up or Enterprise. [Stale flags](https://docs.flagsmith.com/managing-flags/stale-flags) |
| Bring your own ClickHouse, Databricks or PostgreSQL warehouse | Scale-Up or Enterprise. Managed Flagsmith warehouse is Cloud-only. Provider schema includes Snowflake, but docs list it as coming soon. The `flagsmith` warehouse type is auto-created on Cloud when the organisation's `experimentation_warehouses` config enables it. [Warehouse options](https://docs.flagsmith.com/experimentation/connect-a-warehouse) |

## Open questions

- **UNVERIFIED** for this organisation: beta access, permissions, history retention, plan-specific audit/webhook access and warehouse quotas. No authenticated requests were made.
- **UNVERIFIED** (not found in schema or source, so treat as absent): a dedicated environment-diff resource and standalone v1 history replay. Confirmed absent: a chance-to-be-best field; results expose pairwise chance to beat control only.
- **UNVERIFIED**: Cloud deployment parity with the pinned source's newest beta payload fields. The public schema omits the per-experiment computation payloads. Handle a missing snapshot or null payload explicitly.

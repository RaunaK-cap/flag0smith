# Flagsmith API calls used by exp.sh

All via `flagsmith api api/v1/...` (credentials stay inside the CLI). E = `environments/<client env key>`.

| Step | Call |
|---|---|
| warehouse | GET `E/warehouse-connections/` -> `status` must be `connected` |
| metric | POST `E/experiment-metrics/` `{"name","aggregation":"occurrence","direction":"up","definition":{"version":1,"event":"<event>"}}` |
| experiment | POST `E/experiments/` `{"feature","name","hypothesis","metrics":[{"metric","expected_direction":"increase"}],"experiment_rollout":{"enabled":true,"rollout_percentage":100,"feature_state_value":{"type":"string","value":"control"},"multivariate_feature_state_values":[{"multivariate_feature_option","percentage_allocation"}]}}` |
| start | POST `E/experiments/<id>/start/` |
| results | POST `E/experiments/<id>/results/refresh/` (429 = 5 min cooldown), GET `E/experiments/<id>/results/` -> `results.payload.metrics[].variants{key:{n,sum}}`, `inference{key:{lift,ci_low,ci_high,chance_to_win}}`, `srm_p_value` |
| finish | POST `E/experiments/<id>/complete/` `{"rollout_decision":"control"|"disable"}` or `{"rollout_decision":"variant","rollout_variant":<option id>}` |

Common failures: no exposures -> variant has no key, no identity, or events not flushed.
Conversions missing -> event name or identifier mismatch.

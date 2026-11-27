// When the agent changes something in Flagsmith, show it as a readable card instead of raw JSON.
// describeChange() knows the Flagsmith tools; anything else stays a normal tool row.

import { Flag } from "lucide-react";
import type { ToolCall } from "@/lib/run-view";

type Field = { label: string; value: string };
type Change = { title: string; fields: Field[]; split?: { key: string; percent: number }[] };

function text(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}

export function describeChange(call: ToolCall): Change | null {
  const input = (call.input ?? {}) as Record<string, any>;
  const output = (call.output ?? {}) as Record<string, any>;

  switch (call.tool) {
    case "create_flag":
      return {
        title: "Flag created",
        fields: [
          { label: "flag", value: text(input.name) },
          { label: "type", value: text(input.type) },
          { label: "default", value: text(input.initialValue) },
          { label: "enabled", value: text(input.defaultEnabled) },
        ],
      };
    case "add_variant":
      return {
        title: "Variant added",
        fields: [
          { label: "key", value: text(input.key) },
          { label: "value", value: text(input.value) },
          { label: "weight", value: `${text(input.weight)}%` },
        ],
      };
    case "update_flag_state":
      return {
        title: "Flag updated",
        fields: [
          { label: "flag id", value: text(input.featureId) },
          { label: "enabled", value: text(input.enabled) },
          { label: "value", value: text(input.value) },
        ],
      };
    case "archive_flag":
      return { title: "Flag archived", fields: [{ label: "flag id", value: text(input.featureId) }] };
    case "create_segment":
      return {
        title: "Segment created",
        fields: [
          { label: "name", value: text(input.name) },
          {
            label: "rule",
            value: (input.conditions ?? [])
              .map((c: any) => `${c.property} ${c.operator} ${c.value}`)
              .join(input.match === "any" ? " OR " : " AND "),
          },
        ],
      };
    case "add_segment_override":
      return {
        title: "Segment override",
        fields: [
          { label: "flag id", value: text(input.featureId) },
          { label: "segment id", value: text(input.segmentId) },
          { label: "enabled", value: text(input.enabled) },
        ],
      };
    case "create_metric":
      return {
        title: "Metric created",
        fields: [
          { label: "name", value: text(input.name) },
          { label: "event", value: text(input.event) },
          { label: "counts", value: text(input.aggregation) },
          { label: "goal", value: input.direction === "down" ? "lower is better" : "higher is better" },
        ],
      };
    case "create_experiment": {
      const variants: { optionId: number; percentage: number }[] = input.variants ?? [];
      const treatment = variants.reduce((sum, v) => sum + v.percentage, 0);
      return {
        title: "Experiment created",
        fields: [
          { label: "name", value: text(input.name) },
          { label: "hypothesis", value: text(input.hypothesis) },
          { label: "status", value: text(output.status ?? "created") },
        ],
        split: [
          { key: "control", percent: 100 - treatment },
          ...variants.map((v) => ({ key: `option ${v.optionId}`, percent: v.percentage })),
        ],
      };
    }
    case "start_experiment":
    case "pause_experiment":
      return {
        title: call.tool === "start_experiment" ? "Experiment started" : "Experiment paused",
        fields: [
          { label: "experiment", value: `#${text(input.experimentId)}` },
          { label: "status", value: text(output.status) },
        ],
      };
    case "complete_experiment":
      return {
        title: "Experiment completed",
        fields: [
          { label: "experiment", value: `#${text(input.experimentId)}` },
          { label: "rolled out", value: text(input.decision === "variant" ? `option ${input.variantOptionId}` : input.decision) },
        ],
      };
    case "rollout_to_percentage":
      return {
        title: "Gradual rollout",
        fields: [{ label: "flag id", value: text(input.featureId) }],
        split: [
          { key: "on", percent: Number(input.percentage) },
          { key: "off", percent: 100 - Number(input.percentage) },
        ],
      };
    case "remove_rollout":
      return { title: "Rollout removed", fields: [{ label: "flag id", value: text(input.featureId) }] };
    case "set_identity_override":
      return {
        title: "User override",
        fields: [
          { label: "user", value: text(input.identifier) },
          { label: "flag id", value: text(input.featureId) },
          { label: "enabled", value: text(input.enabled) },
        ],
      };
    case "clone_environment":
      return { title: "Environment cloned", fields: [{ label: "name", value: text(input.name) }] };
    case "register_webhook":
      return { title: "Webhook added", fields: [{ label: "url", value: text(input.url) }] };
    default:
      return null;
  }
}

export function FlagsmithCard({ change }: { change: Change }) {
  return (
    <div className="max-w-md rounded-[5px] border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <Flag className="size-3 text-live" />
        <span className="text-[10.5px] tracking-[0.12em] text-muted-foreground uppercase">Flagsmith</span>
        <span className="ml-auto text-[11.5px]">{change.title}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-3 py-2 text-[11.5px]">
        {change.fields.map((field) => (
          <div key={field.label} className="contents">
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="min-w-0 break-words">{field.value}</dd>
          </div>
        ))}
      </dl>
      {change.split && <SplitBar split={change.split} />}
    </div>
  );
}

const splitColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function SplitBar({ split }: { split: { key: string; percent: number }[] }) {
  return (
    <div className="border-t px-3 py-2">
      <div className="flex h-1.5 overflow-hidden bg-muted">
        {split.map((part, i) => (
          <div key={part.key} style={{ width: `${part.percent}%`, background: splitColors[i % 4] }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10.5px] text-muted-foreground tabular">
        {split.map((part) => (
          <span key={part.key}>
            {part.key} {part.percent}%
          </span>
        ))}
      </div>
    </div>
  );
}

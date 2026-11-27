"use client";

import { DataState, PageHeader } from "@/components/page";
import { flagsmith, type SegmentRule } from "@/lib/api";
import { useData } from "@/lib/use-data";

// Flagsmith stores rules as a nested tree. This turns it into one readable line,
// e.g. "plan = pro AND country = IN".
function describeRules(rules: SegmentRule[]): string {
  const joiner = { ALL: " AND ", ANY: " OR ", NONE: " AND NOT " } as Record<string, string>;
  const parts = rules.map((rule) => {
    const conditions = (rule.conditions ?? []).map((c) =>
      c.operator === "PERCENTAGE_SPLIT" ? `${c.value}% of users` : `${c.property} ${operatorText(c.operator)} ${c.value}`,
    );
    const children = rule.rules?.length ? [describeRules(rule.rules)] : [];
    const all = [...conditions, ...children].filter(Boolean);
    return all.length > 1 ? `(${all.join(joiner[rule.type] ?? " AND ")})` : all[0] ?? "";
  });
  return parts.filter(Boolean).join(" AND ") || "everyone";
}

function operatorText(operator: string) {
  const map: Record<string, string> = {
    EQUAL: "=",
    NOT_EQUAL: "≠",
    GREATER_THAN: ">",
    LESS_THAN: "<",
    CONTAINS: "contains",
    IN: "in",
  };
  return map[operator] ?? operator.toLowerCase();
}

export default function SegmentsPage() {
  const { data, error, loading, reload } = useData(flagsmith.segments);
  const segments = data ?? [];

  return (
    <div>
      <PageHeader eyebrow="Flagsmith" title="Segments." rest="Groups of users that flags can target" onRefresh={reload} loading={loading} />
      <DataState loading={loading} error={error} empty={segments.length === 0} emptyText="No segments yet.">
        <div className="divide-y border-b">
          {segments.map((segment) => (
            <div key={segment.id} className="px-4 py-3.5 sm:px-8">
              <p className="text-[13px]">
                {segment.name} <span className="text-[11px] text-muted-foreground">· id {segment.id}</span>
              </p>
              {segment.description && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{segment.description}</p>}
              <p className="mt-2 inline-block rounded-[4px] border bg-card px-2 py-1 text-[11.5px] text-ink-2">
                {describeRules(segment.rules)}
              </p>
            </div>
          ))}
        </div>
      </DataState>
    </div>
  );
}

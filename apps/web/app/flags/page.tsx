"use client";

import { useMemo, useState } from "react";
import { DataState, OnOff, PageHeader } from "@/components/page";
import { Input } from "@/components/ui/input";
import { flagsmith, type FlagRow } from "@/lib/api";
import { useData } from "@/lib/use-data";

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export default function FlagsPage() {
  const { data, error, loading, reload } = useData(flagsmith.flags);
  const [search, setSearch] = useState("");

  const flags = useMemo(
    () => (data ?? []).filter((flag) => !flag.archived && flag.name.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );

  return (
    <div>
      <PageHeader eyebrow="Flagsmith" title="Flags." rest={`${flags.length} in this environment`} onRefresh={reload} loading={loading}>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search flags…"
          className="h-8 max-w-xs text-[12px]"
        />
      </PageHeader>

      <DataState loading={loading} error={error} empty={flags.length === 0} emptyText="No flags yet. Ask FlagPilot to create one.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12px]">
            <thead>
              <tr className="border-b text-left text-[10.5px] tracking-[0.12em] text-muted-foreground uppercase">
                <th className="px-4 py-2 font-normal sm:px-8">Flag</th>
                <th className="px-3 py-2 font-normal">State</th>
                <th className="px-3 py-2 font-normal">Value / variants</th>
                <th className="px-3 py-2 font-normal">Tags</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id} className="border-b align-top hover:bg-muted/40">
                  <td className="px-4 py-3 sm:px-8">
                    <p>{flag.name}</p>
                    {flag.description && <p className="mt-0.5 text-[11px] text-muted-foreground">{flag.description}</p>}
                    <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                      {flag.type === "MULTIVARIATE" ? "multivariate" : "standard"} · id {flag.id}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <OnOff on={flag.enabled} />
                  </td>
                  <td className="px-3 py-3">
                    <ValueCell flag={flag} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {flag.tags.map((tag) => (
                        <span key={tag} className="rounded-[4px] border px-1.5 text-[10.5px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </div>
  );
}

// Standard flags show their value. Multivariate flags show how traffic is split between variants.
function ValueCell({ flag }: { flag: FlagRow }) {
  if (flag.variants.length === 0) {
    return <span className="text-ink-2">{flag.value === null || flag.value === "" ? "—" : String(flag.value)}</span>;
  }
  const variantTotal = flag.variants.reduce((sum, v) => sum + v.weight, 0);
  const parts = [
    { key: `control (${String(flag.value ?? "")})`, weight: 100 - variantTotal },
    ...flag.variants.map((v) => ({ key: v.key ?? String(v.value), weight: v.weight })),
  ];
  return (
    <div className="w-56">
      <div className="flex h-1.5 overflow-hidden bg-muted">
        {parts.map((part, i) => (
          <div key={part.key} style={{ width: `${part.weight}%`, background: colors[i % colors.length] }} />
        ))}
      </div>
      <div className="mt-1.5 space-y-0.5 text-[10.5px] text-muted-foreground tabular">
        {parts.map((part, i) => (
          <p key={part.key} className="flex items-center gap-1.5">
            <span className="size-1.5" style={{ background: colors[i % colors.length] }} />
            {part.key} · {part.weight}%
          </p>
        ))}
      </div>
    </div>
  );
}

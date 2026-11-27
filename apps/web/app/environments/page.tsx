"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { DataState, OnOff, PageHeader } from "@/components/page";
import { flagsmith, type CompareRow } from "@/lib/api";
import { useData } from "@/lib/use-data";

export default function EnvironmentsPage() {
  const { data, error, loading, reload } = useData(flagsmith.environments);
  const environments = data ?? [];
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  // Default comparison: the current environment against the first other one.
  useEffect(() => {
    if (environments.length < 2 || left) return;
    const current = environments.find((e) => e.current) ?? environments[0];
    const other = environments.find((e) => e.apiKey !== current.apiKey)!;
    setLeft(current.apiKey);
    setRight(other.apiKey);
  }, [environments, left]);

  return (
    <div>
      <PageHeader eyebrow="Flagsmith" title="Environments." rest="Compare flag states side by side" onRefresh={reload} loading={loading}>
        <div className="flex flex-wrap gap-2">
          {environments.map((environment) => (
            <span key={environment.id} className="inline-flex h-6 items-center gap-1.5 rounded-[4px] border bg-card px-2 text-[11px]">
              <span className={cn("size-1.5", environment.current ? "bg-live" : "bg-line-2")} />
              {environment.name}
              {environment.current && <span className="text-muted-foreground">· used by FlagPilot</span>}
            </span>
          ))}
        </div>
      </PageHeader>

      <DataState loading={loading} error={error} empty={environments.length === 0} emptyText="No environments found.">
        {environments.length < 2 ? (
          <p className="hatch m-4 border p-4 text-[12px] text-muted-foreground sm:m-8">Add a second environment to compare.</p>
        ) : (
          <div className="px-4 py-5 sm:px-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
              <Select value={left} onChange={setLeft} options={environments} />
              <span className="text-muted-foreground">vs</span>
              <Select value={right} onChange={setRight} options={environments} />
            </div>
            {left && right && <CompareTable left={left} right={right} />}
          </div>
        )}
      </DataState>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { apiKey: string; name: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 rounded-[5px] border bg-card px-2 text-[12px]"
    >
      {options.map((option) => (
        <option key={option.apiKey} value={option.apiKey}>
          {option.name}
        </option>
      ))}
    </select>
  );
}

function CompareTable({ left, right }: { left: string; right: string }) {
  const load = useCallback(() => flagsmith.compare(left, right), [left, right]);
  const { data, error, loading } = useData<CompareRow[]>(load);
  const rows = data ?? [];
  const differences = rows.filter((row) => row.different).length;

  return (
    <DataState loading={loading} error={error} empty={rows.length === 0} emptyText="No flags to compare.">
      <p className="mb-2 text-[11px] text-muted-foreground">
        {differences} of {rows.length} flags differ
      </p>
      <div className="overflow-x-auto rounded-[5px] border bg-card">
        <table className="w-full min-w-[480px] text-[12px]">
          <tbody>
            {rows.map((row) => (
              <tr key={row.flag} className={cn("border-b last:border-b-0", row.different && "bg-warn/5")}>
                <td className="px-3 py-2">
                  {row.different && <span className="mr-2 inline-block size-1.5 bg-warn" />}
                  {row.flag}
                </td>
                <td className="px-3 py-2">
                  <OnOff on={row.left.enabled} /> <span className="ml-1 text-muted-foreground">{String(row.left.value ?? "")}</span>
                </td>
                <td className="px-3 py-2">
                  <OnOff on={row.right.enabled} /> <span className="ml-1 text-muted-foreground">{String(row.right.value ?? "")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataState>
  );
}

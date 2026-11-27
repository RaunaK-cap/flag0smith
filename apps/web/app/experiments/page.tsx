"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { percent } from "@/lib/format";
import { DataState, PageHeader } from "@/components/page";
import { flagsmith, type ExperimentResults, type ExperimentRow } from "@/lib/api";
import { useData } from "@/lib/use-data";

const statusStyle: Record<string, string> = {
  running: "border-live/30 text-live",
  paused: "border-warn/30 text-warn",
  created: "text-muted-foreground",
  completed: "text-ink-2",
};

export default function ExperimentsPage() {
  const { data, error, loading, reload } = useData(flagsmith.experiments);
  const experiments = data ?? [];

  return (
    <div>
      <PageHeader eyebrow="Flagsmith" title="Experiments." rest="A/B tests and their results" onRefresh={reload} loading={loading} />
      <DataState loading={loading} error={error} empty={experiments.length === 0} emptyText="No experiments yet. Ask FlagPilot to test something.">
        <div className="divide-y border-b">
          {experiments.map((experiment) => (
            <ExperimentItem key={experiment.id} experiment={experiment} />
          ))}
        </div>
      </DataState>
    </div>
  );
}

function ExperimentItem({ experiment }: { experiment: ExperimentRow }) {
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadResults() {
    setLoading(true);
    try {
      setResults(await flagsmith.results(experiment.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load results");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-4 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium">{experiment.name}</span>
        <span className={cn("rounded-[4px] border px-1.5 text-[10.5px]", statusStyle[experiment.status])}>
          {experiment.status}
        </span>
        <span className="text-[11px] text-muted-foreground">
          #{experiment.id} · flag {String(experiment.feature ?? "—")}
        </span>
        <button
          onClick={loadResults}
          className="ml-auto h-7 rounded-[5px] border bg-card px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {loading ? "Loading…" : results ? "Refresh results" : "Show results"}
        </button>
      </div>
      {experiment.hypothesis && <p className="mt-1.5 max-w-2xl text-[12px] text-ink-2">{experiment.hypothesis}</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">
        metrics: {experiment.metrics.join(", ") || "—"}
        {experiment.rolloutDecision && ` · rolled out: ${experiment.rolloutDecision}`}
      </p>

      {error && <p className="mt-3 text-[11px] text-destructive">{error}</p>}
      {results && <ResultsTable results={results} />}
    </div>
  );
}

function ResultsTable({ results }: { results: ExperimentResults }) {
  if (results.variants.length === 0) {
    return <p className="hatch mt-3 border p-3 text-[11px] text-muted-foreground">No results yet. Each variant needs about 50 visitors.</p>;
  }
  return (
    <div className="mt-3 max-w-xl rounded-[5px] border bg-card">
      {results.srmWarning && (
        <p className="border-b px-3 py-1.5 text-[11px] text-destructive">Sample ratio mismatch: don&apos;t trust these results.</p>
      )}
      {results.variants.map((variant) => {
        const rate = variant.exposures ? (variant.conversions / variant.exposures) * 100 : undefined;
        const chance = variant.chanceToBeatControl;
        return (
          <div key={variant.key} className="flex items-center gap-3 border-b px-3 py-2 text-[11.5px] last:border-b-0 tabular">
            <span className="w-28 truncate">{variant.key}</span>
            <span className="w-24 text-muted-foreground">
              {variant.conversions}/{variant.exposures}
            </span>
            <span className="w-14">{percent(rate)}</span>
            <span className="w-16 text-muted-foreground">{variant.delta === undefined ? "" : `lift ${percent(variant.delta)}`}</span>
            {chance !== undefined && (
              <span className="ml-auto flex items-center gap-2">
                <span className="h-1.5 w-20 bg-muted">
                  <span className={cn("block h-full", chance >= 0.95 ? "bg-live" : "bg-foreground/70")} style={{ width: `${chance * 100}%` }} />
                </span>
                {percent(chance * 100, 0)}
              </span>
            )}
          </div>
        );
      })}
      <p className="px-3 py-1.5 text-[10.5px] text-muted-foreground">Bar = chance to beat control · as of {results.asOf ?? "—"}</p>
    </div>
  );
}

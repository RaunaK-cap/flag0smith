"use client";

import { Activity, GitPullRequest } from "lucide-react";
import { Panel } from "@/components/frame";
import { cn } from "@/lib/utils";
import { clock, percent } from "@/lib/format";
import type { RunView } from "@/lib/run-view";
import { TrafficChart, orderVariants, variantColor } from "./traffic-chart";

export function LivePanel({ view }: { view: RunView }) {
  const variants = orderVariants(Object.keys(view.traffic));

  return (
    <div className="space-y-5">
      <TrafficCard view={view} variants={variants} />
      <ResultsCard view={view} />
      <PullRequestsCard view={view} />
      <ChangesCard view={view} />
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel title={title}>
      {description && <p className="mb-3 text-[11px] text-muted-foreground">{description}</p>}
      {children}
    </Panel>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="hatch border p-3 text-[11px] text-muted-foreground">{children}</p>;
}

// Live counts from the traffic simulator: instant, smooth, ours.
function TrafficCard({ view, variants }: { view: RunView; variants: string[] }) {
  return (
    <SectionCard title="Live traffic" description="Conversion rate per variant, updated as visitors arrive">
      {variants.length === 0 ? (
        <Empty>No traffic yet. It starts after the experiment is running.</Empty>
      ) : (
        <div className="space-y-3">
          <TrafficChart series={view.trafficSeries} variants={variants} />
          <table className="w-full text-[11.5px] tabular">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="font-normal">Variant</th>
                <th className="text-right font-normal">Visitors</th>
                <th className="text-right font-normal">Converted</th>
                <th className="text-right font-normal">Rate</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant, index) => {
                const counts = view.traffic[variant];
                const rate = counts.exposures ? (counts.conversions / counts.exposures) * 100 : 0;
                return (
                  <tr key={variant} className="border-t">
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2" style={{ background: variantColor(variant, index - 1) }} />
                        {variant}
                      </span>
                    </td>
                    <td className="text-right">{counts.exposures}</td>
                    <td className="text-right">{counts.conversions}</td>
                    <td className="text-right">{percent(rate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// Flagsmith's official Bayesian results (refreshed at most every 5 minutes).
function ResultsCard({ view }: { view: RunView }) {
  const results = view.results;
  const treatments = results?.variants.filter((v) => v.key !== "control") ?? [];

  return (
    <SectionCard title="Flagsmith results" description="Bayesian analysis from Flagsmith Experimentation">
      {!results ? (
        <Empty>Waiting for the first results. Each variant needs about 50 visitors.</Empty>
      ) : treatments.every((v) => v.chanceToBeatControl === undefined) ? (
        <Empty>Not enough data yet ({results.status}). Keep the experiment running.</Empty>
      ) : (
        <div className="space-y-4">
          {treatments.map((variant) => {
            const chance = (variant.chanceToBeatControl ?? 0) * 100;
            const winning = chance >= 95;
            const losing = chance <= 5;
            return (
              <div key={variant.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{variant.key}</span>
                  <span
                    className={cn(
                      "text-[11px] tabular",
                      winning && "text-live",
                      losing && "text-destructive",
                    )}
                  >
                    {winning ? "Winning" : losing ? "Losing" : "Inconclusive"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-muted">
                    <div
                      className={cn("h-full transition-[width] duration-700", winning ? "bg-live" : "bg-foreground/70")}
                      style={{ width: `${chance}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-[11px] tabular">{percent(chance, 0)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground tabular">
                  Chance to beat control · lift {percent(variant.delta)}
                  {variant.credibleInterval &&
                    ` · 95% CI ${percent(variant.credibleInterval[0])} to ${percent(variant.credibleInterval[1])}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function PullRequestsCard({ view }: { view: RunView }) {
  if (view.pullRequests.length === 0) return null;
  return (
    <SectionCard title="Pull requests">
      <ul className="space-y-1.5">
        {view.pullRequests.map((pr) => (
          <li key={pr.url}>
            <a
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-1 py-1 hover:bg-muted"
            >
              <GitPullRequest className="size-3.5 text-live" />
              <span className="truncate text-[13px]">{pr.title}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">#{pr.number}</span>
            </a>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ChangesCard({ view }: { view: RunView }) {
  return (
    <SectionCard title="Flagsmith changes" description="Everything the agent changed in this run">
      {view.changes.length === 0 ? (
        <Empty>No changes yet.</Empty>
      ) : (
        <ol className="space-y-2">
          {[...view.changes].reverse().map((change, index) => (
            <li key={index} className="flex gap-2 text-[11px]">
              <Activity className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <span className="flex-1">{change.summary}</span>
              <span className="text-muted-foreground tabular">{clock(change.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

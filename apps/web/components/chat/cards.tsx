// The cards that appear in the chat thread besides agent turns.

import { ExternalLink, GitPullRequest, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { percent } from "@/lib/format";
import type { PullRequest, Results } from "@/lib/run-view";

function CardShell({
  label,
  icon,
  aside,
  children,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ml-9 max-w-xl rounded-[5px] border bg-card", className)}>
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        {icon}
        <span className="text-[10.5px] tracking-[0.12em] text-muted-foreground uppercase">{label}</span>
        {aside && <span className="ml-auto text-[11px] text-muted-foreground">{aside}</span>}
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  );
}

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-[8px] border border-line-2 bg-card px-3.5 py-2 text-[13px] whitespace-pre-wrap shadow-[0_8px_24px_-18px_rgb(0_0_0/0.4)]">
        {text}
      </p>
    </div>
  );
}

export function PullRequestCard({ pr }: { pr: PullRequest }) {
  return (
    <CardShell label="GitHub" icon={<GitPullRequest className="size-3 text-live" />} aside={`#${pr.number}`}>
      <p className="text-[12.5px]">{pr.title}</p>
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-live">
          <span className="size-1.5 bg-live" /> Open · waiting for a human to merge
        </span>
        <a href={pr.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 hover:underline">
          View on GitHub <ExternalLink className="size-3" />
        </a>
      </div>
    </CardShell>
  );
}

export function ResultsCard({ results }: { results: Results }) {
  const control = results.variants.find((v) => v.key === "control");
  const treatments = results.variants.filter((v) => v.key !== "control");

  return (
    <CardShell
      label="Experiment results"
      icon={<span className="size-1.5 bg-chart-2" />}
      aside={`#${results.experimentId} · ${results.status}`}
    >
      <div className="space-y-3">
        {control && <VariantRow name="control" exposures={control.exposures} conversions={control.conversions} />}
        {treatments.map((variant) => {
          const chance = variant.chanceToBeatControl;
          const verdict =
            chance === undefined ? "not enough data" : chance >= 0.95 ? "winning" : chance <= 0.05 ? "losing" : "inconclusive";
          return (
            <div key={variant.key} className="space-y-1.5">
              <VariantRow name={variant.key} exposures={variant.exposures} conversions={variant.conversions} />
              {chance !== undefined && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-muted">
                      <div
                        className={cn("h-full", chance >= 0.95 ? "bg-live" : "bg-foreground/70")}
                        style={{ width: `${chance * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[11px] tabular">{percent(chance * 100, 0)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground tabular">
                    chance to beat control · lift {percent(variant.delta)}
                    {variant.credibleInterval &&
                      ` · 95% CI ${percent(variant.credibleInterval[0])} to ${percent(variant.credibleInterval[1])}`}
                    {" · "}
                    <span className={cn(verdict === "winning" && "text-live", verdict === "losing" && "text-destructive")}>
                      {verdict}
                    </span>
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

function VariantRow({ name, exposures, conversions }: { name: string; exposures: number; conversions?: number }) {
  const rate = exposures && conversions !== undefined ? (conversions / exposures) * 100 : undefined;
  return (
    <div className="flex items-baseline justify-between text-[12px] tabular">
      <span>{name}</span>
      <span className="text-muted-foreground">
        {conversions ?? "—"}/{exposures} · <span className="text-foreground">{percent(rate)}</span>
      </span>
    </div>
  );
}

export function SummaryCard({ text }: { text: string }) {
  return (
    <CardShell label="Summary" icon={<Sparkles className="size-3 text-live" />} className="border-line-2">
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{text}</p>
    </CardShell>
  );
}

export function ErrorCard({ text }: { text: string }) {
  return (
    <CardShell
      label="Run failed"
      icon={<TriangleAlert className="size-3 text-destructive" />}
      className="border-destructive/40"
    >
      <p className="text-[12px] text-muted-foreground">{text}</p>
    </CardShell>
  );
}

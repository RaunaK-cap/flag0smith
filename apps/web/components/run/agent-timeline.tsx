"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/format";
import type { AgentStep } from "@/lib/run-view";
import { agentMeta } from "./agent-meta";
import { ToolCallRow } from "./tool-call-row";

export function AgentTimeline({ steps, running }: { steps: AgentStep[]; running: boolean }) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Starting the agent…
      </div>
    );
  }

  return (
    <ol className="relative space-y-4">
      {steps.map((step) => (
        <AgentStepItem key={step.id} step={step} active={running && !step.finished} />
      ))}
    </ol>
  );
}

function AgentStepItem({ step, active }: { step: AgentStep; active: boolean }) {
  const meta = agentMeta[step.agent];
  const Icon = meta.icon;
  const isSubAgent = Boolean(step.parent);

  return (
    <li className={cn("relative", isSubAgent && "ml-3 border-l border-dashed border-line-2 pl-4 sm:ml-4 sm:pl-5")}>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-[4px] border bg-card",
            active && "border-live/50 text-live",
          )}
        >
          <Icon className="size-3.5" />
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{meta.label}</span>
            <span className="text-[11px] text-muted-foreground">{meta.role}</span>
            <span className="ml-auto text-[11px] text-muted-foreground tabular">{clock(step.at)}</span>
          </div>

          {step.task && isSubAgent && (
            <p className="border-l-2 border-line-2 bg-muted/40 px-2.5 py-1.5 text-[11.5px] text-muted-foreground">{step.task}</p>
          )}

          {step.text && <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{step.text}</p>}

          {step.tools.length > 0 && (
            <div className="space-y-1.5">
              {step.tools.map((call) => (
                <ToolCallRow key={call.callId || call.at} call={call} />
              ))}
            </div>
          )}

          {active && !step.text && step.tools.length === 0 && (
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Thinking…
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

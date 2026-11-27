import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/format";
import type { AgentTurn } from "@/lib/run-view";
import { agentMeta } from "./agent-meta";
import { describeChange, FlagsmithCard } from "./flagsmith-card";
import { ToolCallRow } from "./tool-call-row";

// One agent speaking: its name, its task, the text it streams, and the tools it used.
export function AgentTurnItem({ turn, live }: { turn: AgentTurn; live: boolean }) {
  const meta = agentMeta[turn.agent];
  const Icon = meta.icon;
  const isSubAgent = Boolean(turn.parent);
  const thinking = live && !turn.finished && !turn.text && turn.tools.length === 0;

  return (
    <div className={cn("flex gap-3", isSubAgent && "ml-4 border-l border-dashed border-line-2 pl-4")}>
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-[5px] border bg-card",
          live && !turn.finished && "border-live/60 text-live",
        )}
      >
        <Icon className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        {!turn.continued && (
          <div className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-medium">{meta.label}</span>
            <span className="text-[11px] text-muted-foreground">{meta.role}</span>
            <span className="ml-auto text-[10.5px] text-muted-foreground tabular">{clock(turn.at)}</span>
          </div>
        )}

        {turn.task && (
          <p className="border-l-2 border-line-2 bg-muted/40 px-2.5 py-1.5 text-[11.5px] text-muted-foreground">
            {turn.task}
          </p>
        )}

        {turn.text && <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{turn.text}</p>}

        {turn.tools.length > 0 && (
          <div className="space-y-1.5">
            {turn.tools.map((call) => {
              const change = call.ok ? describeChange(call) : null;
              return change ? (
                <FlagsmithCard key={call.callId || call.at} change={change} />
              ) : (
                <ToolCallRow key={call.callId || call.at} call={call} />
              );
            })}
          </div>
        )}

        {thinking && (
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Thinking…
          </p>
        )}
      </div>
    </div>
  );
}

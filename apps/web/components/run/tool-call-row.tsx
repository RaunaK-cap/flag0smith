"use client";

import { Check, ChevronRight, Loader2, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { duration } from "@/lib/format";
import type { ToolCall } from "@/lib/run-view";
import { JsonBlock } from "./json-block";

export function ToolCallRow({ call }: { call: ToolCall }) {
  const running = call.ok === undefined;

  return (
    <Collapsible className="rounded-md border bg-background">
      <CollapsibleTrigger className="group/tool flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
        <ChevronRight className="size-3 text-muted-foreground transition-transform group-data-[panel-open]/tool:rotate-90" />
        <span className="font-mono text-xs">{call.tool}</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground tabular">
          {call.doneAt && duration(call.at, call.doneAt)}
          {running && <Loader2 className="size-3.5 animate-spin" />}
          {call.ok === true && <Check className="size-3.5 text-live" />}
          {call.ok === false && <X className="size-3.5 text-destructive" />}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 border-t px-2.5 py-2">
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground uppercase">Input</p>
            <JsonBlock value={call.input} />
          </div>
          {!running && (
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground uppercase">Output</p>
              <JsonBlock value={call.output} />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

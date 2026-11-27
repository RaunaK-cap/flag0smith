"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { answerApproval } from "@/lib/api";
import { humanize } from "@/lib/format";
import type { Approval } from "@/lib/run-view";
import { agentMeta } from "./agent-meta";
import { JsonBlock } from "./json-block";

// Shown whenever the agent wants to change something. Nothing happens until a human answers.
export function ApprovalCard({ runId, approval }: { runId: string; approval: Approval }) {
  const [sending, setSending] = useState(false);

  async function answer(approved: boolean) {
    setSending(true);
    try {
      await answerApproval(runId, approval.approvalId, approved);
      toast.success(approved ? "Approved" : "Rejected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your answer");
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-warn/40 bg-card p-4 shadow-lg shadow-black/5">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert className="size-4 text-warn" />
        <p className="font-medium">Approval needed</p>
        <span className="ml-auto text-xs text-muted-foreground">{agentMeta[approval.agent].label}</span>
      </div>
      <p className="mb-2 text-[13px]">
        The agent wants to run <span className="font-mono text-xs">{humanize(approval.tool).toLowerCase()}</span>{" "}
        with:
      </p>
      <JsonBlock value={approval.input} />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={sending} onClick={() => answer(false)}>
          Reject
        </Button>
        <Button size="sm" disabled={sending} onClick={() => answer(true)}>
          Approve
        </Button>
      </div>
    </div>
  );
}

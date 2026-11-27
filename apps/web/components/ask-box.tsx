"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { startRun } from "@/lib/api";

const suggestions = [
  "Will showing yearly pricing first get more checkout clicks?",
  "Test a shorter headline on the landing page against the current one.",
  "Which flags look stale and can be cleaned up?",
  "Roll out new_signup_form to 10% of users, then show me what changed.",
];

export function AskBox() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(text: string) {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const { runId } = await startRun(value);
      router.push(`/runs/${runId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the run");
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        className="relative rounded-[8px] border border-line-2 bg-card shadow-[0_18px_40px_-28px_rgb(0_0_0/0.35)] focus-within:border-foreground/40"
        onSubmit={(event) => {
          event.preventDefault();
          submit(question);
        }}
      >
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(question);
            }
          }}
          placeholder="Ask a product question, e.g. will a shorter signup form get more signups?"
          className="min-h-24 resize-none border-0 bg-transparent px-4 pt-3.5 pb-12 text-[13px] shadow-none focus-visible:ring-0 md:text-[13px] dark:bg-transparent"
        />
        <div className="absolute right-2 bottom-2 left-4 flex items-center justify-between">
          <span className="text-[10.5px] text-muted-foreground">↵ send · ⇧↵ new line</span>
          <Button type="submit" size="icon-sm" disabled={!question.trim() || sending} aria-label="Start run">
            <ArrowUp />
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((text) => (
          <button
            key={text}
            type="button"
            disabled={sending}
            onClick={() => submit(text)}
            className="rounded-[4px] border bg-card px-2.5 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:border-line-2 hover:text-foreground"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

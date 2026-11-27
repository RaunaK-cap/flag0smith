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
        className="relative rounded-xl border bg-card shadow-xs focus-within:ring-2 focus-within:ring-ring/30"
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
          className="min-h-24 resize-none border-0 bg-transparent px-4 pt-3 pb-12 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="absolute right-2 bottom-2 left-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</span>
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
            className="rounded-full border px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

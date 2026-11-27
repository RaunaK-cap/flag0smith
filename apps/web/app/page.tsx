"use client";

import { useRouter } from "next/navigation";
import { DotMatrix } from "@/components/dot-matrix";
import { ChatInput } from "@/components/chat/chat-input";
import { Eyebrow, Title } from "@/components/frame";
import { startRun } from "@/lib/api";
import { toast } from "sonner";

const suggestions = [
  "Will showing yearly pricing first get more checkout clicks?",
  "Test a shorter headline on the landing page.",
  "Which flags look stale and can be cleaned up?",
  "Roll out new_signup_form to 10% of users.",
];

const loop = ["Plan", "Flag", "Pull request", "Experiment", "Results", "Rollout"];

export default function NewChatPage() {
  const router = useRouter();

  async function start(question: string) {
    const { runId } = await startRun(question);
    router.push(`/runs/${runId}`);
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12">
      <DotMatrix
        cols={70}
        rows={18}
        seed={3}
        animated
        className="pointer-events-none absolute inset-x-0 bottom-0 w-full text-muted-foreground/25"
      />

      <div className="relative w-full max-w-2xl">
        <Eyebrow className="mb-4">New chat</Eyebrow>
        <Title lead="What do you want to test?" rest="FlagPilot runs it end to end." />
        <ol className="mt-4 mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {loop.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              {index > 0 && <span>→</span>}
              {step}
            </li>
          ))}
          <li className="ml-1 text-warn">· you approve every change</li>
        </ol>

        <ChatInput placeholder="Ask a product question, e.g. will a shorter signup form get more signups?" onSend={start} />

        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => start(text).catch((error) => toast.error(error.message))}
              className="rounded-[4px] border bg-card px-2.5 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:border-line-2 hover:text-foreground"
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

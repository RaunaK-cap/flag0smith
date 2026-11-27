"use client";

import { useRouter } from "next/navigation";
import { DotField } from "@/components/dot-field";
import { ChatInput } from "@/components/chat/chat-input";
import type { PlaceholderLine } from "@/components/chat/rotating-placeholder";
import { Title } from "@/components/frame";
import { startRun } from "@/lib/api";
import { toast } from "sonner";

const suggestions = [
  "Will showing yearly pricing first get more checkout clicks?",
  "Test a shorter headline on the landing page.",
  "Which flags look stale and can be cleaned up?",
  "Roll out new_signup_form to 10% of users.",
];

// The input's placeholder cycles through these.
const placeholders: PlaceholderLine[] = [
  [{ text: "Ask a product question, e.g. will a shorter signup form get more signups?" }],
  [
    { text: "Plan → Flag → Pull request → Experiment → Results → Rollout" },
    { text: "· you approve every change", className: "text-warn" },
  ],
];

export default function NewChatPage() {
  const router = useRouter();

  async function start(question: string) {
    const { runId } = await startRun(question);
    router.push(`/runs/${runId}`);
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Full-page dots, faded out behind the prompt so the text stays readable. */}
      <DotField className="pointer-events-none absolute inset-0 h-full w-full text-muted-foreground/25 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,transparent_30%,black_100%)]" />

      <div className="relative w-full max-w-2xl">
        <Title lead="What do you want to test?" rest="FlagPilot runs it end to end." className="mb-10 sm:mb-8" />

        <ChatInput placeholder={placeholders} onSend={start} />

        <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
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

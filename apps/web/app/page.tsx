import Link from "next/link";
import { AskBox } from "@/components/ask-box";
import { RunsList } from "@/components/runs-list";

const loop = ["Plan", "Flag", "Pull request", "Experiment", "Results", "Rollout"];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-20">
      <div className="mb-8 space-y-2">
        <h1 className="text-xl font-medium tracking-tight sm:text-2xl">What do you want to test?</h1>
        <p className="text-muted-foreground">
          FlagPilot plans the experiment, sets it up in Flagsmith, opens the pull request, reads the
          results and rolls out the winner. You approve every change.
        </p>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-muted-foreground">
          {loop.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              {index > 0 && <span className="text-border">→</span>}
              {step}
            </li>
          ))}
        </ol>
      </div>

      <AskBox />

      <section className="mt-12">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Recent runs</h2>
          <Link href="/runs" className="text-xs text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>
        <RunsList limit={5} />
      </section>
    </div>
  );
}

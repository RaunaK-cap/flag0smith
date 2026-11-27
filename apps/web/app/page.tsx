import Link from "next/link";
import { AskBox } from "@/components/ask-box";
import { DotMatrix } from "@/components/dot-matrix";
import { Eyebrow, Section, Title } from "@/components/frame";
import { RunsList } from "@/components/runs-list";

const loop = [
  { name: "Plan", text: "Hypothesis, variants and one metric.", approve: false },
  { name: "Flag", text: "Multivariate flag, metric, experiment.", approve: true },
  { name: "Pull request", text: "Variant code behind the flag.", approve: true },
  { name: "Experiment", text: "Start it and send traffic.", approve: true },
  { name: "Results", text: "Bayesian read-out, in plain words.", approve: false },
  { name: "Rollout", text: "Ship the winner, clean up the rest.", approve: true },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <Section className="px-4 pt-14 pb-10 sm:px-10 sm:pt-20">
        <Eyebrow className="mb-5">Flagsmith experiment copilot</Eyebrow>
        <Title lead="What do you want to test?" rest="FlagPilot runs it end to end." className="max-w-2xl" />
        <p className="mt-4 max-w-xl text-muted-foreground">
          It plans the A/B test, sets it up in Flagsmith, opens the pull request, reads the results and rolls
          out the winner. Nothing changes until you approve it.
        </p>
        <div className="mt-8 max-w-3xl">
          <AskBox />
        </div>
      </Section>

      <Section>
        {/* gap-px over a border-coloured background draws clean 1px lines between cells */}
        <ol className="grid grid-cols-2 gap-px bg-border md:grid-cols-3 lg:grid-cols-6">
          {loop.map((step, index) => (
            <li
              key={step.name}
              className="bg-background p-4"
            >
              <p className="text-[11px] text-muted-foreground tabular">0{index + 1}</p>
              <p className="mt-3 font-medium">{step.name}</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">{step.text}</p>
              {step.approve && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[10.5px] text-warn">
                  <span className="size-1.5 bg-warn" /> you approve
                </p>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section className="grid grid-cols-1 md:grid-cols-[1fr_300px]">
        <div className="border-b p-4 sm:p-6 md:border-r md:border-b-0">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>Recent runs</Eyebrow>
            <Link href="/runs" className="text-[11px] text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </div>
          <RunsList limit={6} />
        </div>
        <div className="relative hidden min-h-56 overflow-hidden md:block">
          <DotMatrix cols={40} rows={34} seed={3} animated className="absolute inset-0 h-full w-full text-muted-foreground/50" />
          <div className="absolute inset-x-0 bottom-0 border-t bg-card/90 p-4 backdrop-blur-sm">
            <p className="text-[11px] text-muted-foreground">Every run is saved.</p>
            <p className="text-[12px]">Replay exactly what the agent did, step by step.</p>
          </div>
        </div>
      </Section>

      <div className="flex-1" />
    </div>
  );
}

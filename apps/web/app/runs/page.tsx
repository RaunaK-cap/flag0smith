import { Eyebrow, Section, Title } from "@/components/frame";
import { RunsList } from "@/components/runs-list";

export default function RunsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Section className="px-4 pt-12 pb-8 sm:px-10">
        <Eyebrow className="mb-4">History</Eyebrow>
        <Title lead="Runs." rest="Replay exactly what the agent did." />
      </Section>
      <Section className="p-4 sm:p-6">
        <RunsList />
      </Section>
      <div className="flex-1" />
    </div>
  );
}

import { RunsList } from "@/components/runs-list";

export default function RunsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-lg font-medium">Runs</h1>
      <p className="mb-6 text-muted-foreground">Every run is saved, so you can replay exactly what the agent did.</p>
      <RunsList />
    </div>
  );
}

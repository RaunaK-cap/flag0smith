import { cn } from "@/lib/utils";

const styles: Record<string, { label: string; dot: string }> = {
  running: { label: "Running", dot: "bg-live animate-pulse" },
  waiting_approval: { label: "Needs approval", dot: "bg-warn animate-pulse" },
  done: { label: "Done", dot: "bg-live" },
  failed: { label: "Failed", dot: "bg-destructive" },
  cancelled: { label: "Cancelled", dot: "bg-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = styles[status] ?? { label: status, dot: "bg-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

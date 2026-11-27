// The same visual language as the CloudNote landing page:
// hairline frames with "+" corner marks, small uppercase eyebrows, and two-tone titles.

import { cn } from "@/lib/utils";

// Draws "+" marks on the top corners of the nearest `relative` parent.
export function CornerMarks({ bottom = false }: { bottom?: boolean }) {
  return (
    <>
      <Plus className="-top-[5px] -left-[5px]" />
      <Plus className="-top-[5px] -right-[5px]" />
      {bottom && <Plus className="-bottom-[5px] -left-[5px]" />}
      {bottom && <Plus className="-right-[5px] -bottom-[5px]" />}
    </>
  );
}

function Plus({ className }: { className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 9 9"
      className={cn("pointer-events-none absolute z-10 size-[9px] text-muted-foreground", className)}
    >
      <path d="M4.5 0v9M0 4.5h9" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2 text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase", className)}>
      <span className="size-1.5 bg-foreground" />
      {children}
    </p>
  );
}

// <Title lead="What do you want to test?" rest="FlagPilot runs it." />
export function Title({ lead, rest, className }: { lead: string; rest?: string; className?: string }) {
  return (
    <h1 className={cn("text-2xl font-medium tracking-tight text-balance sm:text-3xl", className)}>
      {lead} {rest && <span className="text-muted-foreground">{rest}</span>}
    </h1>
  );
}

// A bordered panel with an eyebrow header row, used for every block of the run page.
export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative border bg-card", className)}>
      <CornerMarks />
      <header className="flex h-9 items-center justify-between border-b px-3">
        <Eyebrow>{title}</Eyebrow>
        {aside && <span className="text-[11px] text-muted-foreground">{aside}</span>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

// A full-width band with a centred, hairline-framed column (like the landing page sections).
export function Section({
  children,
  className,
  width = "max-w-5xl",
}: {
  children: React.ReactNode;
  className?: string;
  width?: string;
}) {
  return (
    <section className="border-b">
      <div className={cn("relative mx-auto border-x", width, className)}>
        <CornerMarks />
        {children}
      </div>
    </section>
  );
}

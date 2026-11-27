export function JsonBlock({ value }: { value: unknown }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-muted/60 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground">
      {text}
    </pre>
  );
}

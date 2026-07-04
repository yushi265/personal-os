export function ProgressBar({ value }: { value?: number }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

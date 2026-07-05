// statusピル(design-refs/geist-final.dc.html §一覧画面)。h22 radius9999 border padding 0 10px mono。
// backlog等はborder+muted文字。active/doingはborder+fg文字+6pxのaccentドット付き。
const ACTIVE_STATUSES = new Set(["active", "doing"]);

export function StatusBadge({ status }: { status: string }) {
  const isActive = ACTIVE_STATUSES.has(status);
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2.5 font-mono text-[11px] ${
        isActive ? "text-fg" : "text-muted-foreground"
      }`}
    >
      {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
      {status}
    </span>
  );
}

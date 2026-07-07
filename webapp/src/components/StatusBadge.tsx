// statusピル(design-refs/geist-final.dc.html §一覧画面)。h22 radius9999 border padding 0 10px mono。
// 全statusに色分けドットを付ける(Jira系の慣習: 未着手=灰 / 進行中=青 / 待ち=琥珀 / レビュー=紫 / 完了=緑)。
// 文字の強調は従来通りactive/doingのみfg、その他はmuted(色はドットが担い、文字は形を保つ)。
const STATUS_DOT: Record<string, string> = {
  backlog: "bg-zinc-400",
  ready: "bg-cyan-500",
  active: "bg-blue-500",
  doing: "bg-blue-500",
  waiting: "bg-amber-500",
  review: "bg-violet-500",
  done: "bg-emerald-500",
  archived: "bg-zinc-300 dark:bg-zinc-600",
};
const ACTIVE_STATUSES = new Set(["active", "doing"]);

export function StatusBadge({ status }: { status: string }) {
  const isActive = ACTIVE_STATUSES.has(status);
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2.5 font-mono text-[11px] ${
        isActive ? "text-fg" : "text-muted-foreground"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status] ?? "bg-zinc-400"}`}
        aria-hidden="true"
      />
      {status}
    </span>
  );
}

import type { Priority } from "@domain/entity";

// priorityピル(design-refs/geist-final.dc.html §一覧画面を色分けに拡張)。
// high=赤 / medium=琥珀 / low=空色の淡色チップ(Jira系の慣習)。未設定のみ"—"のfaint mono表記。
// 文字色はWCAG AA(4.5:1)を淡色チップ背景に対して満たす段を選ぶ(light=700〜800番台 / dark=400番台)
const PRIORITY_STYLES: Record<Priority, string> = {
  high: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400",
  low: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

export function PriorityBadge({ priority }: { priority?: Priority }) {
  if (!priority) {
    return <span className="font-mono text-[11px] text-faint">—</span>;
  }
  return (
    <span
      className={`inline-flex h-[22px] items-center whitespace-nowrap rounded-full border px-2.5 font-mono text-[11px] ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
    </span>
  );
}

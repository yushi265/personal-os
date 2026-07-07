import type { Priority } from "@domain/entity";

// priorityピル(design-refs/geist-final.dc.html §一覧画面)。
// high=bg:fg文字:bg(反転塗り) / medium=border+fg文字 / low=faint mono文字(未設定"—"と区別する) / なし="—"。
export function PriorityBadge({ priority }: { priority?: Priority }) {
  if (!priority || priority === "low") {
    return <span className="font-mono text-[11px] text-faint">{priority || "—"}</span>;
  }
  if (priority === "high") {
    return (
      <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-fg px-2.5 font-mono text-[11px] text-bg">
        {priority}
      </span>
    );
  }
  return (
    <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full border border-border px-2.5 font-mono text-[11px] text-fg">
      {priority}
    </span>
  );
}

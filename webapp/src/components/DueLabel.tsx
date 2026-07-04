import { describeDue } from "@domain/date";

const TONE_CLASS: Record<string, string> = {
  overdue: "text-destructive font-medium",
  today: "text-amber-500 font-medium",
  soon: "text-amber-500",
  normal: "text-muted-foreground",
};

// 期限相対表示(design-browser-ui.md §9 P3行: describeDueを@domainからimport)
export function DueLabel({ due, today }: { due?: string; today: string }) {
  if (!due) return <span className="text-muted-foreground">—</span>;
  const { label, tone } = describeDue(due, today);
  return <span className={TONE_CLASS[tone]}>{label}</span>;
}

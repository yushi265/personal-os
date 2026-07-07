import { describeDue } from "@domain/date";

// today/soonの琥珀はWCAG AA対応: amber-500は地に対して1.9:1と不足のためlight=amber-800/dark=amber-400
const TONE_CLASS: Record<string, string> = {
  overdue: "text-destructive font-medium",
  today: "text-amber-800 dark:text-amber-400 font-medium",
  soon: "text-amber-800 dark:text-amber-400",
  normal: "text-muted-foreground",
};

// 期限相対表示(design-browser-ui.md §9 P3行: describeDueを@domainからimport)
export function DueLabel({ due, today }: { due?: string; today: string }) {
  if (!due) return <span className="text-muted-foreground">—</span>;
  const { label, tone } = describeDue(due, today);
  return <span className={TONE_CLASS[tone]}>{label}</span>;
}

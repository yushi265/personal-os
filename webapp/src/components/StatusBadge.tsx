import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  active: "success",
  doing: "success",
  backlog: "secondary",
  ready: "secondary",
  waiting: "warning",
  review: "warning",
  done: "outline",
  archived: "outline",
  paused: "secondary",
};

// statusバッジの色分け(design-browser-ui.md §6.4)。status値は固定(CLAUDE.md エンティティモデル参照)なので固定マップでよい。
export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status}</Badge>;
}

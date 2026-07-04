import type { Priority } from "@domain/entity";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const PRIORITY_VARIANT: Record<Priority, BadgeProps["variant"]> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

export function PriorityBadge({ priority }: { priority?: Priority }) {
  if (!priority) return <span className="text-muted-foreground">—</span>;
  return <Badge variant={PRIORITY_VARIANT[priority]}>{priority}</Badge>;
}

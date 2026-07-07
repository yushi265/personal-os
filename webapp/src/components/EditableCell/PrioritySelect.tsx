import { PRIORITIES, type Priority } from "@domain/entity";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { PriorityBadge } from "@/components/PriorityBadge";
import { t } from "@i18n/ja";

const NONE = "__none__";

interface PrioritySelectProps {
  priority?: Priority;
  onCommit: (next: Priority | undefined) => void;
}

// 表示モードはP3のPriorityBadgeを流用。未設定を選べるようNONEセンチネルを挟む(Radix SelectはItem value=""不可のため)。
export function PrioritySelect({ priority, onCommit }: PrioritySelectProps) {
  return (
    <Select value={priority ?? NONE} onValueChange={(v) => onCommit(v === NONE ? undefined : (v as Priority))}>
      <SelectTrigger
        aria-label={t("preview.field.priority")}
        className="h-auto w-auto gap-1 border-none bg-transparent px-0 py-0 shadow-none hover:bg-accent"
        onClick={(e) => e.stopPropagation()}
      >
        <PriorityBadge priority={priority} />
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        <SelectItem value={NONE}>{t("manage.field.unset")}</SelectItem>
        {PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

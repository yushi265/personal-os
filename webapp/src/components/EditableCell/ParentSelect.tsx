import { useEntities } from "@/hooks/useEntities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@i18n/ja";

const NONE = "__none__";

interface ParentSelectProps {
  type: "project";
  value?: string;
  onCommit: (next: string | undefined) => void;
}

// project候補は/api/entities(useEntities)から取得する(design §5.1: 対象特定はpath)。
export function ParentSelect({ type, value, onCommit }: ParentSelectProps) {
  const { data: candidates } = useEntities(type);
  const current = candidates?.find((c) => c.path === value);

  return (
    <Select value={value ?? NONE} onValueChange={(v) => onCommit(v === NONE ? undefined : v)}>
      <SelectTrigger className="h-8 w-48">
        <SelectValue placeholder={t("manage.field.unset")}>{current?.title ?? t("manage.field.unset")}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("manage.field.unset")}</SelectItem>
        {(candidates ?? []).map((c) => (
          <SelectItem key={c.path} value={c.path}>
            {c.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import { PencilLine } from "lucide-react";
import { useEntities } from "@/hooks/useEntities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@i18n/ja";

const NONE = "__none__";

interface ParentSelectProps {
  type: "project";
  value?: string;
  onCommit: (next: string | undefined) => void;
  /** "field"(既定)=値をテキスト表示するトリガー。"icon"=鉛筆アイコンのみの小さな変更トリガー
   *  (design-refs/geist-final.dc.html §チケット詳細: Projectはアクセントリンクをクリックで親へ遷移するため、
   *  再割り当てUIはリンクの隣に控えめなアイコンとして分離する)。 */
  variant?: "field" | "icon";
}

// project候補は/api/entities(useEntities)から取得する(design §5.1: 対象特定はpath)。
export function ParentSelect({ type, value, onCommit, variant = "field" }: ParentSelectProps) {
  const { data: candidates } = useEntities(type);
  const current = candidates?.find((c) => c.path === value);

  return (
    <Select value={value ?? NONE} onValueChange={(v) => onCommit(v === NONE ? undefined : v)}>
      <SelectTrigger
        className={
          variant === "icon"
            ? "h-auto w-auto shrink-0 gap-0 border-none bg-transparent p-1 text-faint shadow-none hover:bg-accent hover:text-fg [&>svg:last-child]:hidden"
            : "h-8 w-48"
        }
        aria-label={variant === "icon" ? t("manage.rowMenu.changeProject") : undefined}
      >
        {variant === "icon" ? (
          <PencilLine className="h-3 w-3" />
        ) : (
          <SelectValue placeholder={t("manage.field.unset")}>{current?.title ?? t("manage.field.unset")}</SelectValue>
        )}
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

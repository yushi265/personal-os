import { ChipListEditor } from "@/components/ChipListEditor";
import { t } from "@i18n/ja";

// tags/labels共通(design §9 P4行)。TagChips.svelte互換: カンマ区切り複数追加+重複除去。
export function TagChipsEdit({ values, onCommit }: { values: string[]; onCommit: (next: string[]) => void }) {
  return (
    <ChipListEditor
      values={values}
      onCommit={onCommit}
      placeholder={t("preview.tagChips.placeholder")}
      removeLabel={t("preview.tagChips.remove")}
      commaSeparated
    />
  );
}

import { ChipListEditor } from "@/components/ChipListEditor";
import { t } from "@i18n/ja";

// BlockerList.svelte互換: 自由テキストを1件ずつ追加(design §9 P4行)。
export function BlockerListEdit({ values, onCommit }: { values: string[]; onCommit: (next: string[]) => void }) {
  return (
    <ChipListEditor
      values={values}
      onCommit={onCommit}
      placeholder={t("preview.blockerList.placeholder")}
      removeLabel={t("preview.blockerList.remove")}
    />
  );
}

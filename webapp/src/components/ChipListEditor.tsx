import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ChipListEditorProps {
  values: string[];
  onCommit: (next: string[]) => void;
  placeholder: string;
  removeLabel: string;
  /** true: tags同様カンマ区切り複数追加+重複除去(TagChips.svelte互換)。false: 1件ずつ追加 */
  commaSeparated?: boolean;
}

// TagChips.svelte のオンライン編集動作を移植した共通実装(design §9 P4行)。
// 送信は都度onCommit(次の配列全体)経由でPATCH /api/entity/fieldに直結する。
export function ChipListEditor({ values, onCommit, placeholder, removeLabel, commaSeparated }: ChipListEditorProps) {
  const [draft, setDraft] = React.useState("");

  const commitAdd = () => {
    if (!draft.trim()) return;
    if (commaSeparated) {
      const additions = draft
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && !values.includes(v));
      if (additions.length > 0) onCommit([...values, ...additions]);
    } else if (!values.includes(draft.trim())) {
      onCommit([...values, draft.trim()]);
    }
    setDraft("");
  };

  const remove = (value: string) => {
    onCommit(values.filter((v) => v !== value));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {values.map((value) => (
        <Badge key={value} variant="secondary" className="gap-1">
          {value}
          <button type="button" aria-label={removeLabel} onClick={() => remove(value)}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitAdd}
        onKeyDown={(e) => {
          if (e.key === "Enter" || (commaSeparated && e.key === ",")) {
            e.preventDefault();
            commitAdd();
          }
        }}
        placeholder={placeholder}
        className="h-7 w-32 text-xs"
      />
    </div>
  );
}

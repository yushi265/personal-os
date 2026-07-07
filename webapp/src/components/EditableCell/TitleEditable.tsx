import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TitleEditableProps {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  as?: "span" | "h1";
}

// クリック→Input、Enter確定/Esc取消(P3引き継ぎ: 表示モードは素のテキスト、Badge等は他セルで流用)。
export function TitleEditable({ value, onCommit, className, as = "span" }: TitleEditableProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else setDraft(value);
  };

  if (!editing) {
    const Comp = as;
    // 見出し(h1等)の意味論を保ったままキーボードで編集開始できるよう、内側にbuttonをネストする(WCAG 2.1.1)
    return (
      <Comp className={cn(className)}>
        <button
          type="button"
          className="cursor-text rounded px-1 py-0.5 text-left text-inherit [font:inherit] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {value}
        </button>
      </Comp>
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      className={cn("h-8", className)}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

import * as React from "react";
import { useNote } from "@/hooks/useNote";
import { useSaveNote } from "@/hooks/useNoteMutations";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@i18n/ja";

interface NotePanelProps {
  path: string;
}

// シンプルメモ(design-reorder-and-notes.md 機能B-3)。1エンティティ1本文・全文上書きでconflict概念を持たず、
// フォーカスアウトで自動保存する(CommentPanelより上に配置する)。
export function NotePanel({ path }: NotePanelProps) {
  const { data: note, isLoading } = useNote(path);
  const save = useSaveNote(path);

  const [text, setText] = React.useState("");
  const savedTextRef = React.useRef("");
  const [statusText, setStatusText] = React.useState("");
  const statusTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    if (note === undefined) return;
    setText(note);
    savedTextRef.current = note;
  }, [note, path]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const showSavedIndicator = () => {
    setStatusText(t("note.saved"));
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusText(""), 1500);
  };

  const handleBlur = () => {
    if (text === savedTextRef.current) return; // 変更がなければ保存しない
    const toSave = text;
    save.mutate(toSave, {
      onSuccess: () => {
        savedTextRef.current = toSave;
        showSavedIndicator();
      },
    });
  };

  return (
    <div className="space-y-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">{t("preview.section.note")}</span>
      <div className="space-y-1">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          placeholder={t("note.placeholder")}
          aria-label={t("preview.section.note")}
          rows={3}
          className="min-h-14 rounded-lg text-[13px]"
        />
        <div className="flex h-4 justify-end text-xs text-muted-foreground">{statusText}</div>
      </div>
    </div>
  );
}

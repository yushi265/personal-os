import * as React from "react";
import { useNote } from "@/hooks/useNote";
import { useSaveNote } from "@/hooks/useNoteMutations";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
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
  // 非空メモは既定でMarkdownレンダリング表示(機能#4)。編集ボタン/描画エリアのクリックでTextareaへ切替。
  const [editing, setEditing] = React.useState(false);

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
    setEditing(false); // フォーカスアウトでプレビュー表示へ戻す
    if (text === savedTextRef.current) return; // 変更がなければ保存しない
    const toSave = text;
    save.mutate(toSave, {
      onSuccess: () => {
        savedTextRef.current = toSave;
        showSavedIndicator();
      },
    });
  };

  // 非空かつ非編集中のみプレビュー表示。空メモはそのままTextareaを出して入力可能にする。
  const showPreview = !editing && text.trim() !== "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">{t("preview.section.note")}</span>
        {showPreview && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing(true)}>
            {t("note.edit")}
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {showPreview ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setEditing(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEditing(true);
              }
            }}
            aria-label={t("note.edit")}
            className="min-h-14 cursor-text rounded-lg border border-input px-3 py-2"
          >
            <Markdown className="text-[13px]">{text}</Markdown>
          </div>
        ) : (
          <Textarea
            autoFocus={editing}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            placeholder={t("note.placeholder")}
            aria-label={t("preview.section.note")}
            rows={3}
            className="min-h-14 rounded-lg text-[13px]"
          />
        )}
        <div className="flex h-4 justify-end text-xs text-muted-foreground">{statusText}</div>
      </div>
    </div>
  );
}

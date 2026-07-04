import * as React from "react";
import type { Memo } from "@domain/memo";
import { useMemos } from "@/hooks/useMemos";
import { useAddMemo, useRemoveMemoMutation, useUpdateMemoMutation } from "@/hooks/useMemoMutations";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { t } from "@i18n/ja";

interface MemoPanelProps {
  path: string;
}

// メモ追加(Enter送信・Shift+Enter改行・IME対応)/新しい順/編集/削除(design §9 P4行、MemoSection.svelte互換)。
// 409(E007)時は共通楽観的更新フック(useOptimisticMutation)がトースト表示+onSettled再検証を担う。
export function MemoPanel({ path }: MemoPanelProps) {
  const { data: memos, isLoading } = useMemos(path);
  const add = useAddMemo(path);
  const update = useUpdateMemoMutation(path);
  const remove = useRemoveMemoMutation(path);

  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState<Memo | null>(null);
  const [editDraft, setEditDraft] = React.useState("");

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("webapp.loading")}</p>;

  const submitAdd = () => {
    if (!draft.trim()) return;
    add.mutate(draft, { onSuccess: () => setDraft("") });
  };

  const newestFirst = [...(memos ?? [])].reverse();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">{t("preview.section.memo")}</h3>

      <div className="space-y-1">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submitAdd();
            }
          }}
          placeholder={t("memo.placeholder")}
          rows={2}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submitAdd} disabled={!draft.trim()}>
            {t("memo.add")}
          </Button>
        </div>
      </div>

      {newestFirst.length === 0 && <p className="text-sm text-muted-foreground">{t("memo.empty")}</p>}

      <ul className="space-y-2">
        {newestFirst.map((memo) => {
          const isEditing = editing?.datetime === memo.datetime && editing.text === memo.text;
          return (
            <li key={`${memo.datetime}:${memo.text}`} className="rounded-md border p-2">
              <div className="mb-1 text-xs text-muted-foreground">{memo.datetime}</div>
              {isEditing ? (
                <Textarea
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      update.mutate({ expected: memo, newText: editDraft }, { onSuccess: () => setEditing(null) });
                    }
                    if (e.key === "Escape") setEditing(null);
                  }}
                  rows={2}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm">{memo.text}</p>
              )}
              <div className="mt-1 flex justify-end gap-2">
                {isEditing ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update.mutate({ expected: memo, newText: editDraft }, { onSuccess: () => setEditing(null) })}
                  >
                    {t("memo.edit")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(memo);
                      setEditDraft(memo.text);
                    }}
                  >
                    {t("memo.edit")}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(memo)}>
                  {t("memo.delete")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

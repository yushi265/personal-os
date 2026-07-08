import * as React from "react";
import type { Comment } from "@domain/comment";
import { useComments } from "@/hooks/useComments";
import { useAddComment, useRemoveCommentMutation, useUpdateCommentMutation } from "@/hooks/useCommentMutations";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/Markdown";
import { t } from "@i18n/ja";

interface CommentPanelProps {
  path: string;
}

// コメント追加(Enter送信・Shift+Enter改行・IME対応)/新しい順/編集/削除(design §9 P4行、CommentSection.svelte互換)。
// 409(E007)時は共通楽観的更新フック(useOptimisticMutation)がトースト表示+onSettled再検証を担う。
export function CommentPanel({ path }: CommentPanelProps) {
  const { data: comments, isLoading } = useComments(path);
  const add = useAddComment(path);
  const update = useUpdateCommentMutation(path);
  const remove = useRemoveCommentMutation(path);

  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState<Comment | null>(null);
  const [editDraft, setEditDraft] = React.useState("");

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const submitAdd = () => {
    if (!draft.trim()) return;
    add.mutate(draft, { onSuccess: () => setDraft("") });
  };

  const newestFirst = [...(comments ?? [])].reverse();

  return (
    <div className="space-y-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">{t("preview.section.comment")}</span>

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
          placeholder={t("comment.placeholder")}
          aria-label={t("preview.section.comment")}
          rows={2}
          className="rounded-lg text-[13px]"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submitAdd} disabled={!draft.trim()}>
            {t("comment.add")}
          </Button>
        </div>
      </div>

      {newestFirst.length === 0 && <p className="text-sm text-muted-foreground">{t("comment.empty")}</p>}

      <ul className="space-y-2">
        {newestFirst.map((comment) => {
          const isEditing = editing?.datetime === comment.datetime && editing.text === comment.text;
          return (
            <li key={`${comment.datetime}:${comment.text}`} className="rounded-md border p-2">
              <div className="mb-1 text-xs text-muted-foreground">{comment.datetime}</div>
              {isEditing ? (
                <Textarea
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      update.mutate({ expected: comment, newText: editDraft }, { onSuccess: () => setEditing(null) });
                    }
                    if (e.key === "Escape") setEditing(null);
                  }}
                  rows={2}
                />
              ) : (
                <Markdown className="text-sm">{comment.text}</Markdown>
              )}
              <div className="mt-1 flex justify-end gap-2">
                {isEditing ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update.mutate({ expected: comment, newText: editDraft }, { onSuccess: () => setEditing(null) })}
                  >
                    {t("comment.edit")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(comment);
                      setEditDraft(comment.text);
                    }}
                  >
                    {t("comment.edit")}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(comment)}>
                  {t("comment.delete")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import * as React from "react";
import { toast } from "sonner";
import type { Todo } from "@domain/todo";
import { defaultProjectForTodo, stripMetadata } from "@domain/todo";
import type { SourceTodoAction } from "@/api/types";
import { useEntities } from "@/hooks/useEntities";
import { useEntity } from "@/hooks/useEntity";
import { usePromoteTodoMutation } from "@/hooks/useTodoMutations";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@i18n/ja";

const NONE = "__none__";

interface PromoteTodoDialogProps {
  todo: Todo | null;
  onOpenChange: (open: boolean) => void;
}

// Todo→Ticket昇格の簡易ダイアログ(design §9 P4行、PromoteTodoModal.ts相当)。
// フィールド: 新タイトル(prefill: stripMetadata)/所属Project/元Todoの扱い(delete/complete/link)。
export function PromoteTodoDialog({ todo, onOpenChange }: PromoteTodoDialogProps) {
  const { data: projects } = useEntities("project");
  // parentType === "ticket" の場合のみ、その親ticketを取得してproject初期値を導出する(defaultProjectForTodo)
  const parentTicketPath = todo?.parentType === "ticket" ? todo.parentPath : undefined;
  const { data: parentTicket } = useEntity(parentTicketPath);
  const promote = usePromoteTodoMutation();
  const [newTitle, setNewTitle] = React.useState("");
  const [projectPath, setProjectPath] = React.useState<string | undefined>(undefined);
  const [sourceAction, setSourceAction] = React.useState<SourceTodoAction>("delete");

  React.useEffect(() => {
    if (todo) {
      setNewTitle(stripMetadata(todo.text));
      setProjectPath(defaultProjectForTodo(todo, (path) => (path === parentTicketPath ? parentTicket : undefined)));
      setSourceAction("delete");
    }
  }, [todo, parentTicketPath, parentTicket]);

  const submit = () => {
    if (!todo) return;
    if (!newTitle.trim()) {
      toast.error(t("modal.createEntity.titleRequired"));
      return;
    }
    promote.mutate(
      { todo, options: { newTitle: newTitle.trim(), projectPath, sourceAction } },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={!!todo} onOpenChange={onOpenChange}>
      {/* 説明文を持たないダイアログのため、Radixのaria-describedby警告を明示的に無効化する */}
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("modal.promoteTodo.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="promote-todo-title" className="text-sm text-muted-foreground">
              {t("modal.promoteTodo.newTitle")}
            </label>
            <Input id="promote-todo-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t("modal.promoteTodo.project")}</label>
            <Select value={projectPath ?? NONE} onValueChange={(v) => setProjectPath(v === NONE ? undefined : v)}>
              <SelectTrigger aria-label={t("modal.promoteTodo.project")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("manage.field.unset")}</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.path} value={p.path}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t("modal.promoteTodo.sourceAction")}</label>
            <Select value={sourceAction} onValueChange={(v) => setSourceAction(v as SourceTodoAction)}>
              <SelectTrigger aria-label={t("modal.promoteTodo.sourceAction")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delete">{t("modal.promoteTodo.sourceAction.delete")}</SelectItem>
                <SelectItem value="complete">{t("modal.promoteTodo.sourceAction.complete")}</SelectItem>
                <SelectItem value="link">{t("modal.promoteTodo.sourceAction.link")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={promote.isPending}>
            {t("modal.promoteTodo.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

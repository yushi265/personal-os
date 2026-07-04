import * as React from "react";
import { toast } from "sonner";
import type { Priority } from "@domain/entity";
import type { Todo } from "@domain/todo";
import { useTodos } from "@/hooks/useTodos";
import { useAddTodo, useRemoveTodo, useToggleTodo, useUpdateTodo } from "@/hooks/useTodoMutations";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TitleEditable } from "@/components/EditableCell/TitleEditable";
import { DateEdit } from "@/components/EditableCell/DateEdit";
import { PrioritySelect } from "@/components/EditableCell/PrioritySelect";
import { PromoteTodoDialog } from "@/components/PromoteTodoDialog";
import { t } from "@i18n/ja";

interface TodoListPanelProps {
  parent: string;
  scope: "direct" | "all";
  today: string;
}

// Todo一覧+全操作(完了トグル/text・due・priorityインライン編集/削除/昇格/追加)。design §9 P4行、TodoList.svelte互換。
export function TodoListPanel({ parent, scope, today }: TodoListPanelProps) {
  const { data: todos, isLoading } = useTodos(parent, scope);
  const toggle = useToggleTodo();
  const update = useUpdateTodo();
  const remove = useRemoveTodo();
  const add = useAddTodo(parent);

  const [showDone, setShowDone] = React.useState(false);
  const [promoting, setPromoting] = React.useState<Todo | null>(null);
  const [draftText, setDraftText] = React.useState("");
  const [draftDue, setDraftDue] = React.useState("");
  const [draftPriority, setDraftPriority] = React.useState<Priority | undefined>(undefined);

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("webapp.loading")}</p>;

  const visible = (todos ?? []).filter((todo) => showDone || !todo.done);

  const submitAdd = () => {
    if (!draftText.trim()) {
      toast.error(t("preview.todoAdd.textRequired"));
      return;
    }
    add.mutate(
      { text: draftText.trim(), dueDate: draftDue || undefined, priority: draftPriority },
      {
        onSuccess: () => {
          setDraftText("");
          setDraftDue("");
          setDraftPriority(undefined);
        },
        onError: () => toast.error(t("manage.todoAddFailed")),
      }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{t("preview.section.todos")}</h3>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox checked={showDone} onCheckedChange={(v) => setShowDone(!!v)} />
          {t("manage.filter.showDone")}
        </label>
      </div>

      {visible.length === 0 && <p className="text-sm text-muted-foreground">{t("preview.empty.todos")}</p>}

      <ul className="space-y-1">
        {visible.map((todo) => (
          <li key={`${todo.filePath}:${todo.line}`} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/50">
            <Checkbox checked={todo.done} onCheckedChange={() => toggle.mutate(todo)} />
            <div className="flex-1">
              <TitleEditable
                value={todo.text}
                onCommit={(text) => update.mutate({ todo, patch: { text } })}
                className={todo.done ? "text-muted-foreground line-through" : undefined}
              />
            </div>
            <PrioritySelect priority={todo.priority} onCommit={(priority) => update.mutate({ todo, patch: { priority: priority ?? null } })} />
            <DateEdit value={todo.dueDate} today={today} onCommit={(due) => update.mutate({ todo, patch: { dueDate: due ?? null } })} />
            <Button variant="ghost" size="sm" onClick={() => setPromoting(todo)}>
              {t("preview.todo.promote")}
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove.mutate(todo)}>
              {t("preview.todo.delete")}
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 pt-1">
        <Input
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submitAdd();
          }}
          placeholder={t("preview.todoAdd.textPlaceholder")}
          className="h-8 flex-1"
        />
        <input
          type="date"
          value={draftDue}
          onChange={(e) => setDraftDue(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          aria-label={t("preview.todoAdd.due")}
        />
        <PrioritySelect priority={draftPriority} onCommit={setDraftPriority} />
        <Button size="sm" onClick={submitAdd}>
          {t("preview.todoAdd.submit")}
        </Button>
      </div>

      <PromoteTodoDialog todo={promoting} onOpenChange={(open) => !open && setPromoting(null)} />
    </div>
  );
}

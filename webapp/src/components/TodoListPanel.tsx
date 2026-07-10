import * as React from "react";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Ban, PartyPopper, Undo2 } from "lucide-react";
import type { Priority } from "@domain/entity";
import { isCancelledTodo, type Todo } from "@domain/todo";
import { useTodos } from "@/hooks/useTodos";
import { useAddTodo, useRemoveTodo, useSetTodoCancelled, useToggleTodo, useUpdateTodo } from "@/hooks/useTodoMutations";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TitleEditable } from "@/components/EditableCell/TitleEditable";
import { DateEdit } from "@/components/EditableCell/DateEdit";
import { PrioritySelect } from "@/components/EditableCell/PrioritySelect";
import { PromoteTodoDialog } from "@/components/PromoteTodoDialog";
import { listTransition } from "@/lib/motion";
import { t } from "@i18n/ja";

interface TodoListPanelProps {
  parent: string;
  scope: "direct" | "all";
  today: string;
  /** 直下/すべてのセグメントなど、見出し行に並べる追加コントロール(design-refs/geist-final.dc.html §プロジェクト詳細Todo列)。 */
  scopeControl?: React.ReactNode;
}

// Todo一覧+全操作(完了トグル/text・due・priorityインライン編集/削除/昇格/追加)。design §9 P4行、TodoList.svelte互換。
// design P6-B4: 完了チェックのマイクロインタラクション(spring・取り消し線・行フェード)+全件完了時の小さなお祝い演出。
export function TodoListPanel({ parent, scope, today, scopeControl }: TodoListPanelProps) {
  const { data: todos, isLoading } = useTodos(parent, scope);
  const toggle = useToggleTodo();
  const update = useUpdateTodo();
  const remove = useRemoveTodo();
  const setCancelled = useSetTodoCancelled();
  const add = useAddTodo(parent);
  const reduced = useReducedMotion();

  const [showDone, setShowDone] = React.useState(false);
  const [promoting, setPromoting] = React.useState<Todo | null>(null);
  const [draftText, setDraftText] = React.useState("");
  const [draftDue, setDraftDue] = React.useState(today);
  const [draftPriority, setDraftPriority] = React.useState<Priority | undefined>(undefined);
  const [celebrate, setCelebrate] = React.useState(false);
  const wasAllDone = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    const activeTodos = (todos ?? []).filter((todo) => !isCancelledTodo(todo));
    if (activeTodos.length === 0) {
      wasAllDone.current = null;
      return;
    }
    const allDone = activeTodos.every((todo) => todo.done);
    if (allDone && wasAllDone.current === false) {
      setCelebrate(true);
      const timer = setTimeout(() => setCelebrate(false), 1100);
      return () => clearTimeout(timer);
    }
    wasAllDone.current = allDone;
  }, [todos]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const visible = (todos ?? []).filter((todo) => showDone || (!todo.done && !isCancelledTodo(todo)));

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
          setDraftDue(today);
          setDraftPriority(undefined);
        },
        onError: () => toast.error(t("manage.todoAddFailed")),
      }
    );
  };

  return (
    <div className="relative space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">{t("preview.section.todos")}</span>
        <div className="flex items-center gap-3">
          {scopeControl}
          <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Checkbox aria-label={t("manage.filter.showDone")} checked={showDone} onCheckedChange={(v) => setShowDone(!!v)} />
            {t("manage.filter.showDone")}
          </label>
        </div>
      </div>

      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.8, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.8, y: -6 }}
            className="pointer-events-none absolute right-0 top-0 z-10 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
          >
            <PartyPopper className="h-3.5 w-3.5" />
            {t("webapp.celebration.allDone")}
          </motion.div>
        )}
      </AnimatePresence>

      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-[18px] text-center text-[13px] text-faint">
          {t("preview.empty.todos")}
        </div>
      )}

      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {visible.map((todo) => (
            <motion.li
              key={`${todo.filePath}:${todo.line}`}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -4 }}
              transition={listTransition(!!reduced)}
              className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-accent/50"
            >
              <Checkbox
                aria-label={todo.text}
                checked={todo.done}
                disabled={isCancelledTodo(todo)}
                onCheckedChange={() => toggle.mutate(todo)}
                className="data-[state=checked]:animate-in data-[state=checked]:zoom-in-50 data-[state=checked]:duration-200"
              />
              <div className="relative flex-1">
                <TitleEditable
                  value={todo.text}
                  onCommit={(text) => update.mutate({ todo, patch: { text } })}
                  className={`transition-colors duration-200 ${todo.done || isCancelledTodo(todo) ? "text-muted-foreground" : ""}`}
                />
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1 top-1/2 h-px origin-left bg-muted-foreground"
                  initial={false}
                  animate={{ scaleX: todo.done || isCancelledTodo(todo) ? 1 : 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
                />
              </div>
              <PrioritySelect priority={todo.priority} onCommit={(priority) => update.mutate({ todo, patch: { priority: priority ?? null } })} />
              <DateEdit value={todo.dueDate} today={today} onCommit={(due) => update.mutate({ todo, patch: { dueDate: due ?? null } })} />
              <Button variant="ghost" size="sm" onClick={() => setPromoting(todo)}>
                {t("preview.todo.promote")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={isCancelledTodo(todo) ? t("preview.todo.uncancel") : t("preview.todo.cancel")}
                onClick={() => setCancelled.mutate({ todo, cancelled: !isCancelledTodo(todo) })}
              >
                {isCancelledTodo(todo) ? <Undo2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove.mutate(todo)}>
                {t("preview.todo.delete")}
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="flex items-center gap-2 pt-1">
        <Input
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submitAdd();
          }}
          placeholder={t("preview.todoAdd.textPlaceholder")}
          aria-label={t("preview.todoAdd.textPlaceholder")}
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

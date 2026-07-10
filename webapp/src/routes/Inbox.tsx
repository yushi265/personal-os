import * as React from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { today } from "@domain/date";
import { isCancelledTodo } from "@domain/todo";
import { useAllTodos } from "@/hooks/useAllTodos";
import { useAddInboxTodo } from "@/hooks/useAddInboxTodo";
import { useToggleTodo } from "@/hooks/useTodoMutations";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "@/components/PriorityBadge";
import { DueLabel } from "@/components/DueLabel";
import { EmptyState } from "@/components/EmptyState";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import { listTransition } from "@/lib/motion";
import { t } from "@i18n/ja";

// Inboxクイックキャプチャ画面(タスク#5)。プロジェクトを選ばずにTODO/チケットを素早く追加する入口。
// TODO追記は useAddInboxTodo(サーバーがinboxノートへ固定追記)、チケットは既存の CreateTicketDialog を
// プロジェクトなし(=inboxチケット)で再利用する。一覧は useAllTodos を parentType==="inbox" で絞り込む。
export function Inbox() {
  const { data: todos, isLoading, isError } = useAllTodos();
  const addInboxTodo = useAddInboxTodo();
  const toggle = useToggleTodo();
  const reduced = useReducedMotion();
  const [text, setText] = React.useState("");
  const [createTicketOpen, setCreateTicketOpen] = React.useState(false);
  const [showDone, setShowDone] = React.useState(false);
  const now = today();
  usePageTitle(t("webapp.inbox.title"));

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addInboxTodo.mutate({ text: trimmed }, { onSuccess: () => setText("") });
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{t("webapp.inbox.title")}</h1>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Checkbox aria-label={t("manage.filter.showDone")} checked={showDone} onCheckedChange={(v) => setShowDone(!!v)} />
          {t("manage.filter.showDone")}
        </label>
        <Button variant="outline" onClick={() => setCreateTicketOpen(true)}>
          {t("webapp.createTicket.action")}
        </Button>
      </div>
    </div>
  );

  const addForm = (
    <div className="flex items-center gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("webapp.inbox.addTodoPlaceholder")}
        aria-label={t("webapp.inbox.addTodoPlaceholder")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button onClick={submit} disabled={!text.trim() || addInboxTodo.isPending}>
        {t("webapp.inbox.addTodoButton")}
      </Button>
    </div>
  );

  const inboxTodos = (todos ?? []).filter(
    (todo) => todo.parentType === "inbox" && (showDone || (!todo.done && !isCancelledTodo(todo)))
  );

  return (
    <div className="flex flex-col gap-6">
      {header}
      {addForm}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : isError ? (
        <p className="text-destructive">{t("webapp.loadError")}</p>
      ) : inboxTodos.length === 0 ? (
        <EmptyState icon={InboxIcon} title={t("webapp.empty.inbox.title")} body={t("webapp.empty.inbox.body")} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <ul>
            <AnimatePresence initial={false}>
              {inboxTodos.map((todo) => (
                <motion.li
                  key={`${todo.filePath}:${todo.line}`}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -4 }}
                  transition={listTransition(!!reduced)}
                  className="flex items-center gap-3 border-b border-hairline px-5 py-2.5 transition-colors last:border-b-0 hover:bg-surface"
                >
                  <Checkbox
                    aria-label={todo.text}
                    checked={todo.done}
                    onCheckedChange={() => toggle.mutate(todo)}
                    className="data-[state=checked]:animate-in data-[state=checked]:zoom-in-50 data-[state=checked]:duration-200"
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${
                      todo.done || isCancelledTodo(todo) ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {todo.text}
                  </span>
                  <span className="shrink-0">
                    <PriorityBadge priority={todo.priority} />
                  </span>
                  <span className="w-24 shrink-0 text-right font-mono text-xs">
                    <DueLabel due={todo.dueDate} today={now} />
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <CreateTicketDialog open={createTicketOpen} onOpenChange={setCreateTicketOpen} />
    </div>
  );
}

import * as React from "react";
import { Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { today } from "@domain/date";
import { useAllTodos } from "@/hooks/useAllTodos";
import { useEntities } from "@/hooks/useEntities";
import { useToggleTodo } from "@/hooks/useTodoMutations";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "@/components/PriorityBadge";
import { DueLabel } from "@/components/DueLabel";
import { EmptyState } from "@/components/EmptyState";
import { listTransition } from "@/lib/motion";
import { todoDetailPath } from "@/lib/links";
import { t } from "@i18n/ja";

// プロジェクト横断のTODO一覧(タスク#7)。全チケット・全プロジェクト直下のTodoをフラットに並べる。
// 完了トグルは既存の useToggleTodo(["todos"]をinvalidate)を使う。既定では完了済みを隠す(TodoListPanel同様)。
export function Todos() {
  const { data: todos, isLoading, isError } = useAllTodos();
  const projectsQuery = useEntities("project");
  const ticketsQuery = useEntities("ticket");
  const toggle = useToggleTodo();
  const reduced = useReducedMotion();
  const [showDone, setShowDone] = React.useState(false);
  const now = today();
  usePageTitle(t("webapp.todos.title"));

  // 親エンティティのタイトルを引くためのマップ(親はproject/ticketいずれか)
  const parentTitles = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projectsQuery.data ?? []) map.set(p.path, p.title);
    for (const tk of ticketsQuery.data ?? []) map.set(tk.path, tk.title);
    return map;
  }, [projectsQuery.data, ticketsQuery.data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{t("webapp.todos.title")}</h1>
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }
  if (isError) return <p className="text-destructive">{t("webapp.loadError")}</p>;

  const visible = (todos ?? []).filter((todo) => showDone || !todo.done);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{t("webapp.todos.title")}</h1>
        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Checkbox aria-label={t("manage.filter.showDone")} checked={showDone} onCheckedChange={(v) => setShowDone(!!v)} />
          {t("manage.filter.showDone")}
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("webapp.empty.todos.title")} body={t("webapp.empty.todos.body")} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <ul>
            <AnimatePresence initial={false}>
              {visible.map((todo) => {
                const parentPath = todoDetailPath(todo);
                const parentTitle = parentTitles.get(todo.parentPath);
                return (
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
                    <span className={`min-w-0 flex-1 truncate text-sm ${todo.done ? "text-muted-foreground line-through" : ""}`}>
                      {todo.text}
                    </span>
                    {parentTitle &&
                      (parentPath ? (
                        <Link
                          to={parentPath}
                          className="hidden max-w-[200px] shrink-0 truncate text-xs text-faint hover:text-fg hover:underline sm:inline"
                        >
                          {parentTitle}
                        </Link>
                      ) : (
                        <span className="hidden max-w-[200px] shrink-0 truncate text-xs text-faint sm:inline">{parentTitle}</span>
                      ))}
                    <span className="shrink-0">
                      <PriorityBadge priority={todo.priority} />
                    </span>
                    <span className="w-24 shrink-0 text-right font-mono text-xs">
                      <DueLabel due={todo.dueDate} today={now} />
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  );
}

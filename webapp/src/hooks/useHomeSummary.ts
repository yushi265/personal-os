import { useQueries, useQuery } from "@tanstack/react-query";
import { isBlocked, isOverdue, isReviewNeeded, isTodoOverdue } from "@domain/judge";
import { today } from "@domain/date";
import { getEntitiesByType, getTodos } from "@/api/endpoints";

/**
 * ホーム画面サマリカード用の集計(design-browser-ui.md §9 P3行)。
 * サーバーAPI(§5.1)にはEntity横断のTodo一覧エンドポイントが無いため、
 * Project一覧を取得し、各Projectの todos(scope=all、配下チケット込み)を並列取得して集計する。
 * inbox配下の直書きTodoは対象外(既存Obsidian内Dashboardのwidget群と異なりP3では簡易集計とする。P4以降で見直し候補)。
 */
export function useHomeSummary() {
  const goals = useQuery({ queryKey: ["entities", "goal"], queryFn: () => getEntitiesByType("goal") });
  const projects = useQuery({ queryKey: ["entities", "project"], queryFn: () => getEntitiesByType("project") });
  const tickets = useQuery({ queryKey: ["entities", "ticket"], queryFn: () => getEntitiesByType("ticket") });

  const projectPaths = projects.data?.map((p) => p.path) ?? [];
  const todoQueries = useQueries({
    queries: projectPaths.map((path) => ({
      queryKey: ["todos", path, "all"],
      queryFn: () => getTodos(path, "all"),
      enabled: !!projects.data,
    })),
  });

  const isLoading = goals.isLoading || projects.isLoading || tickets.isLoading || todoQueries.some((q) => q.isLoading);
  const isError = goals.isError || projects.isError || tickets.isError || todoQueries.some((q) => q.isError);

  const now = today();
  const allEntities = [...(goals.data ?? []), ...(projects.data ?? []), ...(tickets.data ?? [])];
  const allTodos = todoQueries.flatMap((q) => q.data ?? []);

  const todayTodos = allTodos.filter((t) => !t.done && t.dueDate === now);
  const overdueTodos = allTodos.filter((t) => isTodoOverdue(t, now));
  const overdueEntities = allEntities.filter((e) => isOverdue(e, now));
  const reviewNeededEntities = allEntities.filter((e) => isReviewNeeded(e, now));
  const blockedEntities = allEntities.filter((e) => isBlocked(e));

  return {
    isLoading,
    isError,
    todayTodoCount: todayTodos.length,
    todayTodos,
    overdueTodoCount: overdueTodos.length,
    overdueTodos,
    overdueEntityCount: overdueEntities.length,
    overdueEntities,
    reviewNeededCount: reviewNeededEntities.length,
    reviewNeededEntities,
    blockedCount: blockedEntities.length,
    blockedEntities,
    activeProjectCount: (projects.data ?? []).filter((p) => p.status === "active").length,
  };
}

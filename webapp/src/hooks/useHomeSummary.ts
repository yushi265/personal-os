import { useQuery } from "@tanstack/react-query";
import { getSummary } from "@/api/endpoints";

/**
 * ホーム画面サマリカード用の集計(design-browser-ui.md §9 P5行)。
 * P3ではProject一覧+各Projectのtodosを並列取得するクライアント側N+1集計だったが、
 * `GET /api/summary`(サーバー側でjudge.ts集計済み)を1回呼ぶだけに置き換えた。
 * queryKey ["summary"] はSSEの"index-updated"受信時にまとめて無効化される(webapp/src/api/sse.ts)。
 */
export function useHomeSummary() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => getSummary() });
  const data = summary.data;

  return {
    isLoading: summary.isLoading,
    isError: summary.isError,
    todayTodoCount: data?.todayTodos.length ?? 0,
    todayTodos: data?.todayTodos ?? [],
    overdueTodoCount: data?.overdueTodos.length ?? 0,
    overdueTodos: data?.overdueTodos ?? [],
    overdueEntityCount: data?.overdueEntities.length ?? 0,
    overdueEntities: data?.overdueEntities ?? [],
    reviewNeededCount: data?.reviewNeededEntities.length ?? 0,
    reviewNeededEntities: data?.reviewNeededEntities ?? [],
    blockedCount: data?.blockedEntities.length ?? 0,
    blockedEntities: data?.blockedEntities ?? [],
    activeProjectCount: data?.activeProjectCount ?? 0,
  };
}

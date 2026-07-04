import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { BuildTodoLineInput, Todo, TodoPatch } from "@domain/todo";
import { today } from "@domain/date";
import { addTodo, promoteTodo, removeTodo, toggleTodo, updateTodo } from "@/api/endpoints";
import type { PromoteOptions } from "@/api/types";
import { useOptimisticMutation } from "./useOptimisticMutation";

type TodoCacheSnapshot = [QueryKey, Todo[] | undefined][];

function sameTodo(a: Todo, b: Todo): boolean {
  return a.filePath === b.filePath && a.line === b.line;
}

/**
 * ["todos", ...] で始まる全キャッシュ(direct/allスコープ双方、祖先のscope=allリストにも子Ticket配下のTodoが
 * 含まれるため)を横断して対象Todoを更新/削除する。戻り値はロールバック用スナップショット。
 */
function patchTodoCaches(queryClient: QueryClient, target: Todo, apply: (t: Todo) => Todo | null): TodoCacheSnapshot {
  const entries = queryClient.getQueriesData<Todo[]>({ queryKey: ["todos"] });
  const snapshot: TodoCacheSnapshot = entries.map(([key, data]) => [key, data]);
  for (const [key, data] of entries) {
    if (!data) continue;
    const next = data
      .map((t) => (sameTodo(t, target) ? apply(t) : t))
      .filter((t): t is Todo => t !== null);
    queryClient.setQueryData(key, next);
  }
  return snapshot;
}

function restoreTodoCaches(queryClient: QueryClient, snapshot: TodoCacheSnapshot): void {
  for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
}

export function useAddTodo(parent: string) {
  return useOptimisticMutation<BuildTodoLineInput>({
    mutationFn: (input) => addTodo(parent, input),
    invalidateKeys: [["todos", parent]],
  });
}

export function useToggleTodo() {
  const queryClient = useQueryClient();

  return useOptimisticMutation<Todo, TodoCacheSnapshot>({
    mutationFn: (todo) => toggleTodo(todo),
    onMutate: (todo) => {
      const doneDate = today();
      return patchTodoCaches(queryClient, todo, (t) => ({
        ...t,
        done: !t.done,
        doneDate: !t.done ? doneDate : undefined,
      }));
    },
    onErrorRollback: (snapshot) => {
      if (snapshot) restoreTodoCaches(queryClient, snapshot);
    },
    invalidateKeys: (todo) => [["todos", todo.parentPath], ["todos"]],
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useOptimisticMutation<{ todo: Todo; patch: TodoPatch }, TodoCacheSnapshot>({
    mutationFn: ({ todo, patch }) => updateTodo(todo, patch),
    onMutate: ({ todo, patch }) =>
      patchTodoCaches(queryClient, todo, (t) => ({
        ...t,
        text: patch.text ?? t.text,
        dueDate: patch.dueDate === null ? undefined : (patch.dueDate ?? t.dueDate),
        priority: patch.priority === null ? undefined : (patch.priority ?? t.priority),
      })),
    onErrorRollback: (snapshot) => {
      if (snapshot) restoreTodoCaches(queryClient, snapshot);
    },
    invalidateKeys: ({ todo }) => [["todos", todo.parentPath], ["todos"]],
  });
}

/** Todo→Ticket昇格。Ticket作成+元Todo行の後処理をまたぐため楽観的更新はせず、成功後にtodos/entities両方を再検証する */
export function usePromoteTodoMutation() {
  return useOptimisticMutation<{ todo: Todo; options: PromoteOptions }>({
    mutationFn: ({ todo, options }) => promoteTodo(todo, options),
    invalidateKeys: ({ todo }) => [["todos", todo.parentPath], ["todos"], ["entities"]],
  });
}

export function useRemoveTodo() {
  const queryClient = useQueryClient();

  return useOptimisticMutation<Todo, TodoCacheSnapshot>({
    mutationFn: (todo) => removeTodo(todo),
    onMutate: (todo) => patchTodoCaches(queryClient, todo, () => null),
    onErrorRollback: (snapshot) => {
      if (snapshot) restoreTodoCaches(queryClient, snapshot);
    },
    invalidateKeys: (todo) => [["todos", todo.parentPath], ["todos"]],
  });
}

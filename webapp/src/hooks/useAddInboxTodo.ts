import type { Priority } from "@domain/entity";
import { addInboxTodo } from "@/api/endpoints";
import { useOptimisticMutation } from "./useOptimisticMutation";

// Inboxクイックキャプチャ(タスク#5)。追記先の行位置はサーバー確定のため楽観的更新はせず、
// 成功後に ["todos"](useAllTodos 含む)と ["summary"] を再検証して反映する。
export function useAddInboxTodo() {
  return useOptimisticMutation<{ text: string; dueDate?: string; priority?: Priority }>({
    mutationFn: (input) => addInboxTodo(input),
    invalidateKeys: [["todos"], ["summary"]],
  });
}

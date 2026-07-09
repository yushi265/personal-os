import { useQuery } from "@tanstack/react-query";
import { getAllTodos } from "@/api/endpoints";

// プロジェクト横断の全Todo。["todos", ...] 配下にキーを置くことで、既存のTodoトグル等のmutationが
// invalidateする ["todos"] にこのリストも含まれ、操作後に自動で再取得される(useTodoMutations参照)。
export function useAllTodos() {
  return useQuery({
    queryKey: ["todos", "__all__"],
    queryFn: getAllTodos,
  });
}

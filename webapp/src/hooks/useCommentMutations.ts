import { useQueryClient } from "@tanstack/react-query";
import type { Comment } from "@domain/comment";
import { addComment, removeComment, updateComment } from "@/api/endpoints";
import { useOptimisticMutation } from "./useOptimisticMutation";

function sameComment(a: Comment, b: Comment): boolean {
  return a.datetime === b.datetime && a.text === b.text;
}

/** コメント追加。新規datetimeはサーバー側で確定するため楽観的更新はせず、成功後に再取得する */
export function useAddComment(path: string) {
  return useOptimisticMutation<string>({
    mutationFn: (text) => addComment(path, text),
    invalidateKeys: [["memos", path]],
  });
}

export function useUpdateCommentMutation(path: string) {
  const queryClient = useQueryClient();

  return useOptimisticMutation<{ expected: Comment; newText: string }, Comment[] | undefined>({
    mutationFn: ({ expected, newText }) => updateComment(path, expected, newText),
    onMutate: async ({ expected, newText }) => {
      await queryClient.cancelQueries({ queryKey: ["memos", path] });
      const previous = queryClient.getQueryData<Comment[]>(["memos", path]);
      queryClient.setQueryData<Comment[]>(["memos", path], (old) =>
        old?.map((c) => (sameComment(c, expected) ? { ...c, text: newText } : c))
      );
      return previous;
    },
    onErrorRollback: (previous) => queryClient.setQueryData(["memos", path], previous),
    invalidateKeys: [["memos", path]],
  });
}

export function useRemoveCommentMutation(path: string) {
  const queryClient = useQueryClient();

  return useOptimisticMutation<Comment, Comment[] | undefined>({
    mutationFn: (expected) => removeComment(path, expected),
    onMutate: async (expected) => {
      await queryClient.cancelQueries({ queryKey: ["memos", path] });
      const previous = queryClient.getQueryData<Comment[]>(["memos", path]);
      queryClient.setQueryData<Comment[]>(["memos", path], (old) => old?.filter((c) => !sameComment(c, expected)));
      return previous;
    },
    onErrorRollback: (previous) => queryClient.setQueryData(["memos", path], previous),
    invalidateKeys: [["memos", path]],
  });
}

import { useQueryClient } from "@tanstack/react-query";
import type { Memo } from "@domain/memo";
import { addMemo, removeMemo, updateMemo } from "@/api/endpoints";
import { useOptimisticMutation } from "./useOptimisticMutation";

function sameMemo(a: Memo, b: Memo): boolean {
  return a.datetime === b.datetime && a.text === b.text;
}

/** メモ追加。新規datetimeはサーバー側で確定するため楽観的更新はせず、成功後に再取得する */
export function useAddMemo(path: string) {
  return useOptimisticMutation<string>({
    mutationFn: (text) => addMemo(path, text),
    invalidateKeys: [["memos", path]],
  });
}

export function useUpdateMemoMutation(path: string) {
  const queryClient = useQueryClient();

  return useOptimisticMutation<{ expected: Memo; newText: string }, Memo[] | undefined>({
    mutationFn: ({ expected, newText }) => updateMemo(path, expected, newText),
    onMutate: async ({ expected, newText }) => {
      await queryClient.cancelQueries({ queryKey: ["memos", path] });
      const previous = queryClient.getQueryData<Memo[]>(["memos", path]);
      queryClient.setQueryData<Memo[]>(["memos", path], (old) =>
        old?.map((m) => (sameMemo(m, expected) ? { ...m, text: newText } : m))
      );
      return previous;
    },
    onErrorRollback: (previous) => queryClient.setQueryData(["memos", path], previous),
    invalidateKeys: [["memos", path]],
  });
}

export function useRemoveMemoMutation(path: string) {
  const queryClient = useQueryClient();

  return useOptimisticMutation<Memo, Memo[] | undefined>({
    mutationFn: (expected) => removeMemo(path, expected),
    onMutate: async (expected) => {
      await queryClient.cancelQueries({ queryKey: ["memos", path] });
      const previous = queryClient.getQueryData<Memo[]>(["memos", path]);
      queryClient.setQueryData<Memo[]>(["memos", path], (old) => old?.filter((m) => !sameMemo(m, expected)));
      return previous;
    },
    onErrorRollback: (previous) => queryClient.setQueryData(["memos", path], previous),
    invalidateKeys: [["memos", path]],
  });
}

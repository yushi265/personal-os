import { saveNote } from "@/api/endpoints";
import { useOptimisticMutation } from "./useOptimisticMutation";

/**
 * シンプルメモの保存(design-reorder-and-notes.md 機能B-3)。1エンティティ1本文・全文上書きのため
 * conflict概念を持たず、最後の保存が勝つ(常に成功として扱う)。
 */
export function useSaveNote(path: string) {
  return useOptimisticMutation<string>({
    mutationFn: (text) => saveNote(path, text),
    invalidateKeys: [["note", path]],
  });
}

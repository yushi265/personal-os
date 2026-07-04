import { useQuery } from "@tanstack/react-query";
import { getComments } from "@/api/endpoints";

// queryKey設計(design-browser-ui.md §6.3): ["memos", path](APIパス/queryKeyは/api/memosのまま据え置き)
export function useComments(path: string | undefined) {
  return useQuery({
    queryKey: ["memos", path],
    queryFn: () => getComments(path as string),
    enabled: !!path,
  });
}

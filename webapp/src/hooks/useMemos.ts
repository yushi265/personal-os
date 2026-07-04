import { useQuery } from "@tanstack/react-query";
import { getMemos } from "@/api/endpoints";

// queryKey設計(design-browser-ui.md §6.3): ["memos", path]
export function useMemos(path: string | undefined) {
  return useQuery({
    queryKey: ["memos", path],
    queryFn: () => getMemos(path as string),
    enabled: !!path,
  });
}

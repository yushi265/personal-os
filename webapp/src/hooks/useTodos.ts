import { useQuery } from "@tanstack/react-query";
import { getTodos } from "@/api/endpoints";

// queryKey設計(design-browser-ui.md §6.3): ["todos", parentPath, scope]
export function useTodos(parent: string, scope: "direct" | "all" = "direct") {
  return useQuery({
    queryKey: ["todos", parent, scope],
    queryFn: () => getTodos(parent, scope),
    enabled: !!parent,
  });
}

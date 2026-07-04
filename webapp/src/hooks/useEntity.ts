import { useQuery } from "@tanstack/react-query";
import { getChildren, getEntity } from "@/api/endpoints";

// queryKey設計(design-browser-ui.md §6.3): ["entity", path]
export function useEntity(path: string | undefined) {
  return useQuery({
    queryKey: ["entity", path],
    queryFn: () => getEntity(path as string),
    enabled: !!path,
  });
}

export function useChildren(path: string | undefined) {
  return useQuery({
    queryKey: ["entity", path, "children"],
    queryFn: () => getChildren(path as string),
    enabled: !!path,
  });
}

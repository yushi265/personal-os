import { useQuery } from "@tanstack/react-query";
import { getNote } from "@/api/endpoints";

// queryKey設計: ["note", path]
export function useNote(path: string | undefined) {
  return useQuery({
    queryKey: ["note", path],
    queryFn: () => getNote(path as string),
    enabled: !!path,
  });
}

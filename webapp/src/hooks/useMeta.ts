import { useQuery } from "@tanstack/react-query";
import { getMeta } from "@/api/endpoints";

export function useMeta() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: () => getMeta(),
    staleTime: 60_000,
  });
}

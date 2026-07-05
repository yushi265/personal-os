import { useQuery } from "@tanstack/react-query";
import type { EntityType } from "@domain/entity";
import { getEntitiesByType } from "@/api/endpoints";

// queryKey設計(design-browser-ui.md §6.3): ["entities", type]
export function useEntities(type: EntityType) {
  return useQuery({
    queryKey: ["entities", type],
    queryFn: () => getEntitiesByType(type),
  });
}

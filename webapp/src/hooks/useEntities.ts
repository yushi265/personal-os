import { useQuery } from "@tanstack/react-query";
import type { EntityType } from "@domain/entity";
import { getEntitiesByType, getProjectsGroupedByGoal } from "@/api/endpoints";

// queryKey設計(design-browser-ui.md §6.3): ["entities", type, group?]
export function useEntities(type: EntityType) {
  return useQuery({
    queryKey: ["entities", type],
    queryFn: () => getEntitiesByType(type),
  });
}

export function useProjectsGroupedByGoal() {
  return useQuery({
    queryKey: ["entities", "project", "goal"],
    queryFn: () => getProjectsGroupedByGoal(),
  });
}

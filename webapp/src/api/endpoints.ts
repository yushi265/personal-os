import type { Entity, EntityType } from "@domain/entity";
import type { Todo } from "@domain/todo";
import { apiClient } from "./client";
import type { GoalGroup, MetaResponse } from "./types";

export function getMeta(): Promise<MetaResponse> {
  return apiClient.get<MetaResponse>("/api/meta");
}

export function getEntitiesByType(type: EntityType): Promise<Entity[]> {
  return apiClient.get<{ entities: Entity[] }>(`/api/entities?type=${type}`).then((r) => r.entities);
}

export function getProjectsGroupedByGoal(): Promise<GoalGroup[]> {
  return apiClient.get<{ groups: GoalGroup[] }>("/api/entities?group=goal").then((r) => r.groups);
}

export function getEntity(path: string): Promise<Entity> {
  return apiClient.get<Entity>(`/api/entity?path=${encodeURIComponent(path)}`);
}

export function getChildren(path: string): Promise<Entity[]> {
  return apiClient.get<{ entities: Entity[] }>(`/api/entity/children?path=${encodeURIComponent(path)}`).then((r) => r.entities);
}

export function getTodos(parent: string, scope: "direct" | "all" = "direct"): Promise<Todo[]> {
  return apiClient.get<{ todos: Todo[] }>(`/api/todos?parent=${encodeURIComponent(parent)}&scope=${scope}`).then((r) => r.todos);
}

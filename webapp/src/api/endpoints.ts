import type { Entity, EntityType } from "@domain/entity";
import type { BuildTodoLineInput, Todo, TodoPatch } from "@domain/todo";
import type { Memo } from "@domain/memo";
import { apiClient } from "./client";
import type { CreateEntityInput, EntityFieldKey, EntityFieldValue, GoalGroup, MetaResponse, PromoteOptions } from "./types";

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

// ---- entity mutations ----

export function createEntity(input: CreateEntityInput): Promise<{ path: string }> {
  return apiClient.post<{ path: string }>("/api/entities", input);
}

export function updateEntityField(path: string, key: EntityFieldKey, value: EntityFieldValue): Promise<void> {
  return apiClient.patch<void>(`/api/entity/field?path=${encodeURIComponent(path)}`, { key, value });
}

export function changeEntityStatus(path: string, next: string): Promise<void> {
  return apiClient.post<void>(`/api/entity/status?path=${encodeURIComponent(path)}`, { next });
}

export function archiveEntity(path: string): Promise<{ path: string }> {
  return apiClient.post<{ path: string }>(`/api/entity/archive?path=${encodeURIComponent(path)}`);
}

export function deleteEntity(path: string): Promise<void> {
  return apiClient.delete<void>(`/api/entity?path=${encodeURIComponent(path)}`);
}

export function promoteTodo(todo: Todo, options: PromoteOptions): Promise<void> {
  return apiClient.post<void>("/api/entity/promote-todo", { todo, options });
}

export function promoteTicket(path: string): Promise<void> {
  return apiClient.post<void>(`/api/entity/promote-ticket?path=${encodeURIComponent(path)}`);
}

// ---- todo mutations ----

export function addTodo(parent: string, input: BuildTodoLineInput): Promise<void> {
  return apiClient.post<void>(`/api/todos?parent=${encodeURIComponent(parent)}`, input);
}

export function toggleTodo(todo: Todo): Promise<void> {
  return apiClient.patch<void>("/api/todos/toggle", todo);
}

export function updateTodo(todo: Todo, patch: TodoPatch): Promise<void> {
  return apiClient.patch<void>("/api/todos", { todo, patch });
}

export function removeTodo(todo: Todo): Promise<void> {
  return apiClient.delete<void>("/api/todos", todo);
}

// ---- memos ----

export function getMemos(path: string): Promise<Memo[]> {
  return apiClient.get<{ memos: Memo[] }>(`/api/memos?path=${encodeURIComponent(path)}`).then((r) => r.memos);
}

export function addMemo(path: string, text: string): Promise<void> {
  return apiClient.post<void>(`/api/memos?path=${encodeURIComponent(path)}`, { text });
}

export function updateMemo(path: string, expected: Memo, newText: string): Promise<void> {
  return apiClient.patch<void>(`/api/memos?path=${encodeURIComponent(path)}`, { expected, newText });
}

export function removeMemo(path: string, expected: Memo): Promise<void> {
  return apiClient.delete<void>(`/api/memos?path=${encodeURIComponent(path)}`, { expected });
}

import type { Entity } from "@domain/entity";
import type { Todo } from "@domain/todo";

/** ホームサマリカードからの詳細ジャンプ用(design §9 P4行「5. ホームからの詳細ジャンプ」)。project/ticket以外は詳細画面を持たない */
export function entityDetailPath(entity: Entity): string | undefined {
  if (entity.type === "project") return `/projects/${encodeURIComponent(entity.path)}`;
  if (entity.type === "ticket") return `/tickets/${encodeURIComponent(entity.path)}`;
  return undefined;
}

export function todoDetailPath(todo: Todo): string | undefined {
  if (todo.parentType === "project") return `/projects/${encodeURIComponent(todo.parentPath)}`;
  if (todo.parentType === "ticket") return `/tickets/${encodeURIComponent(todo.parentPath)}`;
  return undefined;
}

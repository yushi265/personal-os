import type { Entity, EntityType, Priority } from "@domain/entity";
import type { Todo } from "@domain/todo";

export interface MetaResponse {
  vaultName: string;
  capability: { todoFeatures: boolean };
  port: number;
}

/**
 * GET /api/summary のレスポンス形状(design-browser-ui.md §9 P5行: N+1解消のためサーバー側でjudge.ts集計済み)。
 * `src/server/ApiRouter.ts` handleSummary / `src/ui/dashboard/dashboardData.ts` と同じ判定に揃える。
 */
export interface HomeSummaryResponse {
  todayTodos: Todo[];
  overdueTodos: Todo[];
  overdueEntities: Entity[];
  reviewNeededEntities: Entity[];
  activeProjectCount: number;
}

/**
 * src/services/EntityFieldService.ts の型再掲(webappはsrc/services配下をimportできない — Obsidian API依存の
 * infra層を経由してしまうため。domain層と同様にレスポンス/リクエスト形状としてここに複製する、design §5.2)。
 */
export type EntityFieldKey =
  | "status"
  | "priority"
  | "due"
  | "start"
  | "reviewCycle"
  | "goal"
  | "project"
  | "title"
  | "tags"
  | "labels";

export type EntityFieldValue = string | string[] | undefined;

/** src/services/EntityService.ts CreateEntityInput の再掲 */
export interface CreateEntityInput {
  type: EntityType;
  title: string;
  goal?: string;
  project?: string;
  priority?: Priority;
  due?: string;
  templateName?: string;
}

/** src/services/PromoteService.ts SourceTodoAction / PromoteOptions の再掲 */
export type SourceTodoAction = "delete" | "complete" | "link";

export interface PromoteOptions {
  newTitle: string;
  projectPath?: string;
  sourceAction: SourceTodoAction;
  template?: string;
}

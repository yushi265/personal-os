import type { Entity } from "@domain/entity";

/**
 * サーバー(src/ui/manage/manageData.ts groupProjectsByGoal)が返す形状(design-browser-ui.md §5.1.1)。
 * manageData.tsはUI層でありwebappからのimport対象外のため、レスポンス形状としてここに再掲する。
 */
export interface GoalGroup {
  goal: Entity | null;
  projects: Entity[];
}

export interface MetaResponse {
  vaultName: string;
  capability: { todoFeatures: boolean };
  port: number;
}

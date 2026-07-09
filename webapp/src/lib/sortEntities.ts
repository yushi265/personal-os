/**
 * Presentation層(webapp限定): 一覧テーブルの列ソート(Projects.tsx / ProjectDetail.tsxのチケット一覧で共用)。
 * 意味論はObsidian側 manageData.ts の sortEntityRows と揃える(priority: high→medium→low→未設定、
 * status: PROJECT_STATUSES/TICKET_STATUSESのワークフロー順、due: ISO文字列比較・未設定は末尾、
 * title: localeCompare)。手動順(デフォルト)はAPIの返却順(order昇順)そのものを使うため、ソートを一切適用しない。
 * progressキーは進捗列の廃止(行背景フィル化)に伴い削除した。
 */
import { type Entity, type Priority, validStatusesOf } from "@domain/entity";

export type SortKey = "title" | "status" | "priority" | "due";
export type SortDirection = "asc" | "desc";

/** direction === undefined は「手動順(デフォルト)」を表す */
export interface SortState {
  key: SortKey;
  direction?: SortDirection;
}

export const DEFAULT_SORT_STATE: SortState = { key: "title", direction: undefined };

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function priorityRank(p: Priority | undefined): number {
  return p ? PRIORITY_RANK[p] : 3;
}

function statusRank(entity: Entity): number {
  const order = validStatusesOf(entity.type);
  if (!order) return Number.MAX_SAFE_INTEGER;
  const idx = order.indexOf(entity.status);
  return idx >= 0 ? idx : order.length;
}

/**
 * ヘッダクリックの3段トグル: 同じ列を押すたび 昇順→降順→手動順(デフォルト) と循環する。
 * 別の列を押した場合は常に昇順から開始する。
 */
export function nextSortState(current: SortState, clickedKey: SortKey): SortState {
  if (current.key !== clickedKey || current.direction === undefined) {
    return { key: clickedKey, direction: "asc" };
  }
  if (current.direction === "asc") return { key: clickedKey, direction: "desc" };
  return { key: clickedKey, direction: undefined };
}

function compareByKey(a: Entity, b: Entity, key: SortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title);
    case "status":
      return statusRank(a) - statusRank(b);
    case "priority":
      return priorityRank(a.priority) - priorityRank(b.priority);
    case "due": {
      const ad = a.due ?? "9999-99-99";
      const bd = b.due ?? "9999-99-99";
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    }
    default:
      return 0;
  }
}

/** direction未指定(手動順)の場合はentitiesをそのまま返す(APIの返却順=order昇順を尊重) */
export function sortEntities<T extends Entity>(entities: T[], sort: SortState): T[] {
  if (!sort.direction) return entities;
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...entities].sort((a, b) => sign * compareByKey(a, b, sort.key));
}

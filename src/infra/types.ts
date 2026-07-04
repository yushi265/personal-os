import type { Todo } from "../domain/todo";

/**
 * Indexer / EntityService から後続Phaseの実装(DataviewAdapter / ProgressService /
 * ActivityLogService)へ依存する箇所を、最小限のインターフェースで前方宣言する。
 * Phase 1時点では未実装のため各所でoptional注入とし、未設定なら該当処理をスキップする。
 */

export interface TodoProvider {
	getTodos(path: string): Promise<Todo[]>;
}

export interface ProgressRecalculator {
	recalcAncestors(path: string): Promise<void>;
	recalcAll(): Promise<void>;
}

export type LogKind = "create" | "update" | "status" | "review" | "archive" | "promote";

export interface ActivityLogger {
	log(kind: LogKind, message: string): Promise<void>;
}

import type { Priority } from "./entity";

/**
 * Todoの内部表現(design.md §3.2)。
 * メタデータ抽出(stripMetadata等)はPhase 2で実装する。
 */
export interface Todo {
	filePath: string;
	line: number;
	text: string;
	done: boolean;
	dueDate?: string;
	startDate?: string;
	doneDate?: string;
	priority?: Priority;
	labels: string[];
	parentType: "ticket" | "project" | "inbox";
	parentPath: string;
}

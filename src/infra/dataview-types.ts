/**
 * `obsidian-dataview` の型を自前で最小限定義する(パッケージ自体は導入しない)。
 * Phase 2のDataviewAdapterで使用する。
 */

export interface STask {
	line: number;
	text: string;
	completed: boolean;
	priority?: string;
	[key: string]: unknown;
}

export interface DataviewPageFile {
	tasks: { values: STask[] };
}

export interface DataviewPage {
	file: DataviewPageFile;
}

export interface DataviewApi {
	page(path: string): DataviewPage | undefined;
}

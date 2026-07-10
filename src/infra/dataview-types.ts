/**
 * `obsidian-dataview` の型を自前で最小限定義する(パッケージ自体は導入しない)。
 * Phase 2のDataviewAdapterで使用する。
 */

export interface STask {
	line: number;
	text: string;
	completed: boolean;
	/** checkboxの生文字(" "/"x"/"-" 等1文字)。旧版Dataviewでは欠落することがある */
	status?: string;
	priority?: string;
	/** 行内の開始位置。start.col がリスト項目("- ")の開始カラム(=インデント幅)を表す */
	position?: { start: { line: number; col: number }; end: { line: number; col: number } };
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

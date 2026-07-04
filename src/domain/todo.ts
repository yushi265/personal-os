import type { Priority } from "./entity";

/**
 * Todoの内部表現(design.md §3.2)。
 * rawText は元のTodo行から checkbox/インデントを除いた生テキスト(DataviewのSTask.textそのまま)。
 * editLine の照合用行復元(rebuildTodoLine)にのみ使う内部用途で、未設定でも動作するようoptionalとする。
 */
export interface Todo {
	filePath: string;
	line: number;
	text: string;
	rawText?: string;
	done: boolean;
	dueDate?: string;
	startDate?: string;
	doneDate?: string;
	priority?: Priority;
	labels: string[];
	parentType: "ticket" | "project" | "inbox";
	parentPath: string;
}

const EMOJI_DATE_PATTERN = /(📅|🛫|✅)\s*(\d{4}-\d{2}-\d{2})/gu;
const INLINE_FIELD_PATTERN = /\[(priority|labels)::\s*([^\]]+)\]/g;

/** 📅/🛫/✅の絵文字日付と [key:: value] インラインフィールドを除去した表示用本文(trim済み) */
export function stripMetadata(text: string): string {
	return text
		.replace(EMOJI_DATE_PATTERN, "")
		.replace(INLINE_FIELD_PATTERN, "")
		.replace(/\s+/g, " ")
		.trim();
}

/** 指定絵文字に対応する日付を抽出する(該当なしは undefined) */
export function extractEmojiDate(text: string, emoji: "📅" | "🛫" | "✅"): string | undefined {
	const matches = text.matchAll(EMOJI_DATE_PATTERN);
	for (const m of matches) {
		if (m[1] === emoji) return m[2];
	}
	return undefined;
}

/** `[key:: value]` インラインフィールドの値を抽出する(該当なしは undefined) */
export function extractInline(text: string, key: string): string | undefined {
	const pattern = new RegExp(`\\[${key}::\\s*([^\\]]+)\\]`);
	const m = text.match(pattern);
	return m ? m[1].trim() : undefined;
}

/** `[key:: a, b, c]` 形式のインラインフィールドを `,` 区切り→trim→空要素除去した配列で返す */
export function extractInlineList(text: string, key: string): string[] {
	const raw = extractInline(text, key);
	if (!raw) return [];
	return raw
		.split(",")
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
}

/** Dataview STask.priority や文字列を "high"/"medium"/"low" | undefined へ正規化する */
export function normalizePriority(value: unknown): Priority | undefined {
	if (value === undefined || value === null) return undefined;
	const s = String(value).trim().toLowerCase();
	if (s === "high" || s === "medium" || s === "low") return s as Priority;
	if (s === "highest") return "high";
	if (s === "lowest") return "low";
	return undefined;
}

export interface BuildTodoLineInput {
	text: string;
	dueDate?: string;
	priority?: Priority;
}

/** QuickAdd用のTodo行生成: `- [ ] text` + ` 📅 date` + ` [priority:: p]` */
export function buildTodoLine(input: BuildTodoLineInput): string {
	let line = `- [ ] ${input.text.trim()}`;
	if (input.dueDate) line += ` 📅 ${input.dueDate}`;
	if (input.priority) line += ` [priority:: ${input.priority}]`;
	return line;
}

/**
 * 完了トグル。インデントは "- [ ]"/"- [x]" 部分文字列の置換のみで実現するため保持される。
 * 未完了→完了: "- [x]" + " ✅ doneDate" を付与。完了→未完了: "✅ date" を除去。
 */
export function toggleTodoLine(line: string, doneDate: string): string {
	if (/^\s*- \[ \]/.test(line)) {
		return line.replace("- [ ]", "- [x]") + ` ✅ ${doneDate}`;
	}
	return line.replace("- [x]", "- [ ]").replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/u, "");
}

/**
 * Todoオブジェクトから行内容を復元する。editLine() の expected 照合や、
 * PromoteService(Phase 4)でTicketノートへ移設する際の行生成に用いる。
 * rawText未設定時は表示用text(メタデータ除去済み)からの近似復元となる。
 */
export function rebuildTodoLine(todo: Todo): string {
	const checkbox = todo.done ? "- [x]" : "- [ ]";
	const body = todo.rawText ?? todo.text;
	return `${checkbox} ${body}`.trimEnd();
}

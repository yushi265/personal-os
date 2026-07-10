import type { Entity, Priority } from "./entity";

/**
 * Todoの内部表現(design.md §3.2)。
 * rawText は元のTodo行から checkbox/インデントを除いた生テキスト(DataviewのSTask.textそのまま)。
 * indent は行頭のインデント文字列(ネストしたTodoの "- [ ]" 前の空白)。
 * どちらも editLine の照合用行復元(rebuildTodoLine)にのみ使う内部用途で、未設定でも動作するようoptionalとする。
 * statusChar は checkbox の生文字(" "/"x"/"-" など1文字)。設定されていれば行復元(rebuildTodoLine)の正本になり、
 * `[-]`(cancelled)を含む任意のカスタム状態を保全する。未設定(旧クライアント由来)の場合は done から補完する。
 */
export interface Todo {
	filePath: string;
	line: number;
	text: string;
	rawText?: string;
	indent?: string;
	done: boolean;
	statusChar?: string;
	dueDate?: string;
	startDate?: string;
	doneDate?: string;
	priority?: Priority;
	labels: string[];
	parentType: "ticket" | "project" | "inbox";
	parentPath: string;
}

/** cancelled(`- [-]`)状態のTodoか。done とは相互排他(パース時にinfraが保証)。 */
export function isCancelledTodo(todo: Todo): boolean {
	return todo.statusChar === "-";
}

/** todo.done/statusChar から checkbox 内の1文字を解決する(rebuildTodoLine/updateTodoLineで共有する規則) */
function resolveStatusChar(todo: Pick<Todo, "done" | "statusChar">): string {
	if (todo.statusChar && todo.statusChar.length === 1) return todo.statusChar;
	return todo.done ? "x" : " ";
}

/**
 * Todo→Ticket昇格モーダルの「所属project」初期値(design要望)。
 * - parentType === "project" → その親project自身
 * - parentType === "ticket" → 親ticketの project(getEntity経由で解決)
 * - inbox / 解決不能 → undefined(未選択)
 */
export function defaultProjectForTodo(todo: Todo, getEntity: (path: string) => Entity | undefined): string | undefined {
	if (todo.parentType === "project") return todo.parentPath;
	if (todo.parentType === "ticket") return getEntity(todo.parentPath)?.project;
	return undefined;
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
 * cancelled("- [-]")行は誤トグル防止のためno-op(そのまま返す)。
 */
export function toggleTodoLine(line: string, doneDate: string): string {
	if (/^\s*- \[-\]/.test(line)) {
		return line;
	}
	if (/^\s*- \[ \]/.test(line)) {
		return line.replace("- [ ]", "- [x]") + ` ✅ ${doneDate}`;
	}
	return line.replace("- [x]", "- [ ]").replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/u, "");
}

/**
 * checkbox のcancelled状態を設定/解除する(TodoService.setCancelledの行変換)。
 * 行頭 checkbox(インデント許容)を "[-]"(true) / "[ ]"(false) へ置換する。
 * cancel時は完了時に付与された "✅ YYYY-MM-DD" を除去する(un-checkと同義)。
 * checkboxの無い行はそのまま返す(変換しない。上位のeditLine照合でconflict検出される)。
 */
export function setTodoLineCancelled(line: string, cancelled: boolean): string {
	if (!/^\s*- \[.\]/.test(line)) return line;
	const char = cancelled ? "-" : " ";
	const withChar = line.replace(/^(\s*- \[).(\])/, `$1${char}$2`);
	if (!cancelled) return withChar;
	return withChar.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/u, "");
}

/**
 * Todoオブジェクトから行内容を復元する。editLine() の expected 照合や、
 * PromoteService(Phase 4)でTicketノートへ移設する際の行生成に用いる。
 * rawText未設定時は表示用text(メタデータ除去済み)からの近似復元となる。
 * デフォルトでは元のインデントを維持する(editLineの照合はインデント込みの実行行と一致させる必要がある)。
 * stripIndent: true の場合はインデントを除去する(Promote先の新規ノートへ移設する際、トップレベル項目として書き出すため)。
 */
export function rebuildTodoLine(todo: Todo, opts?: { stripIndent?: boolean }): string {
	const checkbox = `- [${resolveStatusChar(todo)}]`;
	const body = todo.rawText ?? todo.text;
	const indent = opts?.stripIndent ? "" : (todo.indent ?? "");
	return `${indent}${checkbox} ${body}`.trimEnd();
}

export interface TodoPatch {
	text?: string;
	dueDate?: string | null; // null = 削除
	priority?: Priority | null; // null = 削除
}

/**
 * インライン編集用の次行生成。text/dueDate/priorityのみ差し替え、
 * startDate/doneDate/labels/indent/checkbox状態は保持する。
 * 出力順序は text→🛫→📅→✅→[priority::]→[labels::](buildTodoLineの絵文字順序と揃える)。
 */
export function updateTodoLine(todo: Todo, patch: TodoPatch): string {
	const checkbox = `- [${resolveStatusChar(todo)}]`;
	const indent = todo.indent ?? "";
	const text = (patch.text ?? todo.text).trim();

	let line = `${indent}${checkbox} ${text}`;
	if (todo.startDate) line += ` 🛫 ${todo.startDate}`;
	const due = patch.dueDate === null ? undefined : (patch.dueDate ?? todo.dueDate);
	if (due) line += ` 📅 ${due}`;
	if (todo.doneDate) line += ` ✅ ${todo.doneDate}`;
	const priority = patch.priority === null ? undefined : (patch.priority ?? todo.priority);
	if (priority) line += ` [priority:: ${priority}]`;
	if (todo.labels.length > 0) line += ` [labels:: ${todo.labels.join(", ")}]`;
	return line;
}

const TODO_SECTION_HEADING = "## Todo";

/**
 * body内の "## Todo" セクション末尾へ line を追記する。
 * - セクションが存在すれば、次の見出し行(先頭が "#")の直前 or 本文末尾までの中で
 *   最後の非空行の直後に挿入する。
 * - セクションが存在しなければ、本文末尾に "\n\n## Todo\n{line}\n" を追加する(PromoteServiceと同じ形式)。
 * - 見出し表記は "## Todo" への完全一致(大文字小文字区別あり)のみを対象とする(表記ゆれは非対応)。
 */
export function appendTodoToSection(body: string, line: string): string {
	const lines = body.split("\n");
	const headingIdx = lines.findIndex((l) => l.trim() === TODO_SECTION_HEADING);

	if (headingIdx === -1) {
		const trimmed = body.replace(/\n+$/, "");
		return `${trimmed}\n\n${TODO_SECTION_HEADING}\n${line}\n`;
	}

	let insertAt = headingIdx + 1;
	for (let i = headingIdx + 1; i < lines.length; i++) {
		if (/^#{1,6}\s/.test(lines[i])) break; // 次の見出しで打ち切り
		if (lines[i].trim() !== "") insertAt = i + 1; // 非空行の直後を候補に更新
	}
	lines.splice(insertAt, 0, line);
	return lines.join("\n");
}

export type MoveTodoTarget =
	| { kind: "beforeLine"; lineContent: string }
	| { kind: "afterLine"; lineContent: string }
	| { kind: "up" }
	| { kind: "down" };

/**
 * Todo行の物理的な並び替え(design-reorder-and-notes.md A-1: Todoの並び順=本文中の行の物理順序そのもの)。
 * rebuildTodoLine(todo)の完全一致で対象行を検索し、見つからなければnullを返す(呼び出し側でconflict扱いにする)。
 * target: beforeLine/afterLine は他Todoの行内容(完全一致)を基準にした挿入。up/downは現在位置からの1行移動。
 */
export function moveTodoLine(body: string, todo: Todo, target: MoveTodoTarget): string | null {
	const expected = rebuildTodoLine(todo);
	const lines = body.split("\n");
	const fromIdx = lines.indexOf(expected);
	if (fromIdx === -1) return null;

	const removed = lines.splice(fromIdx, 1)[0];

	let insertAt: number;
	switch (target.kind) {
		case "up":
			insertAt = Math.max(0, fromIdx - 1);
			break;
		case "down":
			insertAt = Math.min(lines.length, fromIdx + 1);
			break;
		case "beforeLine": {
			const idx = lines.indexOf(target.lineContent);
			if (idx === -1) return null;
			insertAt = idx;
			break;
		}
		case "afterLine": {
			const idx = lines.indexOf(target.lineContent);
			if (idx === -1) return null;
			insertAt = idx + 1;
			break;
		}
	}

	lines.splice(insertAt, 0, removed);
	return lines.join("\n");
}

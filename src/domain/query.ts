/**
 * Domain層: Advanced Searchクエリのパース・評価(design.md §4.4 / detail-design.md §3.3)。
 * このファイルはObsidian APIに一切依存しない純粋TypeScriptとする。
 */

import type { Entity } from "./entity";
import type { Todo } from "./todo";

export interface ParsedQuery {
	filters: Record<string, string>;
	text: string;
}

const FILTER_KEY_PATTERN = /^(type|status|priority|tags|labels|due|goal|project):(.+)$/;

/** "type:ticket status:doing priority:high 銀行" → { filters: {...}, text: "銀行" } */
export function parseQuery(input: string): ParsedQuery {
	const filters: Record<string, string> = {};
	const words: string[] = [];
	for (const token of input.trim().split(/\s+/)) {
		if (!token) continue;
		const m = token.match(FILTER_KEY_PATTERN);
		if (m) filters[m[1]] = m[2];
		else words.push(token);
	}
	return { filters, text: words.join(" ") };
}

/** パスまたはタイトルの部分一致(大文字小文字無視) */
function matchTitle(value: string | undefined, cond: string, resolveTitle?: (path: string) => string | undefined): boolean {
	if (!value) return false;
	const c = cond.toLowerCase();
	if (value.toLowerCase().includes(c)) return true;
	const title = resolveTitle?.(value);
	return !!title && title.toLowerCase().includes(c);
}

/** `<YYYY-MM-DD` / `>YYYY-MM-DD` / 完全一致(ISO文字列辞書順比較) */
function matchDue(due: string | undefined, cond: string): boolean {
	if (!due) return false;
	if (cond.startsWith("<")) return due < cond.slice(1);
	if (cond.startsWith(">")) return due > cond.slice(1);
	return due === cond;
}

/** Entity専用フィルタキー(evaluateTodoでこれらが指定されていたら誤ヒットを避けるためfalseにする) */
const TODO_FILTER_KEYS = new Set(["priority", "labels", "due"]);

export function evaluate(q: ParsedQuery, e: Entity, resolveTitle?: (path: string) => string | undefined): boolean {
	for (const [key, cond] of Object.entries(q.filters)) {
		switch (key) {
			case "type":
				if (e.type !== cond) return false;
				break;
			case "status":
				if (e.status !== cond) return false;
				break;
			case "priority":
				if (e.priority !== cond) return false;
				break;
			case "tags":
				if (!e.tags.includes(cond)) return false;
				break;
			case "labels":
				if (!e.labels.includes(cond)) return false;
				break;
			case "goal":
				if (!matchTitle(e.goal, cond, resolveTitle)) return false;
				break;
			case "project":
				if (!matchTitle(e.project, cond, resolveTitle)) return false;
				break;
			case "due":
				if (!matchDue(e.due, cond)) return false;
				break;
		}
	}
	if (q.text && !e.title.toLowerCase().includes(q.text.toLowerCase())) return false;
	return true;
}

/** Todoに対する評価。対象キー: priority/labels/due/text。それ以外のフィルタキー指定時はfalse(Entity専用キーでの誤ヒット防止) */
export function evaluateTodo(q: ParsedQuery, t: Todo): boolean {
	for (const [key, cond] of Object.entries(q.filters)) {
		if (!TODO_FILTER_KEYS.has(key)) return false;
		switch (key) {
			case "priority":
				if (t.priority !== cond) return false;
				break;
			case "labels":
				if (!t.labels.includes(cond)) return false;
				break;
			case "due":
				if (!matchDue(t.dueDate, cond)) return false;
				break;
		}
	}
	if (q.text && !t.text.toLowerCase().includes(q.text.toLowerCase())) return false;
	return true;
}

/**
 * タイムスタンプ付きメモ(design-memo.md §2)。
 * Obsidian APIに依存しない純粋関数のみ。`## Memo` セクション検出は domain/todo.ts の
 * appendTodoToSection と同じ規約(完全一致見出し)を踏襲する。
 */

export interface Memo {
	datetime: string; // "YYYY-MM-DD HH:mm" 固定形式
	text: string; // 本文(複数行はそのまま、末尾の空行を除去)
}

const MEMO_SECTION_HEADING = "## Memo";
/** 有効なメモ見出し。日時形式に一致する行のみメモとして解釈する(表記ゆれは非対応) */
const MEMO_HEADING_PATTERN = /^### \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
/** metadataCache.headings[].heading(先頭の"### "を含まない見出しテキスト)用パターン。countMemoHeadings専用 */
const MEMO_HEADING_TEXT_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
/** Memoセクションからの離脱判定(レベル1-2見出し)。メモ自体はレベル3見出しのため区別する */
const SECTION_LEAVE_PATTERN = /^#{1,2}\s/;
/** 個々のメモ本文の終端判定(全レベル見出し) */
const ANY_HEADING_PATTERN = /^#{1,6}\s/;

interface MemoBlock {
	headingIndex: number; // "### datetime" 見出し行のindex
	bodyStart: number; // 本文開始index
	bodyEnd: number; // 本文終端index(末尾空行trim済み、exclusive)
	datetime: string;
	text: string;
}

export interface HeadingLike {
	heading: string;
	level: number;
}

/**
 * metadataCache由来のheadings配列だけから "## Memo" 配下の有効な日時見出し数を数える(本文読み込みなし、IndexStore.memoCount用)。
 * `## Memo`(level2)自体が無ければ0。配下でlevel<=2の見出しに達したらそこで打ち切る。
 */
export function countMemoHeadings(headings: HeadingLike[]): number {
	const idx = headings.findIndex((h) => h.level === 2 && h.heading === "Memo");
	if (idx === -1) return 0;

	let count = 0;
	for (let i = idx + 1; i < headings.length; i++) {
		const h = headings[i];
		if (h.level <= 2) break;
		if (h.level === 3 && MEMO_HEADING_TEXT_PATTERN.test(h.heading)) count++;
	}
	return count;
}

/**
 * body内の "## Memo" セクションを走査し、有効な日時見出しごとにブロックを切り出す。
 * parseMemoSection / updateMemo / removeMemo が共通で使う内部ロジック。
 */
function scanMemoBlocks(lines: string[]): MemoBlock[] {
	const headingIdx = lines.findIndex((l) => l.trim() === MEMO_SECTION_HEADING);
	if (headingIdx === -1) return [];

	let sectionEnd = lines.length;
	for (let i = headingIdx + 1; i < lines.length; i++) {
		if (SECTION_LEAVE_PATTERN.test(lines[i])) {
			sectionEnd = i;
			break;
		}
	}

	const blocks: MemoBlock[] = [];
	let i = headingIdx + 1;
	while (i < sectionEnd) {
		if (!MEMO_HEADING_PATTERN.test(lines[i])) {
			i++;
			continue;
		}
		const datetime = lines[i].slice(4);
		const bodyStart = i + 1;
		let rawEnd = sectionEnd;
		for (let j = bodyStart; j < sectionEnd; j++) {
			if (ANY_HEADING_PATTERN.test(lines[j])) {
				rawEnd = j;
				break;
			}
		}
		let bodyEnd = rawEnd;
		while (bodyEnd > bodyStart && lines[bodyEnd - 1].trim() === "") bodyEnd--;
		blocks.push({
			headingIndex: i,
			bodyStart,
			bodyEnd,
			datetime,
			text: lines.slice(bodyStart, bodyEnd).join("\n"),
		});
		i = rawEnd;
	}
	return blocks;
}

/**
 * "## Memo" セクション内の有効な日時見出しをMemoの配列として返す(新しい順への並べ替えはしない、時系列のまま)。
 * セクションがなければ `[]`。形式外の記述(自由文・表記ゆれ見出し)は無視し、戻り値に含めない。
 */
export function parseMemoSection(body: string): Memo[] {
	return scanMemoBlocks(body.split("\n")).map(({ datetime, text }) => ({ datetime, text }));
}

/**
 * "## Memo" セクション末尾へ日時見出し+本文のブロックを追記する。
 * - セクションが存在すれば、次のレベル1-2見出しの直前 or 本文末尾までの中で
 *   最後の非空行の直後に、空行+新規ブロックを挿入する。
 * - セクションが存在しなければ、本文末尾に "\n\n## Memo\n\n### {datetime}\n{text}\n" を追加する。
 */
export function appendMemo(body: string, datetime: string, text: string): string {
	const lines = body.split("\n");
	const headingIdx = lines.findIndex((l) => l.trim() === MEMO_SECTION_HEADING);

	if (headingIdx === -1) {
		const trimmed = body.replace(/\n+$/, "");
		return `${trimmed}\n\n${MEMO_SECTION_HEADING}\n\n### ${datetime}\n${text}\n`;
	}

	let insertAt = headingIdx + 1;
	for (let i = headingIdx + 1; i < lines.length; i++) {
		if (SECTION_LEAVE_PATTERN.test(lines[i])) break;
		if (lines[i].trim() !== "") insertAt = i + 1;
	}
	lines.splice(insertAt, 0, "", `### ${datetime}`, ...text.split("\n"));
	return lines.join("\n");
}

/**
 * 見出し+本文が expected と完全一致するメモを1件に特定し、本文のみ newText に差し替える(日時は維持)。
 * 一致件数が0件(既に変更/削除済み)または2件以上(重複メモで一意特定不能)の場合は conflict として null を返す。
 */
export function updateMemo(body: string, expected: Memo, newText: string): string | null {
	const lines = body.split("\n");
	const matches = scanMemoBlocks(lines).filter((b) => b.datetime === expected.datetime && b.text === expected.text);
	if (matches.length !== 1) return null;

	const target = matches[0];
	lines.splice(target.bodyStart, target.bodyEnd - target.bodyStart, ...newText.split("\n"));
	return lines.join("\n");
}

/**
 * 見出し+本文が expected と完全一致するメモを1件に特定し、見出し行+本文行+直前の区切り空行1行を削除する。
 * 一致件数が0件または2件以上の場合は conflict として null を返す。
 * 削除後に "## Memo" セクションが空になっても見出し自体は残す(次回 appendMemo がそのまま追記できる状態を維持)。
 */
export function removeMemo(body: string, expected: Memo): string | null {
	const lines = body.split("\n");
	const matches = scanMemoBlocks(lines).filter((b) => b.datetime === expected.datetime && b.text === expected.text);
	if (matches.length !== 1) return null;

	const target = matches[0];
	let removeStart = target.headingIndex;
	if (removeStart > 0 && lines[removeStart - 1].trim() === "") removeStart--;
	lines.splice(removeStart, target.bodyEnd - removeStart);
	return lines.join("\n");
}

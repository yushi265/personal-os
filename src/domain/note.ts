/**
 * シンプルメモ(design-reorder-and-notes.md 機能B-2)。
 * `## Memo`(コメント。comment.ts)と違い「1エンティティに1つ」「タイムスタンプなし」「編集の都度上書き」の
 * 単純な性質のため、comment.tsのブロック走査ロジックは使わず、セクション本文をまるごと1本として扱う。
 * `## Note`はTodo(`## Todo`)/コメント(`## Memo`)いずれとも衝突しない新規の予約見出し。
 */

const NOTE_SECTION_HEADING = "## Note";
const MEMO_SECTION_HEADING = "## Memo";
/** Noteセクションからの離脱判定(レベル1-2見出し)。comment.tsのSECTION_LEAVE_PATTERNと同じ規約 */
const SECTION_LEAVE_PATTERN = /^#{1,2}\s/;

/**
 * body内の "## Note" セクション本文を返す。見出し直後から次のレベル1-2見出し、または本文末尾までを
 * 本文として扱い、末尾の空行はtrimする。セクションが存在しなければ空文字列を返す。
 */
export function parseNoteSection(body: string): string {
	const lines = body.split("\n");
	const headingIdx = lines.findIndex((l) => l.trim() === NOTE_SECTION_HEADING);
	if (headingIdx === -1) return "";

	const bodyEnd = findBodyEnd(lines, headingIdx);
	return lines.slice(headingIdx + 1, bodyEnd).join("\n");
}

/**
 * "## Note" セクションの本文を text で丸ごと上書きする(追記ではなく全置換)。
 * - text が空/空白のみの場合: セクション自体(見出し込み)を除去する(コメントの「空でも見出しを残す」
 *   方針とは意図的に異ならせる。design-reorder-and-notes.md B-2確認事項)
 * - セクションが無く text ありの場合: `## Memo` セクションの直前に新規作成する。`## Memo` も無ければ末尾に作成する
 * - セクションがあり text ありの場合: 本文のみ丸ごと置換する
 */
export function writeNoteSection(body: string, text: string): string {
	const trimmedText = text.trim();
	const lines = body.split("\n");
	const headingIdx = lines.findIndex((l) => l.trim() === NOTE_SECTION_HEADING);

	if (headingIdx === -1) {
		if (trimmedText === "") return body;
		return insertNoteSection(body, trimmedText);
	}

	// bodyEnd(末尾の空行/次セクションとの区切り空行を除いた終端)を境界にすることで、
	// セクション末尾の区切り空行を上書き・削除どちらの操作でも壊さずに残す(comment.tsのbodyEndトリムと同じ規約)。
	const bodyEnd = findBodyEnd(lines, headingIdx);

	if (trimmedText === "") {
		let removeStart = headingIdx;
		if (removeStart > 0 && lines[removeStart - 1].trim() === "") removeStart--;
		lines.splice(removeStart, bodyEnd - removeStart);
		return lines.join("\n");
	}

	lines.splice(headingIdx + 1, bodyEnd - (headingIdx + 1), ...trimmedText.split("\n"));
	return lines.join("\n");
}

/** headingIdx直後から始まるセクションの終端index(次のレベル1-2見出し、またはlines.length)を返す */
function findSectionEnd(lines: string[], headingIdx: number): number {
	for (let i = headingIdx + 1; i < lines.length; i++) {
		if (SECTION_LEAVE_PATTERN.test(lines[i])) return i;
	}
	return lines.length;
}

/** セクション本文の終端(findSectionEndの結果から、末尾の空行をtrimしたindex)を返す */
function findBodyEnd(lines: string[], headingIdx: number): number {
	const sectionEnd = findSectionEnd(lines, headingIdx);
	let bodyEnd = sectionEnd;
	while (bodyEnd > headingIdx + 1 && lines[bodyEnd - 1].trim() === "") bodyEnd--;
	return bodyEnd;
}

/** セクションなし・text指定ありの新規作成。`## Memo`の直前に挿入し、なければ本文末尾に追加する */
function insertNoteSection(body: string, trimmedText: string): string {
	const lines = body.split("\n");
	const memoHeadingIdx = lines.findIndex((l) => l.trim() === MEMO_SECTION_HEADING);

	if (memoHeadingIdx === -1) {
		const trimmed = body.replace(/\n+$/, "");
		return `${trimmed}\n\n${NOTE_SECTION_HEADING}\n${trimmedText}\n`;
	}

	lines.splice(memoHeadingIdx, 0, NOTE_SECTION_HEADING, ...trimmedText.split("\n"), "");
	return lines.join("\n");
}

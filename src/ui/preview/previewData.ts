/**
 * PreviewView専用データ整形(design-ui-first.md §4.7)。
 * PreviewView.tsはPreview.svelteをimportするため、Vitestからsvelteプラグインなしで
 * 直接importできない。純粋関数はこのファイルに切り出し、PreviewView.ts/テストの双方から参照する。
 */
import type { Entity } from "../../domain/entity";
import type { Todo } from "../../domain/todo";

export interface PreviewData {
	entity: Entity | null;
	children: Entity[];
	todos: Todo[];
	bodyLines: string[];
	/** entityがnull(IndexStore対象外)の場合に、解析エラーの理由があれば設定する(design-ui-first.md §4.7) */
	parseError?: string;
	/** entityがnullでもアクティブファイルのpathを保持する(parseErrorノートの「ノートで開く」導線用) */
	path?: string;
}

export const EMPTY_PREVIEW_DATA: PreviewData = { entity: null, children: [], todos: [], bodyLines: [] };

const BODY_PREVIEW_MAX_LINES = 20;
const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---\n?/;

/** entity未発見時、getParseErrors()の中から該当pathの理由を検索する(design-ui-first.md §4.7) */
export function resolveParseError(parseErrors: { path: string; reason: string }[], path: string): string | undefined {
	return parseErrors.find((e) => e.path === path)?.reason;
}

/** frontmatterブロックを除いた本文の先頭N行を返す(design-ui-first.md §4.1「本文」セクション用) */
export function bodyPreviewLines(raw: string, maxLines: number = BODY_PREVIEW_MAX_LINES): string[] {
	return raw.replace(FRONTMATTER_PATTERN, "").split("\n").slice(0, maxLines);
}

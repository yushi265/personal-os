import { parseNoteSection, writeNoteSection } from "../domain/note";
import type { VaultRepository } from "../infra/VaultRepository";

/**
 * シンプルメモ(design-reorder-and-notes.md 機能B-2)。1エンティティ1本文・全文上書きのため、
 * CommentServiceと違いconflict検出は行わない(最後の保存が勝つ)。IndexStore/Indexerには依存しない。
 */
export class NoteService {
	constructor(private repo: VaultRepository) {}

	/** 詳細画面表示時のオンデマンド読込 */
	async get(path: string): Promise<string> {
		const body = await this.repo.readBody(path);
		return parseNoteSection(body);
	}

	/** セクション本文を丸ごと上書きする。textが空/空白のみなら見出しごと除去する(domain/note.ts参照) */
	async save(path: string, text: string): Promise<void> {
		await this.repo.processBody(path, (body) => writeNoteSection(body, text));
	}
}

import { Notice } from "obsidian";
import { nowStamp } from "../domain/date";
import { appendComment, parseCommentSection, removeComment, updateComment } from "../domain/comment";
import type { Comment } from "../domain/comment";
import type { VaultRepository } from "../infra/VaultRepository";
import { t } from "../i18n/ja";

export type CommentWriteResult = "ok" | "conflict";

/**
 * タイムスタンプ付きコメント(design-memo.md §3。旧称: メモ)。TodoServiceと同じ薄いオーケストレーション層。
 * IndexStore/Indexerには依存しない(コメントはreindex対象にしないため)。
 */
export class CommentService {
	constructor(private repo: VaultRepository) {}

	/** 詳細画面表示時のオンデマンド読込。IndexStoreには保持しない(cachedRead経由) */
	async list(path: string): Promise<Comment[]> {
		const body = await this.repo.readBody(path);
		return parseCommentSection(body);
	}

	/** "## Memo" セクション末尾へ日時見出し+本文を追記する。日時はnowStamp()で自動付与 */
	async add(path: string, text: string): Promise<void> {
		const datetime = nowStamp();
		await this.repo.processBody(path, (body) => appendComment(body, datetime, text.trim()));
	}

	/** コメント削除のUndo: add()と異なり元のdatetimeをそのまま使って復元する */
	async restore(path: string, comment: Comment): Promise<void> {
		await this.repo.processBody(path, (body) => appendComment(body, comment.datetime, comment.text));
	}

	/**
	 * 見出し+本文の内容一致で対象コメントを特定し、本文のみ更新する(日時は維持)。
	 * conflict(0件/複数件一致)時はNoticeのみ行う。一覧の再読込はUI側の責務。
	 */
	async update(path: string, expected: Comment, newText: string): Promise<CommentWriteResult> {
		return this.writeOrConflict(path, (body) => updateComment(body, expected, newText.trim()));
	}

	/**
	 * 見出し+本文の内容一致で対象コメントを特定し、削除する。
	 * conflict(0件/複数件一致)時はNoticeのみ行う。一覧の再読込はUI側の責務。
	 */
	async remove(path: string, expected: Comment): Promise<CommentWriteResult> {
		return this.writeOrConflict(path, (body) => removeComment(body, expected));
	}

	/** fnがnullを返した場合はconflict扱いとし、本文は無変更でNoticeのみ行う(update/removeの共通処理) */
	private async writeOrConflict(path: string, fn: (body: string) => string | null): Promise<CommentWriteResult> {
		const state: { result: CommentWriteResult } = { result: "ok" };
		await this.repo.processBody(path, (body) => {
			const next = fn(body);
			if (next === null) {
				state.result = "conflict";
				return body;
			}
			return next;
		});
		if (state.result === "conflict") new Notice(t("E007"));
		return state.result;
	}
}

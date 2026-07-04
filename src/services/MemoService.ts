import { Notice } from "obsidian";
import { nowStamp } from "../domain/date";
import { appendMemo, parseMemoSection, removeMemo, updateMemo } from "../domain/memo";
import type { Memo } from "../domain/memo";
import type { VaultRepository } from "../infra/VaultRepository";
import { t } from "../i18n/ja";

export type MemoWriteResult = "ok" | "conflict";

/**
 * タイムスタンプ付きメモ(design-memo.md §3)。TodoServiceと同じ薄いオーケストレーション層。
 * IndexStore/Indexerには依存しない(メモはreindex対象にしないため)。
 */
export class MemoService {
	constructor(private repo: VaultRepository) {}

	/** 詳細画面表示時のオンデマンド読込。IndexStoreには保持しない(cachedRead経由) */
	async list(path: string): Promise<Memo[]> {
		const body = await this.repo.readBody(path);
		return parseMemoSection(body);
	}

	/** "## Memo" セクション末尾へ日時見出し+本文を追記する。日時はnowStamp()で自動付与 */
	async add(path: string, text: string): Promise<void> {
		const datetime = nowStamp();
		await this.repo.processBody(path, (body) => appendMemo(body, datetime, text.trim()));
	}

	/** メモ削除のUndo: add()と異なり元のdatetimeをそのまま使って復元する */
	async restore(path: string, memo: Memo): Promise<void> {
		await this.repo.processBody(path, (body) => appendMemo(body, memo.datetime, memo.text));
	}

	/**
	 * 見出し+本文の内容一致で対象メモを特定し、本文のみ更新する(日時は維持)。
	 * conflict(0件/複数件一致)時はNoticeのみ行う。一覧の再読込はUI側の責務。
	 */
	async update(path: string, expected: Memo, newText: string): Promise<MemoWriteResult> {
		return this.writeOrConflict(path, (body) => updateMemo(body, expected, newText.trim()));
	}

	/**
	 * 見出し+本文の内容一致で対象メモを特定し、削除する。
	 * conflict(0件/複数件一致)時はNoticeのみ行う。一覧の再読込はUI側の責務。
	 */
	async remove(path: string, expected: Memo): Promise<MemoWriteResult> {
		return this.writeOrConflict(path, (body) => removeMemo(body, expected));
	}

	/** fnがnullを返した場合はconflict扱いとし、本文は無変更でNoticeのみ行う(update/removeの共通処理) */
	private async writeOrConflict(path: string, fn: (body: string) => string | null): Promise<MemoWriteResult> {
		const state: { result: MemoWriteResult } = { result: "ok" };
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

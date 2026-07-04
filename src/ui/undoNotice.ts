import { Notice } from "obsidian";
import { t } from "../i18n/ja";

/**
 * 削除・Archive等を即時実行した後に出す「元に戻す」ボタン付きNotice(design: 事前確認モーダル廃止方針)。
 * onUndoは呼び出し側が退避しておいた状態から復元する処理を渡す。durationMsは5〜8秒を想定しデフォルト7秒とする。
 */
export function showUndoNotice(message: string, onUndo: () => void | Promise<void>, durationMs = 7000): void {
	const fragment = document.createDocumentFragment();

	const span = document.createElement("span");
	span.textContent = message;
	fragment.appendChild(span);

	const button = document.createElement("button");
	button.textContent = t("undo.action");
	button.className = "pos-undo-toast-btn";
	fragment.appendChild(button);

	const notice = new Notice(fragment, durationMs);
	button.addEventListener("click", () => {
		void onUndo();
		notice.hide();
	});
}

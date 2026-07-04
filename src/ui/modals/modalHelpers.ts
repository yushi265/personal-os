import { ButtonComponent } from "obsidian";
import { t } from "../../i18n/ja";

/**
 * モーダル共通のキーボード/ボタン行/バリデーション表示ヘルパー(Obsidian UI V3)。
 * CreateEntityModal / QuickAddModal / PromoteModal / ReviewModal / SaveViewModal から共通利用する。
 */

/** Cmd/Ctrl+Enterでどこからでも送信できるようにする(textarea内も含む)。contentEl直下にバインドしイベントバブリングを利用する */
export function bindModEnterSubmit(contentEl: HTMLElement, submit: () => void): void {
	contentEl.addEventListener("keydown", (evt: KeyboardEvent) => {
		if (evt.key === "Enter" && (evt.metaKey || evt.ctrlKey)) {
			evt.preventDefault();
			submit();
		}
	});
}

/** 1行inputでのEnter単独送信(既存のQuickAddModal等の挙動を汎用化したもの)。textareaには使わない */
export function bindEnterSubmit(inputEl: HTMLInputElement, submit: () => void): void {
	inputEl.addEventListener("keydown", (evt: KeyboardEvent) => {
		if (evt.key === "Enter" && !evt.isComposing) {
			evt.preventDefault();
			submit();
		}
	});
}

export interface ButtonRowOptions {
	submitLabel: string;
	onSubmit: () => void;
	onCancel?: () => void;
}

/** ボタン行の統一(主要=mod-cta右端、キャンセル左)。Setting行の名前列を持たない専用のボタン行として描画する */
export function addModalButtonRow(contentEl: HTMLElement, opts: ButtonRowOptions): ButtonComponent {
	const row = contentEl.createDiv({ cls: "pos-modal-button-row" });
	new ButtonComponent(row).setButtonText(t("modal.cancel")).onClick(() => opts.onCancel?.());
	const submitBtn = new ButtonComponent(row).setButtonText(opts.submitLabel).setCta().onClick(() => opts.onSubmit());
	return submitBtn;
}

/** 必須項目のラベルに視覚的な印(*)を付ける */
export function markRequired(nameEl: HTMLElement): void {
	nameEl.createSpan({ cls: "pos-modal-required-mark", text: " *" });
}

/**
 * 必須テキスト項目のリアルタイムバリデーション。空の間は送信ボタンをdisabledにし、
 * 入力欄に軽い注意表示を付ける(「送信して初めてエラー」をなくす、Obsidian UI V3)。
 * 呼び出し側はonChangeのたびにrevalidate()を呼ぶこと。
 */
export function bindRequiredField(
	inputEl: HTMLInputElement | HTMLTextAreaElement,
	submitBtn: ButtonComponent,
	getValue: () => string
): { revalidate: () => void } {
	function revalidate(): void {
		const valid = getValue().trim().length > 0;
		inputEl.toggleClass("pos-modal-field-invalid", !valid);
		submitBtn.setDisabled(!valid);
	}
	revalidate();
	return { revalidate };
}

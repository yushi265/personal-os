import { Modal, Setting, type App } from "obsidian";
import { t } from "../../i18n/ja";

export interface ConfirmModalOptions {
	message: string;
	confirmLabel?: string;
	onConfirm: () => void | Promise<void>;
}

/** 汎用の削除等確認モーダル(design-ui-first.md §4.2)。message + 確認/キャンセルのみを持つ */
export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private opts: ConfirmModalOptions
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", { text: this.opts.message });
		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText(t("confirmModal.cancel")).onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText(this.opts.confirmLabel ?? t("confirmModal.confirm"))
					.setWarning()
					.onClick(() => {
						void this.opts.onConfirm();
						this.close();
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

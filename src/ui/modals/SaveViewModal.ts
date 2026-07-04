import { Modal, Setting, type App } from "obsidian";
import { t } from "../../i18n/ja";

export interface SaveViewModalOptions {
	onSubmit: (name: string) => void | Promise<void>;
}

/** 保存ビューの名前入力モーダル(design-ui-first.md §4.2)。SavedViewメニューの「現在の状態を保存...」から開く */
export class SaveViewModal extends Modal {
	private name = "";

	constructor(
		app: App,
		private opts: SaveViewModalOptions
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.setTitle(t("manage.savedView.saveModalTitle"));
		new Setting(contentEl).addText((text) => {
			text.setPlaceholder(t("manage.savedView.namePlaceholder")).onChange((value) => {
				this.name = value;
			});
			text.inputEl.focus();
		});
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t("manage.savedView.save"))
				.setCta()
				.onClick(() => void this.submit())
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		await this.opts.onSubmit(this.name.trim());
		this.close();
	}
}

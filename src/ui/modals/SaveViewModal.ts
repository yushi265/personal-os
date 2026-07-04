import { Modal, Setting, type App } from "obsidian";
import { t } from "../../i18n/ja";
import { addModalButtonRow, bindEnterSubmit, bindModEnterSubmit, bindRequiredField, markRequired } from "./modalHelpers";

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
		bindModEnterSubmit(contentEl, () => void this.submit());
		this.setTitle(t("manage.savedView.saveModalTitle"));
		const nameSetting = new Setting(contentEl).setName(t("manage.savedView.nameLabel"));
		markRequired(nameSetting.nameEl);
		let inputEl: HTMLInputElement | undefined;
		nameSetting.addText((text) => {
			inputEl = text.inputEl;
			text.setPlaceholder(t("manage.savedView.namePlaceholder")).onChange((value) => {
				this.name = value;
				validation?.revalidate();
			});
			text.inputEl.focus();
		});
		if (inputEl) bindEnterSubmit(inputEl, () => void this.submit());

		const submitBtn = addModalButtonRow(contentEl, {
			submitLabel: t("manage.savedView.save"),
			onSubmit: () => void this.submit(),
			onCancel: () => this.close(),
		});
		const validation = inputEl ? bindRequiredField(inputEl, submitBtn, () => this.name) : undefined;
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		await this.opts.onSubmit(this.name.trim());
		this.close();
	}
}

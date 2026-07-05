import { ButtonComponent, Modal, Setting, type App } from "obsidian";
import { t } from "../../i18n/ja";
import { bindModEnterSubmit } from "./modalHelpers";

export interface DueDateModalOptions {
	initialValue?: string;
	onSubmit: (next: string | undefined) => void | Promise<void>;
}

/**
 * Todo長押しメニュー「期限を設定…」から開く日付入力モーダル(design: モバイル長押しメニュー拡充)。
 * Obsidianのcontext menu(Menu)は日付入力欄を持てないため、専用の小さなModalで済ませる。
 * 「クリア」は期限を削除する操作(onSubmitへundefinedを渡す。TodoPatch.dueDate: null相当)。
 */
export class DueDateModal extends Modal {
	private value: string;

	constructor(
		app: App,
		private opts: DueDateModalOptions
	) {
		super(app);
		this.value = opts.initialValue ?? "";
	}

	onOpen(): void {
		const { contentEl } = this;
		bindModEnterSubmit(contentEl, () => void this.submit(this.value));
		this.setTitle(t("modal.dueDate.title"));

		new Setting(contentEl).setName(t("modal.dueDate.label")).addText((text) => {
			const inputEl = text.inputEl;
			inputEl.type = "date";
			inputEl.value = this.value;
			inputEl.addEventListener("change", () => {
				this.value = inputEl.value;
			});
			inputEl.focus();
		});

		const row = contentEl.createDiv({ cls: "pos-modal-button-row" });
		new ButtonComponent(row).setButtonText(t("modal.dueDate.clear")).onClick(() => void this.submit(""));
		new ButtonComponent(row).setButtonText(t("modal.cancel")).onClick(() => this.close());
		new ButtonComponent(row).setButtonText(t("modal.dueDate.save")).setCta().onClick(() => void this.submit(this.value));
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async submit(value: string): Promise<void> {
		await this.opts.onSubmit(value || undefined);
		this.close();
	}
}

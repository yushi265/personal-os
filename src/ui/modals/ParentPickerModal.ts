import { FuzzySuggestModal, type App, type FuzzyMatch } from "obsidian";
import type { Entity } from "../../domain/entity";
import type { IndexStore } from "../../infra/IndexStore";
import { t } from "../../i18n/ja";

/** リストに含める特殊項目: 「Goalなしにする」/「Projectなしにする」を表す */
const NONE = Symbol("none");
type PickerItem = Entity | typeof NONE;

export interface ParentPickerModalOptions {
	store: IndexStore;
	/** 選択対象のentity type("goal" or "project")。EntitySwitcherModal.tsのFuzzySuggestModal継承パターンを踏襲する */
	parentType: "goal" | "project";
	onChoose: (path: string | undefined) => void;
}

/**
 * 一覧行の⋮メニュー「Goalを変更…」/「Projectを変更…」から起動するpickerモーダル(design-ui-first.md追補)。
 * ParentCell(詳細画面のドロップダウン)が使えない場面(一覧行からの再割り当て)向けの代替導線。
 * archived除外。先頭に「(Goal|Project)なしにする」を追加し、親を外す操作も同じ導線でできるようにする。
 */
export class ParentPickerModal extends FuzzySuggestModal<PickerItem> {
	constructor(
		app: App,
		private opts: ParentPickerModalOptions
	) {
		super(app);
		this.setPlaceholder(
			opts.parentType === "goal" ? t("modal.parentPicker.placeholderGoal") : t("modal.parentPicker.placeholderProject")
		);
	}

	getItems(): PickerItem[] {
		const list = this.opts.store.listByType(this.opts.parentType).filter((e) => e.status !== "archived");
		return [NONE, ...list];
	}

	getItemText(item: PickerItem): string {
		if (item === NONE) {
			return this.opts.parentType === "goal" ? t("modal.parentPicker.noneGoal") : t("modal.parentPicker.noneProject");
		}
		return item.title;
	}

	renderSuggestion(match: FuzzyMatch<PickerItem>, el: HTMLElement): void {
		const item = match.item;
		if (item === NONE) {
			el.addClass("pos-entity-switcher-item");
			el.createDiv({ cls: "pos-entity-switcher-title", text: this.getItemText(item) });
			return;
		}
		el.addClass("pos-entity-switcher-item");
		const titleRow = el.createDiv({ cls: "pos-entity-switcher-title-row" });
		titleRow.createSpan({ cls: "pos-entity-switcher-type-badge", text: item.type });
		titleRow.createSpan({ cls: "pos-entity-switcher-title", text: item.title });
		el.createDiv({ cls: "pos-entity-switcher-status", text: item.status });
	}

	onChooseItem(item: PickerItem): void {
		this.opts.onChoose(item === NONE ? undefined : item.path);
	}
}

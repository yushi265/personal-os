import { FuzzySuggestModal, type App, type FuzzyMatch } from "obsidian";
import type { Entity } from "../../domain/entity";
import type { IndexStore } from "../../infra/IndexStore";
import { t } from "../../i18n/ja";

/** リストに含める特殊項目: 「Projectなしにする」を表す */
const NONE = Symbol("none");
type PickerItem = Entity | typeof NONE;

export interface ParentPickerModalOptions {
	store: IndexStore;
	onChoose: (path: string | undefined) => void;
}

/**
 * 一覧行の⋮メニュー「Projectを変更…」から起動するpickerモーダル(design-ui-first.md追補)。
 * ParentCell(詳細画面のドロップダウン)が使えない場面(一覧行からの再割り当て)向けの代替導線。
 * ticket→projectの親変更のみが対象(Goal概念の廃止、design-remove-goal.md G2により、projectには親が無い)。
 * archived除外。先頭に「Projectなしにする」を追加し、親を外す操作も同じ導線でできるようにする。
 */
export class ParentPickerModal extends FuzzySuggestModal<PickerItem> {
	constructor(
		app: App,
		private opts: ParentPickerModalOptions
	) {
		super(app);
		this.setPlaceholder(t("modal.parentPicker.placeholderProject"));
	}

	getItems(): PickerItem[] {
		const list = this.opts.store.listByType("project").filter((e) => e.status !== "archived");
		return [NONE, ...list];
	}

	getItemText(item: PickerItem): string {
		if (item === NONE) return t("modal.parentPicker.noneProject");
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

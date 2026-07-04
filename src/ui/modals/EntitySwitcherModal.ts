import { FuzzySuggestModal, type App, type FuzzyMatch } from "obsidian";
import type { Entity } from "../../domain/entity";
import type { IndexStore } from "../../infra/IndexStore";
import { t } from "../../i18n/ja";

export interface EntitySwitcherModalOptions {
	store: IndexStore;
	onChooseProject: (path: string) => void;
	onChooseTicket: (path: string) => void;
	onChooseGoal: (path: string) => void;
}

/**
 * goal/project/ticket向けのクイックスイッチャー(Phase U2)。
 * Obsidianネイティブのクイックスイッチャーと同じ見た目・あいまい検索をFuzzySuggestModal継承で得る。
 * archived除外。いずれのtypeも選択時は対応する詳細画面へ遷移する(呼び出し元がonChooseGoal/onChooseProject/onChooseTicketを実装する)。
 */
export class EntitySwitcherModal extends FuzzySuggestModal<Entity> {
	constructor(
		app: App,
		private opts: EntitySwitcherModalOptions
	) {
		super(app);
		this.setPlaceholder(t("modal.entitySwitcher.placeholder"));
	}

	getItems(): Entity[] {
		const projects = this.opts.store.listByType("project").filter((e) => e.status !== "archived");
		const tickets = this.opts.store.listByType("ticket").filter((e) => e.status !== "archived");
		const goals = this.opts.store.listByType("goal").filter((e) => e.status !== "archived");
		return [...projects, ...tickets, ...goals];
	}

	getItemText(item: Entity): string {
		return item.title;
	}

	renderSuggestion(match: FuzzyMatch<Entity>, el: HTMLElement): void {
		const item = match.item;
		el.addClass("pos-entity-switcher-item");
		const titleRow = el.createDiv({ cls: "pos-entity-switcher-title-row" });
		titleRow.createSpan({ cls: "pos-entity-switcher-type-badge", text: item.type });
		titleRow.createSpan({ cls: "pos-entity-switcher-title", text: item.title });
		el.createDiv({ cls: "pos-entity-switcher-status", text: item.status });
	}

	onChooseItem(item: Entity): void {
		if (item.type === "project") this.opts.onChooseProject(item.path);
		else if (item.type === "ticket") this.opts.onChooseTicket(item.path);
		else this.opts.onChooseGoal(item.path);
	}
}

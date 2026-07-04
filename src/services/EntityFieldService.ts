import {
	FORBIDDEN_TITLE_CHARS,
	PRIORITIES,
	REVIEW_CYCLES,
	validStatusesOf,
	type Entity,
	type Priority,
	type ReviewCycle,
} from "../domain/entity";
import type { ActivityLogger } from "../infra/types";
import type { IndexStore } from "../infra/IndexStore";
import type { VaultRepository } from "../infra/VaultRepository";
import { t } from "../i18n/ja";

export type EntityFieldKey =
	| "status"
	| "priority"
	| "due"
	| "start"
	| "reviewCycle"
	| "goal"
	| "project"
	| "title"
	| "tags"
	| "labels"
	| "blockers"
	| "order";

export type EntityFieldValue = string | string[] | number | undefined;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ManageViewのインラインセル編集とPreview詳細編集の両方から呼ばれる、
 * フィールド単位のバリデーション+書き込み+ActivityLog記録の集約点(design-ui-first.md §2.2)。
 * statusはEntityService.changeStatus()が既にライフサイクル操作として扱っているため、
 * ここでのstatus対応は「万一呼ばれた場合」の防御であり、UIからはEntityService経由を正とする。
 */
export class EntityFieldService {
	constructor(
		private repo: VaultRepository,
		private store: IndexStore,
		private activityLog: ActivityLogger
	) {}

	/** 単一フィールドの検証+書き込み+ActivityLog記録。titleのみrenameFile経由に分岐する */
	async updateField(path: string, key: EntityFieldKey, value: EntityFieldValue): Promise<void> {
		const entity = this.store.get(path);
		if (!entity) throw new Error(`Entity not found: ${path}`);

		this.validate(entity, key, value);

		if (key === "title") {
			await this.renameTitle(entity, value as string);
			return;
		}

		const old = this.currentValueOf(entity, key);
		await this.repo.updateFrontmatter(path, (fm) => this.applyToFrontmatter(fm, key, value));
		await this.activityLog.log("update", `${entity.title}: ${key} ${this.display(old)} → ${this.display(value)}`);
	}

	/**
	 * D&D並び替え専用の軽量パス(design-reorder-and-notes.md A-2)。
	 * 高頻度に発火するため、updateFieldの汎用validate/ActivityLog記録は通さずrepoへ直接書き込む。
	 */
	async reorder(path: string, newOrder: number): Promise<void> {
		await this.repo.updateFrontmatter(path, (fm) => {
			fm.order = newOrder;
		});
	}

	/**
	 * Goal跨ぎドロップ(design-reorder-and-notes.md A-4): goal付け替えとorder更新を1回のfrontmatter書き込みにまとめる。
	 */
	async reorderAndReassignGoal(path: string, newOrder: number, newGoal: string | undefined): Promise<void> {
		const entity = this.store.get(path);
		if (!entity) throw new Error(`Entity not found: ${path}`);
		await this.applyMultiple(path, (fm) => {
			fm.order = newOrder;
			if (newGoal === undefined) delete fm.goal;
			else {
				const target = this.store.get(newGoal);
				fm.goal = `[[${target?.title ?? newGoal}]]`;
			}
		});
		await this.activityLog.log("update", `${entity.title}: goal → ${newGoal ? (this.store.get(newGoal)?.title ?? newGoal) : t("manage.field.unset")}`);
	}

	/** 複数frontmatterフィールドを1回のvault書き込みでまとめて更新する内部ヘルパー */
	private async applyMultiple(path: string, fn: (fm: Record<string, unknown>) => void): Promise<void> {
		await this.repo.updateFrontmatter(path, fn);
	}

	private async renameTitle(entity: Entity, newTitle: string): Promise<void> {
		const safe = newTitle.replace(FORBIDDEN_TITLE_CHARS, "-").trim();
		if (!safe) throw new Error(t("manage.field.titleRequired"));
		const newPath = await this.repo.renameNote(entity.path, safe);
		await this.activityLog.log("update", `${entity.title} → ${safe}（rename）`);
		void newPath; // rename後のIndexStore反映はmain.tsのvault "rename"購読(Indexer.handleRename)に乗るため、ここでは待ち合わせのみ
	}

	// §2.2.1 バリデーション表
	private validate(entity: Entity, key: EntityFieldKey, value: EntityFieldValue): void {
		switch (key) {
			case "status": {
				const validStatuses = validStatusesOf(entity.type);
				if (validStatuses && !validStatuses.includes(String(value ?? ""))) {
					throw new Error(t("manage.field.invalidStatus"));
				}
				break;
			}
			case "priority": {
				if (value !== undefined && value !== "" && !PRIORITIES.includes(value as Priority)) {
					throw new Error(t("manage.field.invalidPriority"));
				}
				break;
			}
			case "due":
			case "start": {
				if (value !== undefined && value !== "" && !DATE_PATTERN.test(String(value))) {
					throw new Error(t("manage.field.invalidDate"));
				}
				break;
			}
			case "reviewCycle": {
				if (value !== undefined && value !== "" && !REVIEW_CYCLES.includes(value as ReviewCycle)) {
					throw new Error(t("manage.field.invalidReviewCycle"));
				}
				break;
			}
			case "goal":
			case "project": {
				if (value === undefined || value === "") break;
				const target = this.store.get(String(value));
				if (!target || target.type !== key) {
					throw new Error(t("manage.field.invalidParent"));
				}
				break;
			}
			case "title": {
				if (typeof value !== "string" || value.trim() === "") {
					throw new Error(t("manage.field.titleRequired"));
				}
				break;
			}
			case "tags":
			case "labels":
			case "blockers": {
				if (!Array.isArray(value)) {
					throw new Error(t("manage.field.invalidArray"));
				}
				break;
			}
			case "order": {
				if (value !== undefined && value !== "" && typeof value !== "number") {
					throw new Error(t("manage.field.invalidOrder"));
				}
				break;
			}
		}
	}

	// goal/project は wikilink化して書き込む(EntityService.createと同じ変換規則)。tags/labels/blockersは配列を丸ごと置換(空配列可)
	private applyToFrontmatter(fm: Record<string, unknown>, key: EntityFieldKey, value: EntityFieldValue): void {
		switch (key) {
			case "status":
				fm.status = value;
				break;
			case "priority":
				if (value === undefined || value === "") delete fm.priority;
				else fm.priority = value;
				break;
			case "due":
				if (value === undefined || value === "") delete fm.due;
				else fm.due = value;
				break;
			case "start":
				if (value === undefined || value === "") delete fm.start;
				else fm.start = value;
				break;
			case "reviewCycle":
				if (value === undefined || value === "") delete fm.review_cycle;
				else fm.review_cycle = value;
				break;
			case "goal":
			case "project": {
				if (value === undefined || value === "") {
					delete fm[key];
					break;
				}
				const target = this.store.get(String(value));
				fm[key] = `[[${target?.title ?? String(value)}]]`;
				break;
			}
			case "tags":
			case "labels":
			case "blockers":
				fm[key] = value as string[];
				break;
			case "order":
				if (value === undefined || value === "") delete fm.order;
				else fm.order = value as number;
				break;
			case "title":
				break; // renameTitle側で処理済み(ここには到達しない)
		}
	}

	private currentValueOf(entity: Entity, key: EntityFieldKey): EntityFieldValue {
		switch (key) {
			case "status":
				return entity.status;
			case "priority":
				return entity.priority;
			case "due":
				return entity.due;
			case "start":
				return entity.start;
			case "reviewCycle":
				return entity.reviewCycle;
			case "goal":
				return entity.goal;
			case "project":
				return entity.project;
			case "tags":
				return entity.tags;
			case "labels":
				return entity.labels;
			case "blockers":
				return entity.blockers;
			case "order":
				return entity.order;
			default:
				return undefined;
		}
	}

	private display(value: EntityFieldValue): string {
		if (value === undefined || value === "") return t("manage.field.unset");
		if (Array.isArray(value)) return value.join(", ");
		return String(value);
	}
}

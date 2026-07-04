import { Notice, type TFile } from "obsidian";
import { FORBIDDEN_TITLE_CHARS, defaultStatusOf, validStatusesOf, type EntityType, type Priority } from "../domain/entity";
import { today } from "../domain/date";
import type { ActivityLogger, ProgressRecalculator } from "../infra/types";
import type { IndexStore } from "../infra/IndexStore";
import type { VaultRepository } from "../infra/VaultRepository";
import type { POSSettings } from "../settings/settings";
import { t } from "../i18n/ja";

export interface CreateEntityInput {
	type: EntityType;
	title: string;
	goal?: string; // Goalノートのpath
	project?: string;
	priority?: Priority;
	due?: string;
	templateName?: string; // Templates/内のファイル名
}

function buildFrontmatterBlock(fm: Record<string, unknown>): string {
	const lines = Object.entries(fm)
		.filter(([, v]) => v !== undefined && v !== null)
		.map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : v}`);
	return `---\n${lines.join("\n")}\n---\n`;
}

export class EntityService {
	constructor(
		private repo: VaultRepository,
		private store: IndexStore,
		private settings: POSSettings,
		private activityLog?: ActivityLogger,
		private progressService?: ProgressRecalculator
	) {}

	/** 作成: テンプレート解決→ノート生成→ログ→インデックス反映 */
	async create(input: CreateEntityInput): Promise<TFile> {
		// ① タイトル検証
		const safeTitle = input.title.replace(FORBIDDEN_TITLE_CHARS, "-");

		// ② テンプレート読込+プレースホルダ置換
		const templateBody = input.templateName
			? await this.repo.readBody(`${this.templatesFolder()}/${input.templateName}`)
			: "";
		const goalTitle = input.goal ? (this.store.get(input.goal)?.title ?? input.goal) : undefined;
		const projectTitle = input.project ? (this.store.get(input.project)?.title ?? input.project) : undefined;
		const replacedBody = templateBody
			.replaceAll("{{title}}", safeTitle)
			.replaceAll("{{date}}", today())
			.replaceAll("{{goal}}", goalTitle ?? "")
			.replaceAll("{{project}}", projectTitle ?? "");

		// ③ frontmatter組み立て(goal/projectはwikilink化)
		const fm: Record<string, unknown> = {
			type: input.type,
			status: defaultStatusOf(input.type),
		};
		if (input.priority) fm.priority = input.priority;
		if (input.due) fm.due = input.due;
		if (goalTitle) fm.goal = `[[${goalTitle}]]`;
		if (projectTitle) fm.project = `[[${projectTitle}]]`;

		const body = `${buildFrontmatterBlock(fm)}\n${replacedBody}`;

		// ④ ノート作成
		const file = await this.repo.createEntityNote(input.type, safeTitle, body);

		// ⑤ ログ
		if (this.activityLog) {
			await this.activityLog.log("create", `${input.type}「${safeTitle}」を作成`);
		}

		// ⑥ 生成したTFileを返す
		return file;
	}

	/** status変更(Kanban D&D・メニューから) */
	async changeStatus(path: string, next: string): Promise<void> {
		const entity = this.store.get(path);
		if (!entity) throw new Error(`Entity not found: ${path}`);

		const validStatuses = validStatusesOf(entity.type);
		if (validStatuses && !validStatuses.includes(next)) {
			throw new Error(`不正なstatus: ${next}`);
		}

		const old = entity.status;
		await this.repo.updateFrontmatter(path, (fm) => {
			fm.status = next;
		});

		if (next === "done" && entity.type === "ticket" && this.progressService) {
			await this.progressService.recalcAncestors(path);
		}

		if (this.activityLog) {
			await this.activityLog.log("status", `${entity.title}: ${old} → ${next}`);
		}
	}

	/** アーカイブ。Undo用に移動後のpathを返す(元path/元statusは呼び出し側がUndo Notice発行時に保持する) */
	async archive(path: string): Promise<string> {
		const entity = this.store.get(path);
		if (!entity) return path;

		// ① fm更新
		await this.repo.updateFrontmatter(path, (fm) => {
			fm.status = "archived";
			fm.archived_at = today();
		});

		// ② 移動(失敗時はNoticeのみで継続。①は維持され再実行で回復可能)
		let newPath = path;
		try {
			newPath = await this.repo.moveToArchive(path);
		} catch {
			new Notice(t("E005"));
		}

		// ③ ログ
		if (this.activityLog) {
			await this.activityLog.log("archive", `${entity.title} をアーカイブ`);
		}

		return newPath;
	}

	/** Archive Undo: statusを元に戻し、元のpathへ移動し直す */
	async restoreFromArchive(currentPath: string, originalPath: string, originalStatus: string): Promise<void> {
		await this.repo.updateFrontmatter(currentPath, (fm) => {
			fm.status = originalStatus;
			delete fm.archived_at;
		});
		try {
			await this.repo.moveToPath(currentPath, originalPath);
		} catch {
			new Notice(t("E005"));
		}
	}

	/** 削除(vault.trash) */
	async delete(path: string): Promise<void> {
		await this.repo.trash(path);
	}

	private templatesFolder(): string {
		return `${this.settings.rootDirectory}/${this.settings.folders.templates}`;
	}
}

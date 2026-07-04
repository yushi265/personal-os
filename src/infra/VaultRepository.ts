import { TFile, type App } from "obsidian";
import type { EntityType } from "../domain/entity";
import type { POSSettings } from "../settings/settings";
import type { SelfWriteGuard } from "./SelfWriteGuard";

export type EditLineResult = "ok" | "line-mismatch" | "not-found";

/**
 * 全ファイルI/Oの唯一の窓口。Services層はObsidian APIを直接触らない。
 */
export class VaultRepository {
	constructor(
		private app: App,
		private settings: POSSettings,
		private selfWriteGuard: SelfWriteGuard
	) {}

	// ---- 参照 ----

	isUnderRoot(path: string): boolean {
		const root = this.settings.rootDirectory;
		return path === root || path.startsWith(`${root}/`);
	}

	getEntityFolder(type: EntityType): string {
		const root = this.settings.rootDirectory;
		const folders = this.settings.folders;
		switch (type) {
			case "goal":
				return `${root}/${folders.goals}`;
			case "project":
				return `${root}/${folders.projects}`;
			case "ticket":
				return `${root}/${folders.tickets}`;
			case "inbox":
				return `${root}/${folders.inbox}`;
			case "review":
				return `${root}/${folders.reviews}`;
			case "resource":
				return `${root}/${folders.logs}`;
		}
	}

	getFile(path: string): TFile | null {
		const af = this.app.vault.getAbstractFileByPath(path);
		return af instanceof TFile ? af : null;
	}

	async readBody(path: string): Promise<string> {
		const file = this.getFile(path);
		if (!file) return "";
		return this.app.vault.cachedRead(file);
	}

	// ---- 作成 ----

	/** テンプレート適用済み本文でノート作成。同名時は " 1" サフィックスで回避 */
	async createEntityNote(type: EntityType, title: string, body: string): Promise<TFile> {
		const folder = this.getEntityFolder(type);
		await this.ensureFolder(folder);

		let path = `${folder}/${title}.md`;
		let suffix = 1;
		while (this.app.vault.getAbstractFileByPath(path)) {
			path = `${folder}/${title} ${suffix}.md`;
			suffix++;
		}

		this.selfWriteGuard.markWrite(path);
		return this.app.vault.create(path, body);
	}

	// ---- 更新 ----

	/** frontmatter更新。fn内でfmを直接書き換える */
	async updateFrontmatter(path: string, fn: (fm: Record<string, unknown>) => void): Promise<void> {
		const file = this.getFile(path);
		if (!file) return;
		this.selfWriteGuard.markWrite(path);
		await this.app.fileManager.processFrontMatter(file, fn);
	}

	/** 本文のアトミック編集(vault.process) */
	async processBody(path: string, fn: (body: string) => string): Promise<void> {
		const file = this.getFile(path);
		if (!file) return;
		this.selfWriteGuard.markWrite(path);
		await this.app.vault.process(file, fn);
	}

	/**
	 * 指定行の置換/削除。行番号ズレ検出のため期待行内容を照合する。
	 * expected不一致時は本文全行から完全一致行を再検索し、1件のみ一致すれば採用する。
	 * next が null の場合は行削除。
	 */
	async editLine(path: string, line: number, expected: string, next: string | null): Promise<EditLineResult> {
		const file = this.getFile(path);
		if (!file) return "not-found";

		let result: EditLineResult = "ok";
		this.selfWriteGuard.markWrite(path);
		await this.app.vault.process(file, (data) => {
			const lines = data.split("\n");

			if (lines[line] === expected) {
				if (next === null) lines.splice(line, 1);
				else lines[line] = next;
				result = "ok";
				return lines.join("\n");
			}

			const matches = lines.reduce<number[]>((acc, l, i) => {
				if (l === expected) acc.push(i);
				return acc;
			}, []);

			if (matches.length === 1) {
				const idx = matches[0];
				if (next === null) lines.splice(idx, 1);
				else lines[idx] = next;
				result = "ok";
				return lines.join("\n");
			}

			result = "line-mismatch";
			return data;
		});
		return result;
	}

	// ---- 移動/削除 ----

	/** fileManager.renameFile。Archive/内で同名衝突時はサフィックス */
	async moveToArchive(path: string): Promise<void> {
		const file = this.getFile(path);
		if (!file) return;

		const archiveFolder = `${this.settings.rootDirectory}/${this.settings.folders.archive}`;
		await this.ensureFolder(archiveFolder);

		let target = `${archiveFolder}/${file.name}`;
		let suffix = 1;
		while (this.app.vault.getAbstractFileByPath(target)) {
			target = `${archiveFolder}/${file.basename} ${suffix}.${file.extension}`;
			suffix++;
		}

		this.selfWriteGuard.markWrite(path);
		this.selfWriteGuard.markWrite(target);
		await this.app.fileManager.renameFile(file, target);
	}

	/** fileManager.renameFile で任意フォルダへ移動する(Promote等)。同名衝突時はサフィックス。移動後のpathを返す */
	async moveToFolder(path: string, folder: string): Promise<string> {
		const file = this.getFile(path);
		if (!file) throw new Error(`File not found: ${path}`);

		await this.ensureFolder(folder);

		let target = `${folder}/${file.name}`;
		let suffix = 1;
		while (this.app.vault.getAbstractFileByPath(target)) {
			target = `${folder}/${file.basename} ${suffix}.${file.extension}`;
			suffix++;
		}

		this.selfWriteGuard.markWrite(path);
		this.selfWriteGuard.markWrite(target);
		await this.app.fileManager.renameFile(file, target);
		return target;
	}

	/** システムゴミ箱(vault.trash) */
	async trash(path: string): Promise<void> {
		const file = this.getFile(path);
		if (!file) return;
		this.selfWriteGuard.markWrite(path);
		await this.app.vault.trash(file, true);
	}

	/** 既存ファイルへ追記、無ければinitialContent+lineで新規作成(ActivityLog用) */
	async appendOrCreate(path: string, line: string, initialContent: string): Promise<void> {
		const file = this.getFile(path);
		if (file) {
			this.selfWriteGuard.markWrite(path);
			await this.app.vault.process(file, (data) => data + line);
			return;
		}

		const folder = path.substring(0, path.lastIndexOf("/"));
		if (folder) await this.ensureFolder(folder);
		this.selfWriteGuard.markWrite(path);
		await this.app.vault.create(path, initialContent + line);
	}

	// ---- 内部ヘルパー ----

	private async ensureFolder(path: string): Promise<void> {
		if (this.app.vault.getAbstractFileByPath(path)) return;
		const segments = path.split("/");
		let current = "";
		for (const seg of segments) {
			current = current ? `${current}/${seg}` : seg;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				try {
					await this.app.vault.createFolder(current);
				} catch {
					// 並行作成等で既に存在する場合は無視
				}
			}
		}
	}
}

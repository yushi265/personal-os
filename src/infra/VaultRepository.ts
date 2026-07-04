import { TFile, type App } from "obsidian";
import type { EntityType } from "../domain/entity";
import type { POSSettings } from "../settings/settings";

export type EditLineResult = "ok" | "line-mismatch" | "not-found";

/**
 * 全ファイルI/Oの唯一の窓口。Services層はObsidian APIを直接触らない。
 * SelfWriteGuardは持たない: reindex抑制はprogress書き戻し(ProgressService)専用の関心事であり、
 * ここで一律markWriteすると他プラグイン書き込み由来のindex-updatedまで揉み消してしまう
 * (design.md §4.1 = progress無限ループ防止のみが目的)。
 */
export class VaultRepository {
	constructor(
		private app: App,
		private settings: POSSettings
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

		return this.app.vault.create(path, body);
	}

	/** 指定パスへ厳密にノートを作成する(Reviewノート等、呼び出し側で一意なパスを決めるケース用)。既存ファイルがあれば例外 */
	async createNoteAt(path: string, body: string): Promise<TFile> {
		const folder = path.substring(0, path.lastIndexOf("/"));
		if (folder) await this.ensureFolder(folder);
		return this.app.vault.create(path, body);
	}

	// ---- 更新 ----

	/** frontmatter更新。fn内でfmを直接書き換える */
	async updateFrontmatter(path: string, fn: (fm: Record<string, unknown>) => void): Promise<void> {
		const file = this.getFile(path);
		if (!file) return;
		await this.app.fileManager.processFrontMatter(file, fn);
	}

	/** 本文のアトミック編集(vault.process) */
	async processBody(path: string, fn: (body: string) => string): Promise<void> {
		const file = this.getFile(path);
		if (!file) return;
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

	/** fileManager.renameFile。Archive/内で同名衝突時はサフィックス。Undo用に移動後のpathを返す */
	async moveToArchive(path: string): Promise<string> {
		const file = this.getFile(path);
		if (!file) return path;

		const archiveFolder = `${this.settings.rootDirectory}/${this.settings.folders.archive}`;
		await this.ensureFolder(archiveFolder);

		let target = `${archiveFolder}/${file.name}`;
		let suffix = 1;
		while (this.app.vault.getAbstractFileByPath(target)) {
			target = `${archiveFolder}/${file.basename} ${suffix}.${file.extension}`;
			suffix++;
		}

		await this.app.fileManager.renameFile(file, target);
		return target;
	}

	/**
	 * fileManager.renameFile で任意の完全パスへ移動する(Archive Undo等、呼び出し元が元パスを厳密指定するケース用)。
	 * 同名衝突時はサフィックス。moveToFolder/moveToArchiveと異なり移動先のファイル名も呼び出し側が指定する。
	 */
	async moveToPath(path: string, targetPath: string): Promise<string> {
		const file = this.getFile(path);
		if (!file) throw new Error(`File not found: ${path}`);

		const folder = targetPath.substring(0, targetPath.lastIndexOf("/"));
		if (folder) await this.ensureFolder(folder);

		const ext = file.extension;
		const base = targetPath.slice(0, targetPath.length - ext.length - 1);
		let target = targetPath;
		let suffix = 1;
		while (this.app.vault.getAbstractFileByPath(target) && target !== path) {
			target = `${base} ${suffix}.${ext}`;
			suffix++;
		}
		if (target === path) return path;

		await this.app.fileManager.renameFile(file, target);
		return target;
	}

	/** Undo用: 削除(trash)前に退避しておいた全文からノートを再作成する */
	async restoreFile(path: string, content: string): Promise<TFile> {
		const folder = path.substring(0, path.lastIndexOf("/"));
		if (folder) await this.ensureFolder(folder);
		return this.app.vault.create(path, content);
	}

	/** 同一フォルダ内でのファイル名変更(rename)。フォルダ跨ぎのmoveToFolder/moveToArchiveとは別メソッドとする */
	async renameNote(path: string, newTitle: string): Promise<string> {
		const file = this.getFile(path);
		if (!file) throw new Error(`File not found: ${path}`);

		const folder = file.parent?.path ?? "";
		let target = folder ? `${folder}/${newTitle}.${file.extension}` : `${newTitle}.${file.extension}`;
		let suffix = 1;
		while (this.app.vault.getAbstractFileByPath(target) && target !== path) {
			target = folder ? `${folder}/${newTitle} ${suffix}.${file.extension}` : `${newTitle} ${suffix}.${file.extension}`;
			suffix++;
		}
		if (target === path) return path; // 変更なし

		await this.app.fileManager.renameFile(file, target);
		return target;
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

		await this.app.fileManager.renameFile(file, target);
		return target;
	}

	/** システムゴミ箱(vault.trash) */
	async trash(path: string): Promise<void> {
		const file = this.getFile(path);
		if (!file) return;
		await this.app.vault.trash(file, true);
	}

	/** 既存ファイルへ追記、無ければinitialContent+lineで新規作成(ActivityLog用) */
	async appendOrCreate(path: string, line: string, initialContent: string): Promise<void> {
		const file = this.getFile(path);
		if (file) {
			await this.app.vault.process(file, (data) => data + line);
			return;
		}

		const folder = path.substring(0, path.lastIndexOf("/"));
		if (folder) await this.ensureFolder(folder);
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

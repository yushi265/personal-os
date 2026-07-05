import type { App, TFile } from "obsidian";
import { parseEntity, type EntityType } from "../domain/entity";
import { countCommentHeadings, type HeadingLike } from "../domain/comment";
import type { POSEventBus } from "./EventBus";
import type { IndexStore } from "./IndexStore";
import type { SelfWriteGuard } from "./SelfWriteGuard";
import type { ProgressRecalculator, TodoProvider } from "./types";
import type { VaultRepository } from "./VaultRepository";

function hasTodos(type: EntityType): boolean {
	return type === "ticket" || type === "project" || type === "inbox";
}

/**
 * インデックス構築のオーケストレータ。
 * DataviewAdapter / ProgressService はPhase 2/3で実装されるため、コンストラクタで
 * optionalに受け取り、未設定ならTodo取得・progress再計算をスキップする。
 */
export class Indexer {
	constructor(
		private app: App,
		private repo: VaultRepository,
		private store: IndexStore,
		private eventBus: POSEventBus,
		private selfWriteGuard: SelfWriteGuard,
		private todoProvider?: TodoProvider,
		private progressService?: ProgressRecalculator
	) {}

	async fullScan(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles().filter((f) => this.repo.isUnderRoot(f.path));
		for (const file of files) {
			await this.reindexFile(file, { silent: true });
		}
		// 2周目: 1周目の時点ではIndexStoreが構築途中で、type-aware解決(resolveLink)が
		// 参照先エンティティのtypeをまだ引けないことがある(同basenameの衝突ケースで特に顕著)。
		// 全エンティティ登録後に同じファイル群を再度reindexすることで、正しいtypeの参照先に解決し直す。
		for (const file of files) {
			await this.reindexFile(file, { silent: true });
		}
		if (this.progressService) await this.progressService.recalcAll();
		this.eventBus.emitEvent("index-updated");
	}

	async reindexFile(file: TFile, opts?: { silent?: boolean }): Promise<void> {
		if (this.selfWriteGuard.isSuppressed(file.path)) return;

		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
		const result = parseEntity({ path: file.path, basename: file.basename }, fm, this.resolveLink(file.path));

		if (result.ok) {
			this.store.upsertEntity(result.entity);
			if (hasTodos(result.entity.type) && this.todoProvider) {
				this.store.setTodos(file.path, await this.todoProvider.getTodos(file.path));
			}
			this.store.setCommentCount(file.path, this.countComments(file));
		} else {
			this.store.addParseError(file.path, result.reason);
		}

		if (this.progressService) await this.progressService.recalcAncestors(file.path);
		if (!opts?.silent) this.eventBus.emitEvent("index-updated", [file.path]);
	}

	async handleRename(file: TFile, oldPath: string): Promise<void> {
		const wasUnderRoot = this.repo.isUnderRoot(oldPath);
		const isUnderRoot = this.repo.isUnderRoot(file.path);

		if (wasUnderRoot && !isUnderRoot) {
			this.store.remove(oldPath);
			this.eventBus.emitEvent("index-updated", [oldPath]);
			return;
		}
		if (!isUnderRoot) return;

		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
		const result = parseEntity({ path: file.path, basename: file.basename }, fm, this.resolveLink(file.path));

		if (result.ok) {
			const todos =
				hasTodos(result.entity.type) && this.todoProvider ? await this.todoProvider.getTodos(file.path) : [];
			this.store.handleRename(oldPath, result.entity, todos);
			this.store.setCommentCount(file.path, this.countComments(file));
		} else {
			this.store.remove(oldPath);
			this.store.addParseError(file.path, result.reason);
		}

		if (this.progressService) await this.progressService.recalcAncestors(file.path);
		this.eventBus.emitEvent("index-updated", [oldPath, file.path]);
	}

	handleDelete(file: TFile): void {
		if (!this.repo.isUnderRoot(file.path)) return;
		this.store.remove(file.path);
		this.eventBus.emitEvent("index-updated", [file.path]);
	}

	/** 本文を読まずmetadataCache.headingsのみから"## Memo"配下の件数を数える(パフォーマンス設計原則) */
	private countComments(file: TFile): number {
		const headings = (this.app.metadataCache.getFileCache(file)?.headings ?? []) as HeadingLike[];
		return countCommentHeadings(headings);
	}

	/**
	 * basename衝突(同名の別typeファイルが存在する)対策のtype-aware解決。
	 * metadataCacheの素の解決結果が期待typeと一致しなければ、IndexStoreから同titleかつ
	 * 期待typeのエンティティを探し直して優先する。見つからなければ従来の解決結果にフォールバックする。
	 */
	private resolveLink(sourcePath: string): (link: string, expectedType?: EntityType) => string | null {
		return (link: string, expectedType?: EntityType) => {
			const dest = this.app.metadataCache.getFirstLinkpathDest(link, sourcePath);
			if (dest && (!expectedType || this.store.get(dest.path)?.type === expectedType)) {
				return dest.path;
			}
			if (expectedType) {
				const byTitle = this.store.listByType(expectedType).find((e) => e.title === link);
				if (byTitle) return byTitle.path;
			}
			return dest ? dest.path : null;
		};
	}
}

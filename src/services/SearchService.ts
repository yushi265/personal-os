import { prepareSimpleSearch } from "obsidian";
import { ENTITY_TYPES, type Entity } from "../domain/entity";
import type { Todo } from "../domain/todo";
import { evaluate, evaluateTodo, parseQuery } from "../domain/query";
import type { IndexStore } from "../infra/IndexStore";
import type { VaultRepository } from "../infra/VaultRepository";

/**
 * Advanced Search(design.md §4.4 / detail-design.md §3.3)。
 * IndexStore全件にparseQuery+evaluateを適用する。全文検索はprepareSimpleSearch+cachedReadで拡張する。
 */
export class SearchService {
	constructor(
		private store: IndexStore,
		private repo: VaultRepository
	) {}

	searchEntities(queryText: string): Entity[] {
		const q = parseQuery(queryText);
		return this.allEntities().filter((e) => evaluate(q, e, (path) => this.store.get(path)?.title));
	}

	searchTodos(queryText: string): Todo[] {
		const q = parseQuery(queryText);
		return this.store.getAllTodos().filter((t) => evaluateTodo(q, t));
	}

	/**
	 * タイトル一致(searchEntities)に加え、q.textがある場合は本文全文検索の拡張を行う。
	 * フィルタ条件は満たすがタイトル不一致のEntityについてのみ本文をcachedReadし、prepareSimpleSearchで照合する。
	 */
	async searchFullText(queryText: string): Promise<Entity[]> {
		const q = parseQuery(queryText);
		const titleMatched = this.searchEntities(queryText);
		if (!q.text) return titleMatched;

		const matcher = prepareSimpleSearch(q.text);
		const matchedPaths = new Set(titleMatched.map((e) => e.path));
		const additional: Entity[] = [];
		for (const e of this.allEntities()) {
			if (matchedPaths.has(e.path)) continue;
			if (!evaluate({ filters: q.filters, text: "" }, e, (path) => this.store.get(path)?.title)) continue;
			const body = await this.repo.readBody(e.path);
			if (matcher(body)) additional.push(e);
		}
		return [...titleMatched, ...additional];
	}

	private allEntities(): Entity[] {
		return ENTITY_TYPES.flatMap((type) => this.store.listByType(type));
	}
}

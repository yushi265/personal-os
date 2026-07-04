import type { Entity, EntityType } from "../domain/entity";
import type { Todo } from "../domain/todo";

/**
 * インメモリインデックス。Obsidianに依存しないため単体テスト可能。
 * key: path
 */
export class IndexStore {
	private entities = new Map<string, Entity>();
	private todos = new Map<string, Todo[]>(); // key: 親ノートpath
	private byType = new Map<EntityType, Set<string>>();
	private childrenOf = new Map<string, Set<string>>(); // 親path → 子pathの集合
	private parentKeysOf = new Map<string, string[]>(); // 逆引き: 子path → 親path[]
	private parseErrors = new Map<string, string>(); // path → エラー理由
	private memoCounts = new Map<string, number>(); // path → "## Memo"配下の有効な日時見出し数(本文読み込みなしの軽量集計)

	// ---- 更新系 ----

	upsertEntity(e: Entity): void {
		this.clearIndexLinks(e.path);
		this.parseErrors.delete(e.path);
		this.entities.set(e.path, e);

		if (!this.byType.has(e.type)) this.byType.set(e.type, new Set());
		this.byType.get(e.type)!.add(e.path);

		const parentKeys: string[] = [];
		if (e.goal) {
			this.addChild(e.goal, e.path);
			parentKeys.push(e.goal);
		}
		if (e.project) {
			this.addChild(e.project, e.path);
			parentKeys.push(e.project);
		}
		this.parentKeysOf.set(e.path, parentKeys);
	}

	setTodos(parentPath: string, todos: Todo[]): void {
		this.todos.set(parentPath, todos);
	}

	setMemoCount(path: string, count: number): void {
		this.memoCounts.set(path, count);
	}

	remove(path: string): void {
		this.clearIndexLinks(path);
		this.entities.delete(path);
		this.todos.delete(path);
		this.parseErrors.delete(path);
		this.memoCounts.delete(path);
	}

	handleRename(oldPath: string, e: Entity, todos: Todo[]): void {
		this.remove(oldPath);
		this.upsertEntity(e);
		this.setTodos(e.path, todos);
	}

	addParseError(path: string, reason: string): void {
		this.clearIndexLinks(path);
		this.entities.delete(path);
		this.todos.delete(path);
		this.memoCounts.delete(path);
		this.parseErrors.set(path, reason);
	}

	// ---- 参照系 ----

	get(path: string): Entity | undefined {
		return this.entities.get(path);
	}

	listByType(type: EntityType): Entity[] {
		const paths = this.byType.get(type) ?? new Set<string>();
		return Array.from(paths)
			.map((p) => this.entities.get(p)!)
			.filter((e): e is Entity => !!e)
			.sort((a, b) => a.title.localeCompare(b.title));
	}

	getChildren(parentPath: string): Entity[] {
		const paths = this.childrenOf.get(parentPath) ?? new Set<string>();
		return Array.from(paths)
			.map((p) => this.entities.get(p))
			.filter((e): e is Entity => !!e);
	}

	getTodos(parentPath: string): Todo[] {
		return this.todos.get(parentPath) ?? [];
	}

	getAllTodos(): Todo[] {
		const all: Todo[] = [];
		for (const list of this.todos.values()) all.push(...list);
		return all;
	}

	getMemoCount(path: string): number {
		return this.memoCounts.get(path) ?? 0;
	}

	getParseErrors(): { path: string; reason: string }[] {
		return Array.from(this.parseErrors.entries()).map(([path, reason]) => ({ path, reason }));
	}

	stats(): { entities: number; todos: number; errors: number } {
		let todoCount = 0;
		for (const list of this.todos.values()) todoCount += list.length;
		return { entities: this.entities.size, todos: todoCount, errors: this.parseErrors.size };
	}

	// ---- 内部ヘルパー ----

	private addChild(parentPath: string, childPath: string): void {
		if (!this.childrenOf.has(parentPath)) this.childrenOf.set(parentPath, new Set());
		this.childrenOf.get(parentPath)!.add(childPath);
	}

	/** byType / childrenOf の当該pathに関する登録のみを解除する(entities/todos/parseErrorsは呼び出し元が制御) */
	private clearIndexLinks(path: string): void {
		const existing = this.entities.get(path);
		if (existing) {
			this.byType.get(existing.type)?.delete(path);
		}
		const parentKeys = this.parentKeysOf.get(path);
		if (parentKeys) {
			for (const parent of parentKeys) {
				this.childrenOf.get(parent)?.delete(path);
			}
		}
		this.parentKeysOf.delete(path);
	}
}

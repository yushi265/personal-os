import { ENTITY_TYPES, type EntityType, type Priority } from "../domain/entity";
import type { BuildTodoLineInput, Todo, TodoPatch } from "../domain/todo";
import type { Comment } from "../domain/comment";
import { today } from "../domain/date";
import { isOverdue, isReviewNeeded, isTodoOverdue } from "../domain/judge";
import type { CreateEntityInput } from "../services/EntityService";
import type { EntityFieldKey, EntityFieldValue } from "../services/EntityFieldService";
import type { PromoteOptions } from "../services/PromoteService";
import { PromoteConflictError } from "../services/PromoteService";
import {
	buildManageRows,
	collectProjectTodos,
	DEFAULT_ENTITY_SORT,
	EMPTY_MANAGE_FILTER,
	type ManageDataPlugin,
} from "../ui/manage/manageData";
import { t } from "../i18n/ja";
import type { ApiDeps, ApiResult } from "./types";

const ok = (body: unknown = { ok: true }): ApiResult => ({ status: 200, body });
const created = (body: unknown): ApiResult => ({ status: 201, body });
const badRequest = (message: string): ApiResult => ({ status: 400, body: { error: message } });
const notFound = (): ApiResult => ({ status: 404, body: { error: t("E102"), code: "E102" } });
const conflict = (code: "E003" | "E004" | "E007"): ApiResult => ({ status: 409, body: { error: t(code), code } });

/**
 * (method, pathname, query, body, deps) → {status, body} の純粋寄りルーター(design-browser-ui.md §5.1)。
 * 実HTTPサーバーを起動せずにVitestでテストできる形にする(§8)。既存Serviceが投げるErrorは
 * このファイルの中でHTTPレスポンスへ変換し、Serviceそのものは通知手段を意識しない(§5.4)。
 */
export const ApiRouter = {
	async handle(method: string, pathname: string, query: Record<string, string>, body: unknown, deps: ApiDeps): Promise<ApiResult> {
		try {
			return await dispatch(method, pathname, query, body, deps);
		} catch (e) {
			console.error(`Personal OS API error: ${method} ${pathname}`, e);
			return { status: 500, body: { error: t("E999"), code: "E999" } };
		}
	},
};

async function dispatch(method: string, pathname: string, query: Record<string, string>, body: unknown, deps: ApiDeps): Promise<ApiResult> {
	if (method === "GET" && pathname === "/api/meta") return handleMeta(deps);
	if (method === "GET" && pathname === "/api/summary") return handleSummary(deps);
	if (method === "GET" && pathname === "/api/entities") return handleListEntities(query, deps);
	if (method === "GET" && pathname === "/api/entity") return handleGetEntity(query, deps);
	if (method === "GET" && pathname === "/api/entity/children") return handleGetChildren(query, deps);
	if (method === "POST" && pathname === "/api/entities") return handleCreateEntity(body, deps);
	if (method === "PATCH" && pathname === "/api/entity/field") return handleUpdateField(query, body, deps);
	if (method === "POST" && pathname === "/api/entity/status") return handleChangeStatus(query, body, deps);
	if (method === "POST" && pathname === "/api/entity/archive") return handleArchive(query, deps);
	if (method === "DELETE" && pathname === "/api/entity") return handleDeleteEntity(query, deps);
	if (method === "POST" && pathname === "/api/entity/promote-todo") return handlePromoteTodo(body, deps);
	if (method === "POST" && pathname === "/api/entity/promote-ticket") return handlePromoteTicket(query, deps);
	if (method === "GET" && pathname === "/api/todos/all") return handleListAllTodos(deps);
	if (method === "GET" && pathname === "/api/todos") return handleListTodos(query, deps);
	if (method === "POST" && pathname === "/api/todos") return handleAddTodo(query, body, deps);
	if (method === "POST" && pathname === "/api/inbox/todo") return handleAddInboxTodo(body, deps);
	if (method === "PATCH" && pathname === "/api/todos/toggle") return handleToggleTodo(body, deps);
	if (method === "PATCH" && pathname === "/api/todos") return handleUpdateTodoInline(body, deps);
	if (method === "DELETE" && pathname === "/api/todos") return handleRemoveTodo(body, deps);
	if (method === "GET" && pathname === "/api/memos") return handleListComments(query, deps);
	if (method === "POST" && pathname === "/api/memos") return handleAddComment(query, body, deps);
	if (method === "PATCH" && pathname === "/api/memos") return handleUpdateComment(query, body, deps);
	if (method === "DELETE" && pathname === "/api/memos") return handleRemoveComment(query, body, deps);
	if (method === "GET" && pathname === "/api/note") return handleGetNote(query, deps);
	if (method === "PUT" && pathname === "/api/note") return handleSaveNote(query, body, deps);
	return notFound();
}

// ---- meta ----

function handleMeta(deps: ApiDeps): ApiResult {
	return ok({ vaultName: deps.getVaultName(), capability: deps.getCapability(), port: deps.getPort() });
}

// ---- summary ----

/**
 * ホーム画面サマリカード用の集計をサーバー側で1回で返す(P3のクライアントN+1解消。design-browser-ui.md §9 P5行)。
 * `src/ui/dashboard/dashboardData.ts`のtodayTodos/overdueTodos集計と同じ判定(judge.ts)を用い、
 * 同じ意味論になるようにする(§8「同じ判断を2箇所に書かない」原則)。
 */
function handleSummary(deps: ApiDeps): ApiResult {
	const now = today();
	const capability = deps.getCapability();
	const entities = [...deps.store.listByType("project"), ...deps.store.listByType("ticket")];

	return ok({
		todayTodos: capability.todoFeatures ? deps.todoService.list({ done: false, dueOn: now }) : [],
		overdueTodos: capability.todoFeatures ? deps.store.getAllTodos().filter((t) => isTodoOverdue(t, now)) : [],
		overdueEntities: entities.filter((e) => isOverdue(e, now)),
		reviewNeededEntities: entities.filter((e) => isReviewNeeded(e, now)),
		activeProjectCount: deps.store.listByType("project").filter((e) => e.status === "active").length,
	});
}

// ---- entities ----

function asManageDataPlugin(deps: ApiDeps): ManageDataPlugin {
	return { store: deps.store };
}

function handleListEntities(query: Record<string, string>, deps: ApiDeps): ApiResult {
	const plugin = asManageDataPlugin(deps);

	const type = query.type;
	if (!type) return badRequest("type is required");
	if (!ENTITY_TYPES.includes(type as EntityType)) return badRequest(`invalid type: ${type}`);

	if (type === "project" || type === "ticket") {
		const rows = buildManageRows(plugin, type, EMPTY_MANAGE_FILTER, DEFAULT_ENTITY_SORT);
		return ok({ entities: rows.map((row) => row.entity) });
	}

	const entities = deps.store.listByType(type as EntityType).filter((e) => e.status !== "archived");
	return ok({ entities });
}

function handleGetEntity(query: Record<string, string>, deps: ApiDeps): ApiResult {
	const path = query.path;
	if (!path) return badRequest("path is required");
	const entity = deps.store.get(path);
	if (!entity) return notFound();
	return ok(entity);
}

function handleGetChildren(query: Record<string, string>, deps: ApiDeps): ApiResult {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();
	return ok({ entities: deps.store.getChildren(path) });
}

async function handleCreateEntity(body: unknown, deps: ApiDeps): Promise<ApiResult> {
	if (!isRecord(body)) return badRequest("invalid body");
	try {
		const file = await deps.entityService.create(body as unknown as CreateEntityInput);
		return created({ path: file.path });
	} catch (e) {
		return badRequest(messageOf(e));
	}
}

async function handleUpdateField(query: Record<string, string>, body: unknown, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();
	if (!isRecord(body) || typeof body.key !== "string") return badRequest("invalid body");

	try {
		await deps.entityFieldService.updateField(path, body.key as EntityFieldKey, body.value as EntityFieldValue);
		return ok();
	} catch (e) {
		return badRequest(messageOf(e));
	}
}

async function handleChangeStatus(query: Record<string, string>, body: unknown, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();
	if (!isRecord(body) || typeof body.next !== "string") return badRequest("invalid body");

	try {
		await deps.entityService.changeStatus(path, body.next);
		return ok();
	} catch (e) {
		return badRequest(messageOf(e));
	}
}

async function handleArchive(query: Record<string, string>, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();

	const newPath = await deps.entityService.archive(path);
	return ok({ path: newPath });
}

async function handleDeleteEntity(query: Record<string, string>, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();

	await deps.entityService.delete(path);
	return ok();
}

// ---- promote ----

async function handlePromoteTodo(body: unknown, deps: ApiDeps): Promise<ApiResult> {
	if (!isRecord(body) || !isRecord(body.todo) || !isRecord(body.options)) return badRequest("invalid body");

	try {
		await deps.promoteService.promoteTodoToTicket(body.todo as unknown as Todo, body.options as unknown as PromoteOptions);
		return ok();
	} catch (e) {
		if (e instanceof PromoteConflictError) return conflict("E004");
		return badRequest(messageOf(e));
	}
}

async function handlePromoteTicket(query: Record<string, string>, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();

	try {
		await deps.promoteService.promoteTicketToProject(path);
		return ok();
	} catch (e) {
		return badRequest(messageOf(e));
	}
}

// ---- todos ----

// プロジェクト横断のTodo一覧(全チケット・全プロジェクト直下)。handleSummaryと同じくtodoFeatures無効時は空を返す。
function handleListAllTodos(deps: ApiDeps): ApiResult {
	if (!deps.getCapability().todoFeatures) return ok({ todos: [] });
	return ok({ todos: deps.store.getAllTodos() });
}

function handleListTodos(query: Record<string, string>, deps: ApiDeps): ApiResult {
	const parent = query.parent;
	if (!parent) return badRequest("parent is required");
	if (!deps.store.get(parent)) return notFound();

	const scope = query.scope === "all" ? "all" : "direct";
	return ok({ todos: collectProjectTodos(deps.store, parent, scope) });
}

async function handleAddTodo(query: Record<string, string>, body: unknown, deps: ApiDeps): Promise<ApiResult> {
	const parent = query.parent;
	if (!parent) return badRequest("parent is required");
	if (!deps.store.get(parent)) return notFound();
	if (!isRecord(body) || typeof body.text !== "string") return badRequest("invalid body");

	await deps.todoService.addToSection(parent, body as unknown as BuildTodoLineInput);
	return created({ ok: true });
}

// Inboxクイックキャプチャ: プロジェクトを選ばずにTodoを追加する(タスク#5)。保存先はTodoService側でinboxノートに固定。
async function handleAddInboxTodo(body: unknown, deps: ApiDeps): Promise<ApiResult> {
	if (!isRecord(body) || typeof body.text !== "string" || body.text.trim() === "") return badRequest("text is required");
	await deps.todoService.quickAdd({
		text: body.text,
		target: "inbox",
		dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
		priority: typeof body.priority === "string" ? (body.priority as Priority) : undefined,
	});
	return created({ ok: true });
}

async function handleToggleTodo(body: unknown, deps: ApiDeps): Promise<ApiResult> {
	if (!isRecord(body)) return badRequest("invalid body");
	const result = await deps.todoService.toggle(body as unknown as Todo);
	return result === "conflict" ? conflict("E003") : ok();
}

async function handleUpdateTodoInline(body: unknown, deps: ApiDeps): Promise<ApiResult> {
	if (!isRecord(body) || !isRecord(body.todo) || !isRecord(body.patch)) return badRequest("invalid body");
	const result = await deps.todoService.updateInline(body.todo as unknown as Todo, body.patch as unknown as TodoPatch);
	return result === "conflict" ? conflict("E003") : ok();
}

async function handleRemoveTodo(body: unknown, deps: ApiDeps): Promise<ApiResult> {
	if (!isRecord(body)) return badRequest("invalid body");
	const result = await deps.todoService.remove(body as unknown as Todo);
	return result === "conflict" ? conflict("E003") : ok();
}

// ---- comments (旧称: memos。design-reorder-and-notes.md B-4によりAPIパスは/api/memosのまま維持) ----

async function handleListComments(query: Record<string, string>, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();
	const memos = await deps.commentService.list(path);
	return ok({ memos });
}

async function handleAddComment(query: Record<string, string>, body: unknown, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();
	if (!isRecord(body) || typeof body.text !== "string") return badRequest("invalid body");

	await deps.commentService.add(path, body.text);
	return created({ ok: true });
}

async function handleUpdateComment(query: Record<string, string>, body: unknown, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();
	if (!isRecord(body) || !isRecord(body.expected) || typeof body.newText !== "string") return badRequest("invalid body");

	const result = await deps.commentService.update(path, body.expected as unknown as Comment, body.newText);
	return result === "conflict" ? conflict("E007") : ok();
}

async function handleRemoveComment(query: Record<string, string>, body: unknown, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();
	if (!isRecord(body) || !isRecord(body.expected)) return badRequest("invalid body");

	const result = await deps.commentService.remove(path, body.expected as unknown as Comment);
	return result === "conflict" ? conflict("E007") : ok();
}

// ---- note ----

async function handleGetNote(query: Record<string, string>, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();
	const text = await deps.noteService.get(path);
	return ok({ text });
}

async function handleSaveNote(query: Record<string, string>, body: unknown, deps: ApiDeps): Promise<ApiResult> {
	const path = query.path;
	if (!path) return badRequest("path is required");
	if (!deps.store.get(path)) return notFound();
	if (!isRecord(body) || typeof body.text !== "string") return badRequest("invalid body");

	await deps.noteService.save(path, body.text);
	return ok();
}

// ---- helpers ----

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function messageOf(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

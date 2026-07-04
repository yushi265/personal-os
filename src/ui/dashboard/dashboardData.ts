import type { Entity } from "../../domain/entity";
import { isBlocked, isOverdue, isReviewNeeded, isTodoOverdue } from "../../domain/judge";
import { today } from "../../domain/date";
import type { Todo } from "../../domain/todo";
import type PersonalOSPlugin from "../../main";

export interface DashboardData {
	todoFeatures: boolean;
	todayTodos: Todo[];
	overdueTodos: Todo[];
	overdueEntities: Entity[];
	activeGoals: Entity[];
	activeProjects: Entity[];
	activeTickets: Entity[];
	reviewNeeded: Entity[];
	blocked: Entity[];
	recentUpdates: Entity[];
	activityLogLines: string[];
	parseErrors: { path: string; reason: string }[];
}

const ACTIVITY_LOG_TAIL_LINES = 8;

function isUnderLogsFolder(path: string, plugin: PersonalOSPlugin): boolean {
	const logsFolder = `${plugin.settings.rootDirectory}/${plugin.settings.folders.logs}`;
	return path === logsFolder || path.startsWith(`${logsFolder}/`);
}

function allEntities(plugin: PersonalOSPlugin): Entity[] {
	return [
		...plugin.store.listByType("goal"),
		...plugin.store.listByType("project"),
		...plugin.store.listByType("ticket"),
	];
}

function computeRecentUpdates(plugin: PersonalOSPlugin): Entity[] {
	const candidates: { entity: Entity; mtime: number }[] = [];
	for (const type of ["goal", "project", "ticket", "review", "resource", "inbox"] as const) {
		for (const entity of plugin.store.listByType(type)) {
			if (isUnderLogsFolder(entity.path, plugin)) continue;
			const file = plugin.repo.getFile(entity.path);
			candidates.push({ entity, mtime: file?.stat.mtime ?? 0 });
		}
	}
	return candidates
		.sort((a, b) => b.mtime - a.mtime)
		.slice(0, plugin.settings.dashboard.recentUpdatesCount)
		.map((c) => c.entity);
}

async function computeActivityLogTail(plugin: PersonalOSPlugin): Promise<string[]> {
	const now = new Date();
	const yyyyMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	const path = `${plugin.settings.rootDirectory}/${plugin.settings.folders.logs}/${yyyyMM}.md`;
	const body = await plugin.repo.readBody(path);
	if (!body) return [];
	const lines = body.split("\n").filter((l) => l.trim().startsWith("- "));
	return lines.slice(-ACTIVITY_LOG_TAIL_LINES);
}

export async function buildDashboardData(plugin: PersonalOSPlugin): Promise<DashboardData> {
	const now = today();
	const entities = allEntities(plugin);
	const todoFeatures = plugin.capability.todoFeatures;

	return {
		todoFeatures,
		todayTodos: todoFeatures ? plugin.todoService.list({ done: false, dueOn: now }) : [],
		overdueTodos: todoFeatures ? plugin.store.getAllTodos().filter((t) => isTodoOverdue(t, now)) : [],
		overdueEntities: entities.filter((e) => isOverdue(e, now)),
		activeGoals: plugin.store.listByType("goal").filter((e) => e.status === "active"),
		activeProjects: plugin.store.listByType("project").filter((e) => e.status === "active"),
		activeTickets: plugin.store.listByType("ticket").filter((e) => e.status === "doing"),
		reviewNeeded: entities.filter((e) => isReviewNeeded(e, now)),
		blocked: entities.filter((e) => isBlocked(e)),
		recentUpdates: computeRecentUpdates(plugin),
		activityLogLines: await computeActivityLogTail(plugin),
		parseErrors: plugin.store.getParseErrors(),
	};
}

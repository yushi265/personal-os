import type { PROJECT_STATUSES, Priority, ReviewCycle, TICKET_STATUSES } from "../domain/entity";

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type WidgetId =
	| "today-todo"
	| "overdue"
	| "active-goals"
	| "active-projects"
	| "active-tickets"
	| "review-needed"
	| "blocked"
	| "recent-updates"
	| "activity-log"
	| "parse-error";

export interface SavedView {
	id: string;
	name: string;
	query: string;
	// "text"/"parent" は Todoタブ専用のソートキー(design-ui-first.md §3.2のManageSortKeyのスーパーセット化)。
	// 旧data.jsonは旧4値のみのため、unionの拡張だけで後方互換が保たれる(§7.5 S-1〜S-4)。
	sort: {
		key: "due" | "priority" | "title" | "progress" | "status" | "text" | "parent" | "manual";
		order: "asc" | "desc";
	};
	viewMode: "list" | "kanban" | "manage";
	// viewMode !== "manage" では無視される。settings層からui層への依存を避けるためManageTab型は再importせずインライン化する。
	tab?: "project" | "ticket" | "todo";
}

export interface POSSettings {
	rootDirectory: string;
	folders: {
		goals: string;
		projects: string;
		tickets: string;
		inbox: string;
		archive: string;
		templates: string;
		reviews: string;
		logs: string;
	};
	dashboard: {
		widgets: { id: WidgetId; visible: boolean }[];
		recentUpdatesCount: number;
	};
	defaultReviewCycle: ReviewCycle;
	defaultPriority: Priority;
	kanbanColumnNames: {
		project: Record<ProjectStatus, string>;
		ticket: Record<TicketStatus, string>;
	};
	language: "ja";
	savedViews: SavedView[];
	server: {
		enabled: boolean;
		port: number;
		token: string;
		notifyOnStart: boolean;
	};
}

export const DEFAULT_SETTINGS: POSSettings = {
	rootDirectory: "PersonalOS",
	folders: {
		goals: "Goals",
		projects: "Projects",
		tickets: "Tickets",
		inbox: "Inbox",
		archive: "Archive",
		templates: "Templates",
		reviews: "Reviews",
		logs: "Logs",
	},
	dashboard: {
		widgets: [
			{ id: "today-todo", visible: true },
			{ id: "overdue", visible: true },
			{ id: "active-goals", visible: true },
			{ id: "active-projects", visible: true },
			{ id: "active-tickets", visible: true },
			{ id: "review-needed", visible: true },
			{ id: "blocked", visible: true },
			{ id: "recent-updates", visible: true },
			{ id: "activity-log", visible: true },
			{ id: "parse-error", visible: true },
		],
		recentUpdatesCount: 10,
	},
	defaultReviewCycle: "weekly",
	defaultPriority: "medium",
	kanbanColumnNames: {
		project: {
			backlog: "Backlog",
			active: "Active",
			waiting: "Waiting",
			review: "Review",
			done: "Done",
			archived: "Archived",
		},
		ticket: {
			backlog: "Backlog",
			ready: "Ready",
			doing: "Doing",
			waiting: "Waiting",
			review: "Review",
			done: "Done",
			archived: "Archived",
		},
	},
	language: "ja",
	savedViews: [],
	server: {
		enabled: false,
		port: 27141,
		token: "",
		notifyOnStart: true,
	},
};

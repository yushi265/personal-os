/**
 * UI文言・エラーコード一覧(詳細設計 §7)。
 * ハードコード禁止。全てのユーザー向け文言はこのファイル経由で取得する。
 */

const MESSAGES = {
	E001: "Personal OS: Tasks / Dataview プラグインが必要です。Todo機能は無効化されています。",
	E002: "", // Noticeなし。ParseErrorWidgetに集約表示
	E003: "ノートが更新されています。再読み込みしました。",
	E004: "元ノートが更新されたため中断しました。再度実行してください。",
	E005: "アーカイブフォルダへの移動に失敗しました(status変更は完了)。",
	E006: "コピーに失敗しました。",

	"ribbon.openDashboard": "Open Personal OS Dashboard",

	"command.createGoal": "Create Goal",
	"command.createProject": "Create Project",
	"command.createTicket": "Create Ticket",
	"command.createTodo": "Create Todo",
	"command.openDashboard": "Open Dashboard",
	"command.refreshIndex": "Refresh Index",

	"notice.dashboardPlaceholder": "Dashboard(未実装: Phase 3で追加予定)",
	"notice.todoAdded": "追加しました",

	"modal.createEntity.title": "新規作成",
	"modal.createEntity.type": "種類",
	"modal.createEntity.titleField": "タイトル",
	"modal.createEntity.titleFieldPlaceholder": "タイトルを入力",
	"modal.createEntity.parent": "親(Goal / Project)",
	"modal.createEntity.priority": "優先度",
	"modal.createEntity.due": "期限",
	"modal.createEntity.template": "テンプレート",
	"modal.createEntity.submit": "作成",
	"modal.createEntity.titleRequired": "タイトルを入力してください。",

	"modal.quickAdd.title": "Todoを追加",
	"modal.quickAdd.text": "本文",
	"modal.quickAdd.textPlaceholder": "やることを入力",
	"modal.quickAdd.textRequired": "本文を入力してください。",
	"modal.quickAdd.target": "保存先",
	"modal.quickAdd.targetInbox": "Inbox",
	"modal.quickAdd.due": "期限",
	"modal.quickAdd.priority": "優先度",
	"modal.quickAdd.submit": "追加",

	"settings.section.folders": "フォルダ",
	"settings.rootDirectory": "Root Directory",
	"settings.folders.goals": "Goals フォルダ名",
	"settings.folders.projects": "Projects フォルダ名",
	"settings.folders.tickets": "Tickets フォルダ名",
	"settings.folders.inbox": "Inbox フォルダ名",
	"settings.folders.archive": "Archive フォルダ名",
	"settings.folders.templates": "Templates フォルダ名",
	"settings.folders.reviews": "Reviews フォルダ名",
	"settings.folders.logs": "Logs フォルダ名",
	"settings.folders.renameNotice": "既存フォルダの自動リネームは行われません。参照先のみ変更されます。",

	"settings.section.dashboard": "Dashboard",
	"settings.dashboard.recentUpdatesCount": "Recent Updates 件数",

	"settings.section.defaults": "デフォルト値",
	"settings.defaultReviewCycle": "Review Cycle",
	"settings.defaultPriority": "Priority",

	"settings.section.kanban": "Kanban",
	"settings.kanban.note": "列名の表示ラベルのみ変更できます(status値は固定です)。",

	"settings.section.capability": "依存プラグイン",
	"settings.capability.dataview": "Dataview",
	"settings.capability.tasks": "Tasks",
	"settings.capability.detected": "検出済み",
	"settings.capability.notDetected": "未検出",
} as const;

export type MessageKey = keyof typeof MESSAGES;

export function t(key: MessageKey): string {
	return MESSAGES[key];
}

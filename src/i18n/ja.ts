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
	"command.openKanban": "Open Kanban",
	"command.refreshIndex": "Refresh Index",
	"command.promoteTodo": "Promote Todo to Ticket",
	"command.promoteTicket": "Promote Ticket to Project",
	"command.archiveEntity": "Archive Entity",

	"notice.todoAdded": "追加しました",
	"promote.failed": "昇格に失敗しました。",

	"dashboard.title": "Personal OS Dashboard",
	"dashboard.refresh": "更新",
	"dashboard.widget.todayTodo": "Today's Todo",
	"dashboard.widget.overdue": "Overdue",
	"dashboard.widget.activeGoals": "Active Goals",
	"dashboard.widget.activeProjects": "Active Projects",
	"dashboard.widget.activeTickets": "Active Tickets",
	"dashboard.widget.reviewNeeded": "Review Needed",
	"dashboard.widget.blocked": "Blocked",
	"dashboard.widget.recentUpdates": "Recent Updates",
	"dashboard.widget.activityLog": "Activity Log",
	"dashboard.widget.parseError": "解析エラー",
	"dashboard.empty.todayTodo": "本日期限のTodoはありません。",
	"dashboard.empty.overdue": "期限超過の項目はありません。",
	"dashboard.empty.active": "該当する項目はありません。",
	"dashboard.empty.reviewNeeded": "レビューが必要な項目はありません。",
	"dashboard.empty.blocked": "ブロック中の項目はありません。",
	"dashboard.empty.recentUpdates": "更新履歴はありません。",
	"dashboard.empty.activityLog": "ログがありません。",
	"dashboard.todoDisabledNotice": "Tasks / Dataviewプラグインが必要です。",

	"preview.title": "Preview",
	"preview.empty": "Entityノートを開いてください。",
	"preview.section.detail": "詳細",
	"preview.section.blockers": "Blockers",
	"preview.section.children": "配下",
	"preview.section.todos": "Todo",
	"preview.field.type": "種類",
	"preview.field.status": "ステータス",
	"preview.field.priority": "優先度",
	"preview.field.progress": "進捗",
	"preview.field.due": "期限",
	"preview.field.goal": "Goal",
	"preview.field.project": "Project",
	"preview.empty.children": "配下のEntityはありません。",
	"preview.empty.todos": "Todoはありません。",

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

	"kanban.title": "Kanban",
	"kanban.modeTicket": "Ticket",
	"kanban.modeProject": "Project",
	"kanban.moveFailed": "移動に失敗しました。",
	"kanban.moveStatus": "ステータスを変更",

	"modal.promoteTodo.title": "TicketへPromote",
	"modal.promoteTodo.newTitle": "新Ticket名",
	"modal.promoteTodo.project": "所属Project",
	"modal.promoteTodo.sourceAction": "元Todoの扱い",
	"modal.promoteTodo.sourceAction.delete": "削除",
	"modal.promoteTodo.sourceAction.complete": "完了にする",
	"modal.promoteTodo.sourceAction.link": "リンク化",
	"modal.promoteTodo.submit": "Promote",

	"modal.promoteTicket.title": "ProjectへPromote",
	"modal.promoteTicket.confirmPrefix": "「",
	"modal.promoteTicket.confirmSuffix": "」をProjectへ昇格しますか?",
	"modal.promoteTicket.submit": "Promote",
} as const;

export type MessageKey = keyof typeof MESSAGES;

export function t(key: MessageKey): string {
	return MESSAGES[key];
}

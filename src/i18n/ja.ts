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
	"preview.field.status": "ステータス",
	"preview.field.priority": "優先度",
	"preview.field.progress": "進捗",
	"preview.field.due": "期限",
	"preview.field.goal": "Goal",
	"preview.field.project": "Project",
	"preview.field.start": "開始日",
	"preview.field.reviewCycle": "レビュー周期",
	"preview.field.lastReviewed": "最終レビュー",
	"preview.empty.children": "配下のEntityはありません。",
	"preview.empty.todos": "Todoはありません。",
	"preview.empty.body": "(本文なし)",
	"preview.section.tags": "Tags",
	"preview.section.labels": "Labels",
	"preview.section.review": "Review",
	"preview.section.unknown": "未知プロパティ",
	"preview.section.body": "本文",
	"preview.action.archive": "Archive",
	"preview.action.promote": "昇格",
	"preview.action.delete": "削除",
	"preview.action.review": "レビュー実施",
	"preview.body.openNote": "ノートで開く",
	"preview.tagChips.placeholder": "追加してEnter...",
	"preview.tagChips.remove": "削除",
	"preview.blockerList.placeholder": "Blockerを追加...",
	"preview.blockerList.add": "追加",
	"preview.blockerList.remove": "削除",
	"preview.todoDisabledNotice": "Tasks / Dataviewプラグインが必要です。Todoセクションは無効化されています。",
	"preview.todo.promote": "昇格",
	"preview.todo.delete": "削除",
	"preview.todoAdd.textPlaceholder": "Todoを追加...",
	"preview.todoAdd.due": "期限",
	"preview.todoAdd.priority": "優先度",
	"preview.todoAdd.submit": "追加",
	"preview.todoAdd.textRequired": "本文を入力してください。",

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
	"settings.capability.installLink": "導入ページを開く",

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

	"modal.review.title": "Review",
	"modal.review.progress": "Progress",
	"modal.review.blocker": "Blocker",
	"modal.review.nextAction": "Next Action",
	"modal.review.decision": "判断",
	"modal.review.decision.continue": "Continue",
	"modal.review.decision.pause": "Pause",
	"modal.review.decision.complete": "Complete",
	"modal.review.submit": "Submit",
	"modal.review.submitted": "レビューを記録しました",

	"command.openReview": "Open Review",
	"command.openSearch": "Open Search",
	"command.openTimeline": "Open Timeline",
	"command.exportAiContext": "Export AI Context",
	"command.exportAiSummary": "Export AI Summary",

	"search.title": "Search",
	"search.savedViewPlaceholder": "Saved View...",
	"search.queryPlaceholder": "type:ticket status:doing priority:high ...",
	"search.run": "検索",
	"search.save": "現在のクエリを保存",
	"search.unnamedView": "無題のView",
	"search.sort.title": "タイトル順",
	"search.sort.due": "期限順",
	"search.sort.priority": "優先度順",
	"search.sort.progress": "進捗順",
	"search.sort.asc": "昇順",
	"search.sort.desc": "降順",
	"search.entities": "Entity",
	"search.todos": "Todo",
	"search.empty": "該当する項目はありません。",

	"timeline.title": "Timeline",
	"timeline.empty": "start/dueを持つProject・Ticketはありません。",

	"manage.field.titleRequired": "タイトルを入力してください。",
	"manage.field.invalidStatus": "不正なstatusです。",
	"manage.field.invalidPriority": "不正なpriorityです。",
	"manage.field.invalidDate": "日付はYYYY-MM-DD形式で入力してください。",
	"manage.field.invalidReviewCycle": "不正なreview_cycleです。",
	"manage.field.invalidParent": "選択した親が存在しないか、種類が一致しません。",
	"manage.field.invalidArray": "不正な値です。",

	"command.openManage": "Open Manage",

	"manage.title": "Manage",
	"manage.todoDisabledNotice": "Tasks / Dataviewプラグインが必要です。Todoタブは無効化されています。",
	"manage.tab.projects": "Projects",
	"manage.tab.tickets": "Tickets",
	"manage.tab.todos": "Todos",
	"manage.filter.keyword": "キーワード検索...",
	"manage.filter.status": "Status",
	"manage.filter.priority": "Priority",
	"manage.filter.parentGoal": "Goal(すべて)",
	"manage.filter.parentProject": "Project(すべて)",
	"manage.filter.period": "期間",
	"manage.filter.period.any": "指定なし",
	"manage.filter.period.today": "今日",
	"manage.filter.period.week": "今週",
	"manage.filter.period.overdue": "Overdue",
	"manage.filter.period.none": "期限なし",
	"manage.filter.tags": "Tags",
	"manage.filter.labels": "Labels",
	"manage.filter.showDone": "完了済みを表示",
	"manage.filter.showArchived": "アーカイブ済みを表示",
	"manage.filter.clear": "クリア",
	"manage.column.title": "Title",
	"manage.column.status": "Status",
	"manage.column.goal": "Goal",
	"manage.column.project": "Project",
	"manage.column.priority": "Priority",
	"manage.column.progress": "Progress",
	"manage.column.due": "Due",
	"manage.column.labels": "Labels",
	"manage.column.done": "✓",
	"manage.column.text": "Text",
	"manage.column.parent": "所属",
	"manage.emptyState": "該当する項目はありません。",
	"manage.newButton": "+ 新規",
	"manage.column.actions": "",
	"manage.field.unset": "(未設定)",
	"manage.updateFailed": "更新に失敗しました。",
	"manage.todoAddFailed": "Todoの追加に失敗しました。",
	"manage.rowMenu.label": "操作",
	"manage.rowMenu.openNote": "ノートを開く",
	"manage.rowMenu.showPreview": "Previewに表示",
	"manage.rowMenu.promote": "昇格",
	"manage.rowMenu.archive": "Archive",
	"manage.rowMenu.delete": "削除",
	"manage.savedView.placeholder": "Saved View...",
	"manage.savedView.namePlaceholder": "名前を入力...",
	"manage.savedView.save": "現在の状態を保存",
	"manage.savedView.unnamed": "無題のView",
	"manage.nav.back": "← 戻る",
	"manage.nav.unknown": "(不明)",
	"manage.nav.unclassified": "未分類",
	"manage.nav.itemsSuffix": "件",
	"manage.nav.newProjectInGoal": "+ 新規プロジェクト",
	"manage.nav.entityGone": "表示していた項目が削除またはアーカイブされたため、上の階層へ戻りました。",
	"manage.nav.placeholderNotice": "この画面は今後のフェーズで実装予定です。",
	"manage.nav.openNote": "ノートを開く",
	"manage.projectDetail.newTicket": "+ 新規チケット",
	"manage.projectDetail.todoScope": "Todoの範囲",
	"manage.projectDetail.scopeDirect": "直下",
	"manage.projectDetail.scopeAll": "すべて",
	"confirmModal.confirm": "実行",
	"confirmModal.cancel": "キャンセル",
} as const;

export type MessageKey = keyof typeof MESSAGES;

export function t(key: MessageKey): string {
	return MESSAGES[key];
}

/** AI Export成功時のNotice文言(文字数埋め込みのためt()とは別関数とする) */
export function aiContextCopiedNotice(charCount: number): string {
	return `AIコンテキストをコピーしました(${charCount}文字)`;
}

/** AI Summary成功時のNotice文言 */
export function aiSummaryCopiedNotice(charCount: number): string {
	return `AIサマリーをコピーしました(${charCount}文字)`;
}

/**
 * parseEntity() の解析エラー理由(ParseErrorWidgetに表示される)。
 * 値埋め込みのため t() 形式ではなく関数として提供する(aiContextCopiedNotice等と同様のパターン)。
 */
export function parseErrorNoType(): string {
	return "type未定義";
}

export function parseErrorInvalidType(value: unknown): string {
	return `不正なtype: ${String(value)}`;
}

export function parseErrorInvalidStatus(status: string): string {
	return `不正なstatus: ${status}`;
}

/** ManageView RowMenuの削除確認メッセージ(タイトル埋め込みのためt()とは別関数とする) */
export function manageDeleteConfirmMessage(title: string): string {
	return `「${title}」を削除しますか?この操作は取り消せません。`;
}

/** 解析エラーノートを開いた場合のPreview表示メッセージ(design-ui-first.md §4.7) */
export function previewParseErrorMessage(reason: string): string {
	return `このノートは解析できません: ${reason}`;
}

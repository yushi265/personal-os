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
	E007: "コメントの内容が変更されています。一覧を最新の状態に更新しました。",
	E101: "トークンが無効です。",
	E102: "見つかりません。",
	E104: "許可されていないOriginからのアクセスです。",
	E999: "予期しないエラーが発生しました。",

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
	"dashboard.viewAll": "すべて見る →",
	"dashboard.stat.activeProjects": "Active Projects",
	"dashboard.stat.doingTickets": "Doing Tickets",
	"dashboard.stat.openTodos": "未完了Todo",
	"dashboard.stat.overdue": "Overdue",
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
	"preview.todo.moveUp": "上へ移動",
	"preview.todo.moveDown": "下へ移動",
	"preview.todo.dragHandle": "ドラッグして並び替え",
	"preview.todoAdd.textPlaceholder": "Todoを追加...",
	"preview.todoAdd.due": "期限",
	"preview.todoAdd.priority": "優先度",
	"preview.todoAdd.submit": "追加",
	"preview.todoAdd.textRequired": "本文を入力してください。",
	"preview.section.comment": "コメント",
	"preview.section.note": "メモ",

	"comment.placeholder": "コメントを追加...",
	"comment.add": "追加",
	"comment.showMore": "もっと見る",
	"comment.edit": "編集",
	"comment.delete": "削除",
	"comment.empty": "コメントはありません。",

	"note.placeholder": "メモを書く...",
	"note.saved": "保存しました",

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

	"settings.section.server": "ブラウザUI",
	"settings.server.enabled": "ブラウザUIを有効にする",
	"settings.server.enabledDesc": "ローカルHTTPサーバーを起動し、ブラウザから操作できるようにします(127.0.0.1限定)。",
	"settings.server.port": "ポート",
	"settings.server.portDesc": "使用中の場合は自動的に次のポートへ繰り上がります。",
	"settings.server.actualPortRunning": "起動中: ",
	"settings.server.actualPortStopped": "停止中",
	"settings.server.openInBrowser": "ブラウザで開く",
	"settings.server.openInBrowserDesc": "トークン付きURLをデフォルトブラウザで開きます。",
	"settings.server.regenerateToken": "トークンを再生成",
	"settings.server.regenerateTokenDesc": "既存の接続は次回のリクエストから無効になります。",
	"settings.server.regenerateConfirm": "トークンを再生成しますか?既存の接続は次回のリクエストから無効になります。",
	"settings.server.regenerateDone": "トークンを再生成しました。",
	"settings.server.notifyOnStart": "起動時にURLを通知する",
	"settings.server.notRunningNotice": "サーバーが起動していません。",

	// design-browser-ui.md §6.5: webapp(webapp/src/)から直接importする新規文言。ここに追記して一元管理する。
	"webapp.unauthorized.title": "トークンが無効です",
	"webapp.unauthorized.body": "設定画面から再度開いてください。",
	"webapp.home.title": "ホーム",
	"webapp.home.todayTodo": "今日のTodo",
	"webapp.home.overdue": "Overdue",
	"webapp.home.reviewNeeded": "Review Needed",
	"webapp.home.blocked": "Blocked",
	"webapp.home.activeProjects": "Active Projects",
	"webapp.projects.title": "プロジェクト一覧",
	"webapp.projects.unclassified": "未分類",
	"webapp.projects.filterKeyword": "キーワードで絞り込み",
	"webapp.projects.filterStatus": "Status",
	"webapp.loading": "読み込み中...",
	"webapp.loadError": "読み込みに失敗しました。",
	"webapp.placeholder.comingSoon": "この画面はP4で実装予定です。",
	"webapp.detail.openInObsidian": "Obsidianで開く",
	"webapp.detail.tickets": "チケット",
	"webapp.detail.addTicketPlaceholder": "+ チケットを追加...",
	"webapp.detail.addProjectPlaceholder": "+ プロジェクトを追加...",
	"webapp.projects.addGoalPlaceholder": "+ Goalを追加...",
	"webapp.detail.addTodoPlaceholder": "+ Todoを追加",
	"webapp.detail.noParent": "(未設定)",
	"webapp.confirm.cancel": "キャンセル",
	"webapp.confirm.confirm": "実行",
	"webapp.notFound.title": "見つかりません",
	"webapp.notFound.body": "このページは存在しないか、削除された可能性があります。",
	"webapp.notFound.backLink": "一覧へ戻る",
	"webapp.dateEdit.clear": "クリア",
	"webapp.dateEdit.confirm": "OK",
	"webapp.sse.disconnected": "接続が切れました(Obsidianが起動しているか確認してください)",
	"webapp.sse.connected": "接続中",
	"webapp.commandPalette.title": "コマンドパレット",
	"webapp.commandPalette.placeholder": "プロジェクト・チケットを検索、またはコマンドを実行...",
	"webapp.commandPalette.empty": "見つかりませんでした。",
	"webapp.commandPalette.actions": "アクション",
	"webapp.commandPalette.toggleTheme": "テーマを切り替え",
	"webapp.commandPalette.hint": "検索",
	"webapp.empty.projects.title": "プロジェクトがありません",
	"webapp.empty.projects.body": "最初のプロジェクトを作成して始めましょう。",
	"webapp.celebration.allDone": "すべて完了しました",

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
	"kanban.columnEmpty": "ここへドロップして移動",
	"kanban.cardMenuLabel": "操作",

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
	"modal.review.decision.continue.desc": "このまま継続します",
	"modal.review.decision.pause.desc": "一時停止としてマークします",
	"modal.review.decision.complete.desc": "完了としてマークします",
	"modal.review.submit": "Submit",
	"modal.review.submitted": "レビューを記録しました",

	"modal.cancel": "キャンセル",

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
	"timeline.today": "今日",

	"manage.field.titleRequired": "タイトルを入力してください。",
	"manage.field.invalidStatus": "不正なstatusです。",
	"manage.field.invalidPriority": "不正なpriorityです。",
	"manage.field.invalidDate": "日付はYYYY-MM-DD形式で入力してください。",
	"manage.field.invalidReviewCycle": "不正なreview_cycleです。",
	"manage.field.invalidParent": "選択した親が存在しないか、種類が一致しません。",
	"manage.field.invalidArray": "不正な値です。",
	"manage.field.invalidOrder": "不正なorderです。",
	"manage.reorder.dragHandle": "ドラッグして並び替え",
	"manage.reorder.dragHandleDisabled": "手動ソート時のみドラッグできます",
	"manage.reorder.resetToManual": "手動順に戻す",

	"command.openManage": "Open Manage",

	"manage.title": "Manage",
	"manage.todoDisabledNotice": "Tasks / Dataviewプラグインが必要です。Todo一覧は無効化されています。",
	"manage.tab.tickets": "Tickets",
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
	"manage.filter.toggle": "フィルタ",
	"manage.filter.toggleAria": "詳細フィルタを開閉",
	"manage.filter.removeSuffix": "を解除",
	"manage.column.title": "Title",
	"manage.column.status": "Status",
	"manage.column.goal": "Goal",
	"manage.column.project": "Project",
	"manage.column.priority": "Priority",
	"manage.column.progress": "Progress",
	"manage.column.due": "Due",
	"manage.column.labels": "Labels",
	"manage.emptyState": "該当する項目はありません。",
	"manage.newButton": "+ 新規",
	"manage.column.actions": "",
	"manage.column.nav": "",
	"manage.field.unset": "(未設定)",
	"manage.updateFailed": "更新に失敗しました。",
	"manage.todoAddFailed": "Todoの追加に失敗しました。",
	"manage.rowMenu.label": "操作",
	"manage.rowMenu.openNote": "ノートを開く",
	"manage.rowMenu.showPreview": "Previewに表示",
	"manage.rowMenu.rename": "名前を変更",
	"manage.rowMenu.promote": "昇格",
	"manage.rowMenu.archive": "Archive",
	"manage.rowMenu.changeGoal": "Goalを変更…",
	"manage.rowMenu.changeProject": "Projectを変更…",
	"manage.rowMenu.moveUp": "上へ移動",
	"manage.rowMenu.moveDown": "下へ移動",
	"manage.rowMenu.delete": "削除",
	"manage.savedView.nameLabel": "名前",
	"manage.savedView.namePlaceholder": "名前を入力...",
	"manage.savedView.save": "現在の状態を保存",
	"manage.savedView.unnamed": "無題のView",
	"manage.savedView.menuButton": "☰ 保存ビュー",
	"manage.savedView.empty": "保存済みのViewはありません",
	"manage.savedView.saveNew": "現在の状態を保存...",
	"manage.savedView.saveModalTitle": "Viewを保存",
	"manage.nav.back": "← 戻る",
	"manage.nav.unknown": "(不明)",
	"manage.nav.unclassified": "未分類",
	"manage.nav.itemsSuffix": "件",
	"manage.nav.newProjectInGoal": "詳細作成...",
	"manage.nav.inlineNewProject": "+ プロジェクトを追加…",
	"manage.nav.newGoalDetail": "詳細作成...",
	"manage.nav.inlineNewGoal": "+ Goalを追加…",
	"manage.nav.entityGone": "表示していた項目が削除またはアーカイブされたため、上の階層へ戻りました。",
	"manage.nav.openDetail": "詳細を開く",
	"manage.nav.editTitle": "名前を編集",
	"manage.nav.newProject": "+ 新規プロジェクト",
	"manage.projectDetail.newTicket": "詳細作成...",
	"manage.projectDetail.inlineNewTicket": "+ チケットを追加…",
	"manage.projectDetail.todoScope": "Todoの範囲",
	"manage.projectDetail.scopeDirect": "直下",
	"manage.projectDetail.scopeAll": "すべて",

	"command.openEntitySwitcher": "Quick open project/ticket",
	"modal.entitySwitcher.placeholder": "プロジェクト/チケットを検索...",
	"modal.parentPicker.placeholderGoal": "Goalを検索...",
	"modal.parentPicker.placeholderProject": "Projectを検索...",
	"modal.parentPicker.noneGoal": "Goalなしにする",
	"modal.parentPicker.noneProject": "Projectなしにする",
	"manage.toolbar.entitySwitcher": "プロジェクト/チケットを検索",
	"manage.kbdHint": "⌨ ↑↓ 移動 / Enter 開く / n 新規作成 / Backspace 戻る",

	"onboarding.welcome.title": "Personal OSへようこそ",
	"onboarding.welcome.step1": "① Goalを作る",
	"onboarding.welcome.step2": "② Projectを作る",
	"onboarding.welcome.step3": "③ Ticket/Todoで回す",
	"onboarding.welcome.createGoal": "最初のGoalを作成",
	"onboarding.welcome.dashboardOpenManage": "管理Viewを開く",

	"statusbar.hint": "クリックでDashboardを開く",

	"undo.action": "元に戻す",
} as const;

export type MessageKey = keyof typeof MESSAGES;

export function t(key: MessageKey): string {
	return MESSAGES[key];
}

/** チケット等作成成功時のNotice文言(タイトル埋め込みのためt()とは別関数とする) */
export function entityCreatedNotice(title: string): string {
	return `${title} を作成しました`;
}

/** AI Export成功時のNotice文言(文字数埋め込みのためt()とは別関数とする) */
export function aiContextCopiedNotice(charCount: number): string {
	return `AIコンテキストをコピーしました(${charCount}文字)`;
}

/** AI Summary成功時のNotice文言 */
export function aiSummaryCopiedNotice(charCount: number): string {
	return `AIサマリーをコピーしました(${charCount}文字)`;
}

/** 期限超過ラベル(describeDue用。値埋め込みのためt()とは別関数とする) */
export function dueOverdueLabel(days: number): string {
	return `${days}日超過`;
}

/** 期限当日ラベル(describeDue用) */
export function dueTodayLabel(): string {
	return "今日";
}

/** 期限N日後ラベル(describeDue用。値埋め込みのためt()とは別関数とする) */
export function dueInDaysLabel(days: number): string {
	return `${days}日後`;
}

/** Undoトースト: Archive完了通知(タイトル埋め込みのためt()とは別関数とする) */
export function archivedUndoNotice(title: string): string {
	return `「${title}」をアーカイブしました`;
}

/** Undoトースト: Entity削除完了通知 */
export function deletedUndoNotice(title: string): string {
	return `「${title}」を削除しました`;
}

/** Undoトースト: Todo削除完了通知(長文は先頭のみ表示、memoDeleteConfirmMessageと同様の方針) */
export function todoDeletedUndoNotice(text: string): string {
	const firstLine = text.split("\n")[0];
	const summary = firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine;
	return `Todo「${summary}」を削除しました`;
}

/** Undoトースト: コメント削除完了通知 */
export function commentDeletedUndoNotice(text: string): string {
	const firstLine = text.split("\n")[0];
	const summary = firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine;
	return `コメント「${summary}」を削除しました`;
}

/** 行バッジ(ManageRow)のホバーtitle: Blocker件数 */
export function rowBadgeBlockerTitle(count: number): string {
	return `Blocker ${count}件`;
}

/** 行バッジ(ManageRow)のホバーtitle: コメント件数 */
export function rowBadgeCommentTitle(count: number): string {
	return `コメント ${count}件`;
}

/** 行バッジ(ManageRow)のホバーtitle: 未完了Todo件数 */
export function rowBadgeTodoTitle(count: number): string {
	return `未完了Todo ${count}件`;
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

/** ステータスバー項目のtitle属性(今日以前の未完了Todo件数、Phase U3。値埋め込みのためt()とは別関数とする) */
export function statusBarTodoTitle(count: number): string {
	return `今日のTodo ${count}件`;
}

/** ブラウザUIサーバー起動成功時のNotice文言(URL埋め込みのためt()とは別関数とする。design-browser-ui.md §4.3) */
export function serverStartedNotice(url: string): string {
	return `Personal OS: ブラウザUIを起動しました\n${url}`;
}

/** ブラウザUIサーバー起動失敗時のNotice文言 */
export function serverStartFailedNotice(reason: string): string {
	return `Personal OS: ブラウザUIサーバーの起動に失敗しました(${reason})`;
}

/** webapp: Archive確認ダイアログの本文(design-browser-ui.md §6.4 ConfirmModal。タイトル埋め込みのためt()とは別関数とする) */
export function confirmArchiveMessage(title: string): string {
	return `「${title}」をアーカイブしますか?`;
}

/** webapp: 削除確認ダイアログの本文 */
export function confirmDeleteMessage(title: string): string {
	return `「${title}」を削除しますか?この操作は元に戻せません。`;
}

/** 解析エラーノートを開いた場合のPreview表示メッセージ(design-ui-first.md §4.7) */
export function previewParseErrorMessage(reason: string): string {
	return `このノートは解析できません: ${reason}`;
}

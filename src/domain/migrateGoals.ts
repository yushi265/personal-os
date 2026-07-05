/**
 * Domain層: Goal廃止に伴う goal→labels 移行の純粋ロジック(design-remove-goal.md G1)。
 * Vault I/Oは一切行わない。呼び出し側(main.ts)がIndexStore/VaultRepositoryを橋渡しする。
 */

/** projectノート1件分の移行に必要な入力(parseEntityの出力から抜き出したもの) */
export interface ProjectGoalMigrationInput {
	path: string;
	/** parseEntity済みのlabels配列(現状のまま) */
	labels: string[];
	/** parseEntity済みのgoal値。resolveできていれば解決先path、できていなければ元のraw文字列(wikilink記法含む) */
	goalRaw: string;
}

export interface ProjectGoalMigrationResult {
	path: string;
	/** 書き込むべき新しいlabels配列(常にgoalRawから導出した1件を含む/既存にあれば重複追加しない) */
	labels: string[];
}

/** "[[Title]]" 形式から角括弧を取り除く */
function stripWikilinkBrackets(value: string): string {
	return value.replace(/^\[\[|\]\]$/g, "");
}

/**
 * 1件のprojectについて goal→labels 変換結果を計算する。
 * lookupTitleByPath: goalRawがstoreに存在するpathであればそのtitleを返す(解決済みgoal)。
 * 存在しない場合はundefinedを返すこと(リンク切れ・store未登録の生文字列として扱われる)。
 */
export function computeGoalLabelMigration(
	input: ProjectGoalMigrationInput,
	lookupTitleByPath: (path: string) => string | undefined
): ProjectGoalMigrationResult {
	const resolvedTitle = lookupTitleByPath(input.goalRaw);
	const label = resolvedTitle ?? stripWikilinkBrackets(input.goalRaw);
	const labels = input.labels.includes(label) ? input.labels : [...input.labels, label];
	return { path: input.path, labels };
}

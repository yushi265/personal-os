/**
 * Presentation層(webapp限定): 日付入力(input type=date)のドラフト初期値を決める純関数。
 * 空(未設定)ならtodayをデフォルト、既存値はそのまま(refinement #9)。
 * import文ゼロ(構造的型付け)とする: root tsconfig(pathsなし)・root Vitest(aliasはobsidianのみ)・
 * webapp tsconfigの3環境すべてで解決可能にするため(entityFilter.tsと同一制約)。
 */

/** valueが空文字/undefinedならtoday、それ以外はvalueをそのまま返す */
export function initialDateDraft(value: string | undefined, today: string): string {
  return value && value.length > 0 ? value : today;
}

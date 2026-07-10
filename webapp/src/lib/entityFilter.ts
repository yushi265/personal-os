/**
 * Presentation層(webapp限定): Projects.tsx一覧のキーワード/status/labelsフィルタとlabels候補集計。
 * import文ゼロ(構造的型付け)とする: root tsconfig(pathsなし)・root Vitest(aliasはobsidianのみ)・
 * webapp tsconfigの3環境すべてで解決可能にするため(docs/spec/POS-1-webapp-labels/webapp.md 実装に効く制約)。
 */

export interface FilterableEntity {
  title: string;
  status: string;
  labels: string[];
}

/** selectedが空なら常にtrue。それ以外はlabels ∩ selected ≠ ∅ でtrue(OR・大文字小文字区別)。
 *  意味論はsrc/domain/query.tsのlabels:評価(splitOr().some())と一致させる */
export function matchesLabels(labels: string[], selected: ReadonlySet<string>): boolean {
  if (selected.size === 0) return true;
  return labels.some((label) => selected.has(label));
}

/** 全エンティティのlabelsを一意集計しlocaleCompare昇順で返す。空入力は[] */
export function collectLabelOptions(entities: ReadonlyArray<{ labels: string[] }>): string[] {
  const unique = new Set<string>();
  for (const entity of entities) {
    for (const label of entity.labels) unique.add(label);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

/** Projects.tsxの既存ローカル関数matchesFilterを移設しlabels条件をAND追加。
 *  既存意味論は変更しない: keyword = title部分一致・大文字小文字無視・trim(空白のみは全通し)/
 *  statuses = OR(空Setは全通し)。labelsはmatchesLabelsに委譲。
 *  hideClosed(省略時false): trueかつstatusが終端status(done/cancelled)なら他条件に関わらずfalse
 *  (TodoList同様、完了済み・キャンセル済みを既定で隠す挙動。末尾optionalなので4引数の既存呼び出しは不変)。
 *  終端status判定はsrc/domain/entity.tsのisClosedStatusと同一意味論(この場でインラインする理由は上記の
 *  import文ゼロ制約: importするとroot Vitest(tests/webapp/entityFilter.test.ts、@domain未alias)で解決不能になる) */
export function matchesFilter(
  entity: FilterableEntity,
  keyword: string,
  statuses: ReadonlySet<string>,
  labels: ReadonlySet<string>,
  hideClosed = false
): boolean {
  if (hideClosed && (entity.status === "done" || entity.status === "cancelled")) return false;
  if (statuses.size > 0 && !statuses.has(entity.status)) return false;
  if (!matchesLabels(entity.labels, labels)) return false;
  if (!keyword.trim()) return true;
  return entity.title.toLowerCase().includes(keyword.trim().toLowerCase());
}

#!/usr/bin/env bash
# PostToolUse(Edit|Write) hook — engine state の着火自動化（advisory）
#
# spec の index.md を作成/編集したとき、対応する engine state（report/next の機械可読 state）が
# 未初期化なら AI へ advisory で nudge する。手動 CLI（report/next）は着火が人間依存でドロップ
# しやすいため、着火点（spec 作成）で自動的にリマインドして採用率を上げる。
#
# 規約: spec dir 名 = engine state 名（docs/spec/<NAME>/ ↔ .claude/aidlc/state/<NAME>.md）。
# advisory: nudge は exit 2（stderr を AI へ）。hard stop にしない（init は任意・engine は advisory）。
# clean（既に init 済み）・spec 以外・環境未整備なら exit 0。
set -u

input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"

[ -z "$file" ] && exit 0

# docs/spec/<NAME>/index.md のみ対象（spec の入口ファイル作成＝着火点）。
case "$file" in
  */docs/spec/*/index.md|docs/spec/*/index.md) ;;
  *) exit 0 ;;
esac

repo_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
aidlc="$repo_root/.claude/aidlc"

# フェイルセーフ: 依存未導入 / pnpm 不在なら黙って通す。
[ -d "$aidlc/node_modules" ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0

# spec dir 名（= ticket/state 名）を取り出す。
spec_dir="$(dirname "$file")"
name="$(basename "$spec_dir")"
state_file="$aidlc/state/$name.md"

# 既に engine state が init 済みなら何もしない（nudge は未初期化時のみ）。
[ -f "$state_file" ] && exit 0

{
  echo "[aidlc:engine 着火 nudge] spec '$name' の engine state が未初期化です（advisory）。"
  echo "  このボルトの Stage/Gate を audit ログ付きで追跡するなら、リスクティアに対応する scope で init してください:"
  echo "    pnpm -C .claude/aidlc report state/$name.md init scope=<doc-only|bugfix|feature|security-patch>"
  echo "  以降は各 Stage 完了/Gate 承認を 'report state/$name.md <stage-done N|gate-approve gateN>' で記録できます。"
  echo "  （任意・engine は advisory。progress.md と並走。不要なら無視可）"
} >&2
exit 2

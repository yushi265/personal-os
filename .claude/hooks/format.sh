#!/usr/bin/env bash
# PostToolUse(Edit|Write) hook
# 編集されたファイルを自動整形する。整形コマンドはプロジェクトの言語・ツールに合わせて調整する。
# 最終防衛線は lefthook(pre-commit) なので、ここでの失敗ではブロックせず常に exit 0。
#
# personal-os には formatter（prettier 等）が未導入なので、何もせず exit 0 する（無害化）。
# formatter を導入したら、対応する拡張子の case を足す。
set -u

input="$(cat)"

# Claude Code は tool_input.file_path に編集対象パスを渡す（未使用だが将来の formatter 追加用に残す）
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"

[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

case "$file" in
  # formatter 未導入。ここに拡張子ごとの整形コマンドを追加する。
  *)
    ;;
esac

exit 0

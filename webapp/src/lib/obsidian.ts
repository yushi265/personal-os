// obsidian://open URI組み立て(design §9 P4行)。.md拡張子は除去する(Obsidianのfile引数は拡張子なしパス)。
export function obsidianOpenUri(vaultName: string, path: string): string {
  const withoutExt = path.replace(/\.md$/, "");
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(withoutExt)}`;
}

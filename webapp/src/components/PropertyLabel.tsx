import type * as React from "react";

// プロパティ行の見出し(design-refs/geist-final.dc.html §プロジェクト詳細: 11px mono大文字 letter-spacing0.06em faint)。
// 日本語ラベルはuppercase指定してもかな漢字には影響しないため、英字キーもそのまま忠実な見た目になる。
export function PropertyLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">{children}</span>;
}

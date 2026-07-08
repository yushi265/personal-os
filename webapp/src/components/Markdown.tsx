import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

// コメント/メモ本文をMarkdownで描画する共通コンポーネント(機能#4)。
// remark-gfmのautolink literalsで生URLが自動的にリンク化される(機能#2)。
// rehype-rawは有効化しない(生HTMLを描画しない=XSS安全)。
// リンクは新規タブ+noopener/noreferrerで開く。
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("markdown-body", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

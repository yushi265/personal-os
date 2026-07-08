import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// Geistデザインシステム(design-refs/geist-final.dc.html)のトークンを直接var(...)参照する。
// shadcn標準のセマンティックキー(background/foreground/primary等)はindex.cssで同じCSS変数に
// 再マッピングしているため、既存コンポーネント(bg-background等のTailwindユーティリティ経由で色を使う設計)は無修正のまま追従する。
// 加えて、デザインHTMLの変数名(--bg/--fg/--surface/--hairline/--faint/--ghost/--accent)にそのまま対応する
// ユーティリティ(bg-fg, text-faint, border-hairline等)も追加し、新規実装で仕様の表記に忠実に書けるようにする。
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        // 日本語はGeistが非対応のためシステムJPフォントにフォールバック(IBM Plex Sans JPは同梱しない)
        sans: ["Geist", "Hiragino Sans", "Noto Sans JP", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
      colors: {
        border: "var(--border)",
        // フォーム部品の輪郭線はUI識別のため3:1以上が必要(WCAG 1.4.11)。装飾用borderと分離
        input: "var(--input-border)",
        ring: "var(--accent)",
        background: "var(--bg)",
        foreground: "var(--fg)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--surface)",
          foreground: "var(--fg)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--surface)",
          foreground: "var(--muted)",
        },
        // shadcn標準の"accent"はhoverの中立背景として使われている箇所が多いため、
        // デザインの強調色(青)ではなくhairlineへ割り当てる。強調色自体は"brand"として独立させる。
        accent: {
          DEFAULT: "var(--hairline)",
          foreground: "var(--fg)",
        },
        popover: {
          // ポップオーバー/セレクト/コマンドパレット/ダイアログは浮遊レイヤーとしてページ地より明るい--elevatedに乗せる
          DEFAULT: "var(--elevated)",
          foreground: "var(--fg)",
        },
        card: {
          DEFAULT: "var(--elevated)",
          foreground: "var(--fg)",
        },
        // デザインHTMLの生トークン名をそのまま使えるようにするエイリアス
        bg: "var(--bg)",
        fg: "var(--fg)",
        surface: "var(--surface)",
        elevated: "var(--elevated)",
        hairline: "var(--hairline)",
        faint: "var(--faint)",
        ghost: "var(--ghost)",
        brand: "var(--accent)",
        // 「成功/接続OK」の意味色。旧--accent(緑)をbrandの青化後も温存する(ConnectionDot等)
        success: "var(--success)",
        // Sidebarのアクティブナビ背景専用。brandはvar(...)にhexを直接入れているためTailwindの
        // アルファ修飾子(bg-brand/5)を注入できず、rgba直書きのトークンを別キーとして用意する
        "brand-tint": "var(--brand-tint)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // --shadow-*トークン(index.css)経由の多層シャドウ。既存のshadow-sm/md/lgクラスがそのまま
      // Card/Input/Popover/Dialog等の立体感トークンを参照するようになる(コンポーネント側の変更を最小化)。
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      // 触感系マイクロインタラクション用のオーバーシュートイージング(back-out)。
      // hover時のアイコン/数値の「ポンッ」とした弾みに使う(押下側は素のtransitionで沈める)。
      transitionTimingFunction: {
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        // チェックボックスのチェックマークが弾んで入るポップ(Radix Indicatorのマウント時に1回再生)
        "check-pop": {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.25)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "check-pop": "check-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

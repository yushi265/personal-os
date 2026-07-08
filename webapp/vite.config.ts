import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// design-browser-ui.md §3.2: webappはVite独立ビルド。domain/i18nはsrc/を相対参照するため
// dev server の fs.allow にリポジトリルートを追加する(ビルド成果物には影響しない、開発サーバー限定の設定)。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate", // skipWaiting+clientsClaim。更新プロンプトUIは作らない
      manifestFilename: "manifest.json", // .webmanifest を避け StaticServer 無改修で配信(POS-2-pwa/index.md 判断根拠)
      manifest: {
        name: "Personal OS",
        short_name: "Personal OS",
        description: "Obsidian Personal OS ブラウザUI",
        lang: "ja",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#f8fafc",
        background_color: "#f8fafc",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"], // フォント含むアプリシェル一式(LICENSE.txtは対象外)
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//], // /api・SSEにindex.htmlを返さない
        // runtimeCachingは設定しない = /api/*はSWがrespondWithせず素通し(AC-3)
      },
    }),
  ],
  root: dirname,
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      "@domain": path.resolve(dirname, "../src/domain"),
      "@i18n": path.resolve(dirname, "../src/i18n"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(dirname, "..")],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

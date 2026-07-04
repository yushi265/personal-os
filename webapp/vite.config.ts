import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// design-browser-ui.md §3.2: webappはVite独立ビルド。domain/i18nはsrc/を相対参照するため
// dev server の fs.allow にリポジトリルートを追加する(ビルド成果物には影響しない、開発サーバー限定の設定)。
export default defineConfig({
  plugins: [react()],
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

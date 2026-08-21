import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages はリポジトリ名のサブパス配下に出るため、
// ビルド時に BASE_PATH を渡して切り替える（未指定なら相対パス）。
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || "./",
  // 日本語を \uXXXX にエスケープして出力する。
  // 単一 HTML に埋め込んだときに charset 指定に依存せず文字化けしないようにするため。
  esbuild: { charset: "ascii" },
});

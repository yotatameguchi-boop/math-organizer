import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const out = process.argv[2] || join(root, "dist", "single.html");

const jsName = readdirSync(join(dist, "assets")).find((f) => f.endsWith(".js"));
let js = readFileSync(join(dist, "assets", jsName), "utf8");

// インライン <script> を閉じてしまう並びを無害化
const before = js.length;
js = js.replaceAll("</script", "<\\/script");
if (js.length !== before) console.log("escaped </script occurrences");

const cssFiles = readdirSync(join(dist, "assets")).filter((f) => f.endsWith(".css"));
const css = cssFiles.map((f) => readFileSync(join(dist, "assets", f), "utf8")).join("\n");

// charset 指定に依存しないよう、出力全体を ASCII に保つ（タイトルは実体参照）
const TITLE = [..."問題帳"].map((c) => `&#${c.codePointAt(0)};`).join("");

// Artifact は <!doctype>/<html>/<head>/<body> を自前で付けるので、中身だけを書き出す
const html = `<title>${TITLE}</title>
<style>
  html, body { margin: 0; padding: 0; background: #FAF8F2; }
  #root { min-height: 100vh; }
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

writeFileSync(out, html);
console.log("wrote", out, (html.length / 1024).toFixed(1) + " KB");

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";
import { createApp } from "./app.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || "127.0.0.1";
const DB_FILE = process.env.MO_DB || join(root, "data", "math-organizer.db");
const TOKEN_FILE = join(root, "data", "token");

/** 環境変数があればそれを使い、無ければ生成して data/token に保存する。 */
function resolveToken() {
  if (process.env.MO_TOKEN) return { token: process.env.MO_TOKEN, generated: false };
  if (existsSync(TOKEN_FILE)) return { token: readFileSync(TOKEN_FILE, "utf8").trim(), generated: false };

  const token = randomBytes(24).toString("base64url");
  mkdirSync(dirname(TOKEN_FILE), { recursive: true });
  writeFileSync(TOKEN_FILE, token + "\n", { mode: 0o600 });
  return { token, generated: true };
}

const { token, generated } = resolveToken();
const db = openDb(DB_FILE);

const distDir = join(root, "dist");
const staticRoot = existsSync(join(distDir, "index.html")) ? resolve(distDir) : null;

const allowedOrigins = process.env.MO_ORIGINS
  ? process.env.MO_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173"]; // vite dev

const server = createServer(createApp({ db, token, staticRoot, allowedOrigins }));

server.listen(PORT, HOST, () => {
  console.log(`問題帳サーバー  http://${HOST}:${PORT}`);
  console.log(`  DB       ${DB_FILE}`);
  console.log(`  静的配信 ${staticRoot || "(なし — npm run build で dist を作ると配信します)"}`);
  console.log(`  CORS     ${allowedOrigins.join(", ")}`);
  console.log("");
  if (generated) {
    console.log("トークンを生成し data/token に保存しました。アプリの接続設定に貼ってください:");
    console.log("");
    console.log(`  ${token}`);
    console.log("");
  } else {
    console.log(`トークンは ${process.env.MO_TOKEN ? "環境変数 MO_TOKEN" : "data/token"} から読みました。`);
  }
  if (HOST === "127.0.0.1") {
    console.log("他の端末から使うには HOST=0.0.0.0 で起動し、LAN の IP を接続設定に入れてください。");
  }
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

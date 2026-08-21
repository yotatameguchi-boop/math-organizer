import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { readState, writeState, queryProblems, stats, getVersion } from "./db.js";

const MAX_BODY = 8 * 1024 * 1024; // 問題数が増えてもスナップショットが収まる程度

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** 長さが違っても比較時間が漏れないようにする。 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("リクエストが大きすぎます"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("JSON として読めません"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

async function serveStatic(res, root, pathname) {
  // ルート外へ抜けられないよう正規化してから接頭辞を確認する
  const rel = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const full = join(root, rel);
  if (full !== root && !full.startsWith(root + sep)) {
    send(res, 403, { error: "forbidden" });
    return true;
  }
  try {
    const buf = await readFile(full);
    res.writeHead(200, { "Content-Type": MIME[extname(full)] || "application/octet-stream" });
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

/**
 * リクエストハンドラを作る。
 *
 * 単一ユーザー前提なので認証は共有トークン 1 つ。
 * 書き込みは楽観ロックで、version がずれていれば 409 と最新状態を返す。
 */
export function createApp({ db, token, staticRoot = null, allowedOrigins = null }) {
  return async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const { pathname } = url;

    const origin = req.headers.origin;
    if (origin && (!allowedOrigins || allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "86400");
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (!pathname.startsWith("/api/")) {
      if (staticRoot && req.method === "GET" && (await serveStatic(res, staticRoot, pathname))) return;
      send(res, 404, { error: "not found" });
      return;
    }

    if (pathname === "/api/health") {
      send(res, 200, { ok: true, version: getVersion(db) });
      return;
    }

    const auth = req.headers.authorization || "";
    const presented = auth.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("token") || "";
    if (!safeEqual(presented, token)) {
      send(res, 401, { error: "トークンが違います" }, { "WWW-Authenticate": "Bearer" });
      return;
    }

    try {
      if (pathname === "/api/state" && req.method === "GET") {
        send(res, 200, readState(db));
        return;
      }

      if (pathname === "/api/state" && req.method === "PUT") {
        const body = await readBody(req);
        if (!body || typeof body !== "object") {
          send(res, 400, { error: "本文が空です" });
          return;
        }
        if (!Array.isArray(body.problems) || !Array.isArray(body.types)) {
          send(res, 400, { error: "problems と types は配列である必要があります" });
          return;
        }

        const current = getVersion(db);
        // version 未指定なら強制上書き。指定があってズレていれば 409。
        if (body.version != null && Number(body.version) !== current) {
          send(res, 409, {
            error: "サーバー側が更新されています",
            expected: current,
            received: Number(body.version),
            state: readState(db),
          });
          return;
        }

        send(res, 200, writeState(db, body));
        return;
      }

      if (pathname === "/api/problems" && req.method === "GET") {
        send(res, 200, {
          problems: queryProblems(db, {
            level: url.searchParams.get("level"),
            unitId: url.searchParams.get("unitId"),
            status: url.searchParams.get("status"),
            typeId: url.searchParams.get("typeId"),
            q: url.searchParams.get("q"),
          }),
        });
        return;
      }

      if (pathname === "/api/stats" && req.method === "GET") {
        send(res, 200, stats(db, url.searchParams.get("level")));
        return;
      }

      send(res, 404, { error: "not found" });
    } catch (err) {
      send(res, err.status || 500, { error: err.message || "internal error" });
    }
  };
}

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * 問題帳のストレージ。
 *
 * フロントは problems / types を配列まるごと持ち回るので API はスナップショット単位だが、
 * DB は正規化して持つ。絞り込みクエリをサーバー側で書けるようにするため。
 */
export function openDb(file) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS types (
      id       TEXT PRIMARY KEY,
      level    TEXT NOT NULL,
      name     TEXT NOT NULL,
      color    TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS problems (
      id         TEXT PRIMARY KEY,
      level      TEXT NOT NULL,
      unit_id    TEXT NOT NULL,
      title      TEXT NOT NULL,
      difficulty INTEGER NOT NULL DEFAULT 3,
      status     TEXT NOT NULL DEFAULT 'todo',
      source     TEXT NOT NULL DEFAULT '',
      memo       TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS problem_types (
      problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      type_id    TEXT NOT NULL,
      PRIMARY KEY (problem_id, type_id)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_problems_level  ON problems(level);
    CREATE INDEX IF NOT EXISTS idx_problems_unit   ON problems(unit_id);
    CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
    CREATE INDEX IF NOT EXISTS idx_types_level     ON types(level);
    CREATE INDEX IF NOT EXISTS idx_ptypes_type     ON problem_types(type_id);
  `);

  return db;
}

const getMeta = (db, key, fallback) => {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? row.value : fallback;
};

const setMeta = (db, key, value) => {
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key,
    String(value)
  );
};

export const getVersion = (db) => Number(getMeta(db, "version", "0"));

export const getSeededLevels = (db) => {
  try {
    const parsed = JSON.parse(getMeta(db, "seeded_levels", "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// node:sqlite は null プロトタイプの行を返す。呼び出し側が驚かないよう通常のオブジェクトに直す。
const plain = (rows) => rows.map((r) => ({ ...r }));

/** クライアントがそのまま state に流し込める形で全件返す。 */
export function readState(db) {
  const types = plain(
    db.prepare("SELECT id, level, name, color FROM types ORDER BY level, position, name").all()
  );

  const rows = db
    .prepare(
      `SELECT id, level, unit_id AS unitId, title, difficulty, status, source, memo,
              created_at AS createdAt, updated_at AS updatedAt
         FROM problems ORDER BY created_at`
    )
    .all();

  const links = db.prepare("SELECT problem_id, type_id FROM problem_types").all();
  const byProblem = new Map();
  for (const l of links) {
    if (!byProblem.has(l.problem_id)) byProblem.set(l.problem_id, []);
    byProblem.get(l.problem_id).push(l.type_id);
  }

  return {
    version: getVersion(db),
    seededLevels: getSeededLevels(db),
    types,
    problems: rows.map((r) => ({ ...r, types: byProblem.get(r.id) || [] })),
  };
}

const asInt = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};
const asText = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** スナップショットで丸ごと置き換える。version を +1 して返す。 */
export function writeState(db, { problems = [], types = [], seededLevels = [] }) {
  const now = Date.now();

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DELETE FROM problem_types");
    db.exec("DELETE FROM problems");
    db.exec("DELETE FROM types");

    const insType = db.prepare("INSERT INTO types (id, level, name, color, position) VALUES (?, ?, ?, ?, ?)");
    types.forEach((t, i) => {
      insType.run(asText(t.id), asText(t.level), asText(t.name), asText(t.color), i);
    });

    const insProblem = db.prepare(
      `INSERT INTO problems (id, level, unit_id, title, difficulty, status, source, memo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insLink = db.prepare("INSERT OR IGNORE INTO problem_types (problem_id, type_id) VALUES (?, ?)");

    for (const p of problems) {
      const id = asText(p.id);
      insProblem.run(
        id,
        asText(p.level),
        asText(p.unitId),
        asText(p.title),
        asInt(p.difficulty, 3),
        asText(p.status) || "todo",
        asText(p.source),
        asText(p.memo),
        asInt(p.createdAt, now),
        asInt(p.updatedAt, now)
      );
      for (const typeId of Array.isArray(p.types) ? p.types : []) {
        insLink.run(id, asText(typeId));
      }
    }

    setMeta(db, "seeded_levels", JSON.stringify(seededLevels));
    setMeta(db, "version", getVersion(db) + 1);
    setMeta(db, "updated_at", now);

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return readState(db);
}

/** 読み取り専用の絞り込み。サーバー側で問題を眺めるとき用。 */
export function queryProblems(db, { level, unitId, status, typeId, q } = {}) {
  const where = [];
  const args = [];

  if (level) (where.push("p.level = ?"), args.push(level));
  if (unitId) (where.push("p.unit_id = ?"), args.push(unitId));
  if (status) (where.push("p.status = ?"), args.push(status));
  if (typeId) {
    where.push("EXISTS (SELECT 1 FROM problem_types pt WHERE pt.problem_id = p.id AND pt.type_id = ?)");
    args.push(typeId);
  }
  if (q) {
    where.push("(p.title LIKE ? OR p.source LIKE ? OR p.memo LIKE ?)");
    const like = `%${q}%`;
    args.push(like, like, like);
  }

  const rows = db
    .prepare(
      `SELECT p.id, p.level, p.unit_id AS unitId, p.title, p.difficulty, p.status,
              p.source, p.memo, p.created_at AS createdAt, p.updated_at AS updatedAt
         FROM problems p
         ${where.length ? "WHERE " + where.join(" AND ") : ""}
         ORDER BY p.created_at`
    )
    .all(...args);

  const links = db.prepare("SELECT problem_id, type_id FROM problem_types").all();
  const byProblem = new Map();
  for (const l of links) {
    if (!byProblem.has(l.problem_id)) byProblem.set(l.problem_id, []);
    byProblem.get(l.problem_id).push(l.type_id);
  }

  return rows.map((r) => ({ ...r, types: byProblem.get(r.id) || [] }));
}

/** 単元別・ステータス別の集計。 */
export function stats(db, level) {
  const args = level ? [level] : [];
  const clause = level ? "WHERE level = ?" : "";
  return {
    total: db.prepare(`SELECT COUNT(*) AS n FROM problems ${clause}`).get(...args).n,
    byStatus: plain(
      db.prepare(`SELECT status, COUNT(*) AS n FROM problems ${clause} GROUP BY status`).all(...args)
    ),
    byUnit: plain(
      db
        .prepare(`SELECT unit_id AS unitId, COUNT(*) AS n FROM problems ${clause} GROUP BY unit_id ORDER BY n DESC`)
        .all(...args)
    ),
  };
}

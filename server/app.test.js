import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { openDb, readState, writeState, queryProblems, stats } from "./db.js";
import { createApp } from "./app.js";

const TOKEN = "test-token-123";

/** テストごとに使い捨てのサーバーを立てる。 */
async function withServer(run) {
  const db = openDb(":memory:");
  const server = createServer(createApp({ db, token: TOKEN, allowedOrigins: ["*"] }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (path, { method = "GET", body, token = TOKEN } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* 本文が JSON でないケースも見たいので握りつぶす */
    }
    return { status: res.status, json, text };
  };

  try {
    await run({ call, db });
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
}

const sampleState = {
  types: [
    { id: "t1", level: "daigakujuken", name: "最大最小問題", color: "#B5472A" },
    { id: "t2", level: "daigakujuken", name: "漸化式", color: "#2E7D5B" },
  ],
  problems: [
    {
      id: "p1",
      level: "daigakujuken",
      unitId: "I-2",
      title: "y=x²-4x+3 の最大最小",
      difficulty: 2,
      status: "todo",
      source: "入試基礎",
      memo: "",
      types: ["t1"],
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: "p2",
      level: "daigakujuken",
      unitId: "B-1",
      title: "漸化式の一般項",
      difficulty: 4,
      status: "mastered",
      source: "",
      memo: "特性方程式",
      types: ["t2", "t1"],
      createdAt: 2000,
      updatedAt: 2000,
    },
  ],
  seededLevels: ["daigakujuken"],
};

/* ---------- DB 層 ---------- */

test("空の DB は version 0 の空状態を返す", () => {
  const db = openDb(":memory:");
  assert.deepEqual(readState(db), { version: 0, seededLevels: [], types: [], problems: [] });
  db.close();
});

test("書き込んだ状態がタイプの紐づけごと読み戻せる", () => {
  const db = openDb(":memory:");
  const out = writeState(db, sampleState);

  assert.equal(out.version, 1);
  assert.deepEqual(out.seededLevels, ["daigakujuken"]);
  assert.equal(out.problems.length, 2);

  const p2 = out.problems.find((p) => p.id === "p2");
  assert.deepEqual(p2.types.sort(), ["t1", "t2"]);
  assert.equal(p2.memo, "特性方程式");
  assert.equal(p2.difficulty, 4);
  db.close();
});

test("書き込みはスナップショット置き換えで、消えた行は残らない", () => {
  const db = openDb(":memory:");
  writeState(db, sampleState);
  const out = writeState(db, { ...sampleState, problems: [sampleState.problems[0]] });

  assert.equal(out.version, 2);
  assert.deepEqual(
    out.problems.map((p) => p.id),
    ["p1"]
  );
  // 孤児リンクが残っていないこと
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM problem_types").get().n, 1);
  db.close();
});

test("欠けたフィールドは既定値で埋まる", () => {
  const db = openDb(":memory:");
  const out = writeState(db, {
    types: [],
    problems: [{ id: "x", level: "koukoujuken", unitId: "kj-data", title: "確率" }],
    seededLevels: [],
  });
  const p = out.problems[0];
  assert.equal(p.difficulty, 3);
  assert.equal(p.status, "todo");
  assert.equal(p.source, "");
  assert.deepEqual(p.types, []);
  assert.ok(p.createdAt > 0);
  db.close();
});

test("queryProblems が単元・ステータス・タイプ・全文で絞り込める", () => {
  const db = openDb(":memory:");
  writeState(db, sampleState);

  assert.deepEqual(queryProblems(db, { unitId: "B-1" }).map((p) => p.id), ["p2"]);
  assert.deepEqual(queryProblems(db, { status: "todo" }).map((p) => p.id), ["p1"]);
  assert.deepEqual(queryProblems(db, { typeId: "t1" }).map((p) => p.id), ["p1", "p2"]);
  assert.deepEqual(queryProblems(db, { q: "特性" }).map((p) => p.id), ["p2"]);
  assert.deepEqual(queryProblems(db, { level: "koukoujuken" }), []);
  db.close();
});

test("stats が総数・ステータス別・単元別を返す", () => {
  const db = openDb(":memory:");
  writeState(db, sampleState);
  const s = stats(db, "daigakujuken");

  assert.equal(s.total, 2);
  assert.deepEqual(
    s.byStatus.sort((a, b) => a.status.localeCompare(b.status)),
    [
      { status: "mastered", n: 1 },
      { status: "todo", n: 1 },
    ]
  );
  assert.equal(s.byUnit.length, 2);
  db.close();
});

test("書き込み中に例外が出ても状態が壊れない", () => {
  const db = openDb(":memory:");
  writeState(db, sampleState);

  // id が無い行は NOT NULL 制約ではなく PRIMARY KEY 重複で落とす
  assert.throws(() =>
    writeState(db, {
      types: [],
      problems: [
        { id: "dup", level: "a", unitId: "u", title: "1" },
        { id: "dup", level: "a", unitId: "u", title: "2" },
      ],
      seededLevels: [],
    })
  );

  const after = readState(db);
  assert.equal(after.version, 1, "ロールバックされ version が進んでいないこと");
  assert.equal(after.problems.length, 2, "元の 2 件が残っていること");
  db.close();
});

/* ---------- HTTP 層 ---------- */

test("health は認証なしで応答する", async () => {
  await withServer(async ({ call }) => {
    const res = await call("/api/health", { token: null });
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, true);
  });
});

test("トークンが無い / 違うと 401", async () => {
  await withServer(async ({ call }) => {
    assert.equal((await call("/api/state", { token: null })).status, 401);
    assert.equal((await call("/api/state", { token: "wrong" })).status, 401);
    // 長さ違いでも比較が落ちないこと
    assert.equal((await call("/api/state", { token: "x" })).status, 401);
  });
});

test("GET /api/state は初期状態を返す", async () => {
  await withServer(async ({ call }) => {
    const res = await call("/api/state");
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { version: 0, seededLevels: [], types: [], problems: [] });
  });
});

test("PUT /api/state で保存でき version が進む", async () => {
  await withServer(async ({ call }) => {
    const put = await call("/api/state", { method: "PUT", body: { ...sampleState, version: 0 } });
    assert.equal(put.status, 200);
    assert.equal(put.json.version, 1);

    const get = await call("/api/state");
    assert.equal(get.json.problems.length, 2);
  });
});

test("version がずれた PUT は 409 と最新状態を返す", async () => {
  await withServer(async ({ call }) => {
    await call("/api/state", { method: "PUT", body: { ...sampleState, version: 0 } });

    const stale = await call("/api/state", { method: "PUT", body: { ...sampleState, version: 0 } });
    assert.equal(stale.status, 409);
    assert.equal(stale.json.expected, 1);
    assert.equal(stale.json.received, 0);
    assert.equal(stale.json.state.problems.length, 2, "衝突時に最新状態が同梱されること");
  });
});

test("version 省略の PUT は強制上書きになる", async () => {
  await withServer(async ({ call }) => {
    await call("/api/state", { method: "PUT", body: { ...sampleState, version: 0 } });

    const forced = await call("/api/state", {
      method: "PUT",
      body: { types: [], problems: [], seededLevels: [] },
    });
    assert.equal(forced.status, 200);
    assert.equal(forced.json.problems.length, 0);
    assert.equal(forced.json.version, 2);
  });
});

test("壊れた本文は 400", async () => {
  await withServer(async ({ call }) => {
    assert.equal((await call("/api/state", { method: "PUT", body: { types: [] } })).status, 400);
    assert.equal(
      (await call("/api/state", { method: "PUT", body: { types: "x", problems: [] } })).status,
      400
    );
  });
});

test("GET /api/problems が絞り込みクエリを受け付ける", async () => {
  await withServer(async ({ call }) => {
    await call("/api/state", { method: "PUT", body: { ...sampleState, version: 0 } });

    const all = await call("/api/problems");
    assert.equal(all.json.problems.length, 2);

    const done = await call("/api/problems?status=mastered");
    assert.deepEqual(done.json.problems.map((p) => p.id), ["p2"]);

    const byType = await call("/api/problems?typeId=t2");
    assert.deepEqual(byType.json.problems.map((p) => p.id), ["p2"]);
  });
});

test("GET /api/stats が集計を返す", async () => {
  await withServer(async ({ call }) => {
    await call("/api/state", { method: "PUT", body: { ...sampleState, version: 0 } });
    const res = await call("/api/stats?level=daigakujuken");
    assert.equal(res.json.total, 2);
  });
});

test("知らないパスは 404", async () => {
  await withServer(async ({ call }) => {
    assert.equal((await call("/api/nope")).status, 404);
    assert.equal((await call("/nope")).status, 404);
  });
});

test("CORS プリフライトに応答する", async () => {
  await withServer(async ({ call }) => {
    const res = await call("/api/state", { method: "OPTIONS", token: null });
    assert.equal(res.status, 204);
  });
});

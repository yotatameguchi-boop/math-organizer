import test from "node:test";
import assert from "node:assert/strict";
import { mergeState, normalizeUrl, fingerprint } from "../src/api.js";

const p = (id, extra = {}) => ({ id, title: id, level: "daigakujuken", unitId: "I-1", ...extra });

test("両方にしか無い問題は和集合になる", () => {
  const out = mergeState(
    { problems: [p("local")], types: [], seededLevels: ["a"] },
    { problems: [p("remote")], types: [], seededLevels: ["b"] }
  );
  assert.deepEqual(out.problems.map((x) => x.id).sort(), ["local", "remote"]);
  assert.deepEqual(out.seededLevels.sort(), ["a", "b"]);
});

test("同じ id は updatedAt が新しい方を採る", () => {
  const out = mergeState(
    { problems: [p("x", { updatedAt: 200, status: "mastered" })], types: [], seededLevels: [] },
    { problems: [p("x", { updatedAt: 100, status: "todo" })], types: [], seededLevels: [] }
  );
  assert.equal(out.problems.length, 1);
  assert.equal(out.problems[0].status, "mastered");
});

test("リモートの方が新しければリモートが勝つ", () => {
  const out = mergeState(
    { problems: [p("x", { updatedAt: 100, status: "todo" })], types: [], seededLevels: [] },
    { problems: [p("x", { updatedAt: 300, status: "review" })], types: [], seededLevels: [] }
  );
  assert.equal(out.problems[0].status, "review");
});

test("updatedAt が無ければ createdAt で比べる", () => {
  const out = mergeState(
    { problems: [p("x", { createdAt: 500, memo: "local" })], types: [], seededLevels: [] },
    { problems: [p("x", { createdAt: 100, memo: "remote" })], types: [], seededLevels: [] }
  );
  assert.equal(out.problems[0].memo, "local");
});

test("同着ならリモートを保持する（際限なく往復させないため）", () => {
  const out = mergeState(
    { problems: [p("x", { updatedAt: 100, memo: "local" })], types: [], seededLevels: [] },
    { problems: [p("x", { updatedAt: 100, memo: "remote" })], types: [], seededLevels: [] }
  );
  assert.equal(out.problems[0].memo, "remote");
});

test("タイプも同じ規則で統合される", () => {
  const out = mergeState(
    { problems: [], types: [{ id: "t1", name: "改名後", updatedAt: 200 }], seededLevels: [] },
    { problems: [], types: [{ id: "t1", name: "改名前", updatedAt: 100 }, { id: "t2", name: "他" }], seededLevels: [] }
  );
  assert.equal(out.types.length, 2);
  assert.equal(out.types.find((t) => t.id === "t1").name, "改名後");
});

test("空同士でも壊れない", () => {
  const out = mergeState({ problems: [], types: [] }, { problems: [], types: [] });
  assert.deepEqual(out, { problems: [], types: [], seededLevels: [] });
});

test("新しい端末の例題が、サーバー上の習熟度を上書きしない", () => {
  // 例題は固定の作成時刻を持つ。Date.now() にすると必ず最新になり、
  // 初回同期で他の端末の進捗が白紙に戻る。
  const SEED_EPOCH = 1700000000000;
  const fresh = { id: "seed-daigakujuken-0", title: "例題", status: "todo", updatedAt: SEED_EPOCH };
  const edited = { id: "seed-daigakujuken-0", title: "例題", status: "mastered", updatedAt: 1750000000000 };

  const out = mergeState({ problems: [fresh], types: [], seededLevels: [] }, { problems: [edited], types: [], seededLevels: [] });

  assert.equal(out.problems.length, 1);
  assert.equal(out.problems[0].status, "mastered", "サーバー側の編集が残ること");
});

test("fingerprint は件数が同じでも中身の違いを捉える", () => {
  const base = { problems: [{ id: "a", status: "todo", types: [] }], types: [] };
  const changed = { problems: [{ id: "a", status: "mastered", types: [] }], types: [] };

  assert.notEqual(fingerprint(base), fingerprint(changed));
});

test("fingerprint は並び順とタグ順の違いを無視する", () => {
  const a = {
    problems: [
      { id: "b", status: "todo", types: ["t2", "t1"] },
      { id: "a", status: "todo", types: [] },
    ],
    types: [],
  };
  const b = {
    problems: [
      { id: "a", status: "todo", types: [] },
      { id: "b", status: "todo", types: ["t1", "t2"] },
    ],
    types: [],
  };

  assert.equal(fingerprint(a), fingerprint(b));
});

test("fingerprint は version や updatedAt の違いでは変わらない", () => {
  const a = { version: 1, problems: [{ id: "a", status: "todo", updatedAt: 100 }], types: [] };
  const b = { version: 9, problems: [{ id: "a", status: "todo", updatedAt: 999 }], types: [] };

  assert.equal(fingerprint(a), fingerprint(b), "無駄な送信を招かないこと");
});

test("normalizeUrl が末尾スラッシュ・/api・スキーム欠落を吸収する", () => {
  assert.equal(normalizeUrl("127.0.0.1:5174"), "http://127.0.0.1:5174");
  assert.equal(normalizeUrl("http://127.0.0.1:5174/"), "http://127.0.0.1:5174");
  assert.equal(normalizeUrl("http://127.0.0.1:5174/api"), "http://127.0.0.1:5174");
  assert.equal(normalizeUrl("https://example.com/api/"), "https://example.com");
  assert.equal(normalizeUrl("  "), "");
});

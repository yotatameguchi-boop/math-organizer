/**
 * バックエンドとの同期。
 *
 * 接続情報は端末ごとに localStorage で持つ（サーバーに置くと鶏卵になるため）。
 * 未設定ならローカル専用モードで、これまでどおり localStorage だけで動く。
 */
const CONFIG_KEY = "math-server-config";

const readLS = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeLS = (key, value) => {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* プライベートモード等では黙って諦める */
  }
};

export function loadConfig() {
  try {
    const parsed = JSON.parse(readLS(CONFIG_KEY) || "null");
    if (parsed && typeof parsed.url === "string" && typeof parsed.token === "string") return parsed;
  } catch {
    /* 壊れていたら未設定扱い */
  }
  return null;
}

export function saveConfig(config) {
  writeLS(CONFIG_KEY, config ? JSON.stringify(config) : null);
}

/** 末尾スラッシュや /api の付け忘れ・付けすぎを吸収する。 */
export function normalizeUrl(raw) {
  let url = String(raw || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = "http://" + url;
  return url.replace(/\/+$/, "").replace(/\/api$/, "");
}

async function request(config, path, { method = "GET", body, signal } = {}) {
  const res = await fetch(normalizeUrl(config.url) + path, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 本文が無い場合もある */
  }

  if (!res.ok) {
    const err = new Error(json?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

export const fetchState = (config, signal) => request(config, "/api/state", { signal });

export const pushState = (config, state, signal) =>
  request(config, "/api/state", { method: "PUT", body: state, signal });

/** 接続設定画面から呼ぶ疎通確認。 */
export async function checkConnection(config) {
  const health = await fetch(normalizeUrl(config.url) + "/api/health").then((r) => r.json());
  const state = await fetchState(config);
  return { version: health.version, problems: state.problems.length, types: state.types.length };
}

/**
 * 2 つの状態が実質同じかを比べるための指紋。
 *
 * 件数だけでは、件数が同じで中身が違う場合を取りこぼす。
 * 配列の順序やサーバーが付ける項目に左右されないよう、id 順に並べて必要な項目だけ拾う。
 */
export function fingerprint(state) {
  const problems = [...(state.problems || [])]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((p) =>
      [
        p.id,
        p.level,
        p.unitId,
        p.title,
        p.difficulty,
        p.status,
        p.source || "",
        p.memo || "",
        [...(p.types || [])].sort().join("|"),
      ].join("")
    );

  const types = [...(state.types || [])]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((t) => [t.id, t.level, t.name, t.color].join(""));

  return JSON.stringify({ problems, types });
}

/**
 * サーバーとローカルを id で突き合わせて統合する。
 *
 * 同じ id が両方にあれば updatedAt が新しい方を採る。
 * 単一ユーザーなので削除の伝播までは追わず、和集合にする。
 * （消したつもりの問題が戻るより、消えたら困る問題が残る方を選ぶ）
 */
export function mergeState(local, remote) {
  const mergeById = (a = [], b = []) => {
    const out = new Map();
    for (const item of a) out.set(item.id, item);
    for (const item of b) {
      const existing = out.get(item.id);
      if (!existing) {
        out.set(item.id, item);
        continue;
      }
      const ta = existing.updatedAt ?? existing.createdAt ?? 0;
      const tb = item.updatedAt ?? item.createdAt ?? 0;
      if (tb > ta) out.set(item.id, item);
    }
    return [...out.values()];
  };

  return {
    problems: mergeById(remote.problems, local.problems),
    types: mergeById(remote.types, local.types),
    seededLevels: [...new Set([...(remote.seededLevels || []), ...(local.seededLevels || [])])],
  };
}

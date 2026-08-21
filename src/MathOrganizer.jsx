import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, ChevronLeft, Search, Trash2, Check, Layers, Tag, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { loadConfig, saveConfig, normalizeUrl, fetchState, pushState, checkConnection, mergeState } from "./api.js";

/* ===========================================================
   共通パレット・ステータス
=========================================================== */
const TYPE_PALETTE = [
  "#B5472A",
  "#2E7D5B",
  "#3A5FA8",
  "#A8842E",
  "#7B4B94",
  "#1F6F78",
  "#9A4C6B",
  "#5C7A29",
  "#4A5568",
  "#B5842A",
  "#6B4A9E",
  "#2B7A99",
  // 13色目以降：タイプ数が12を超えても色が重複しないよう濃色系を追加
  "#7A2F1B",
  "#1E5A3F",
  "#26407A",
  "#6E5518",
  "#52306B",
  "#14484F",
];

const STATUS = [
  { id: "todo", label: "未着手", color: "#9A9488" },
  { id: "learning", label: "学習中", color: "#B5842A" },
  { id: "review", label: "復習必要", color: "#B5472A" },
  { id: "mastered", label: "習得済み", color: "#2E7D5B" },
];
const statusOf = (id) => STATUS.find((s) => s.id === id) || STATUS[0];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ===========================================================
   レベル定義：中学受験（小学生）／高校受験（中学生）／大学受験（高校生）
=========================================================== */
const LEVELS = [
  {
    id: "chugakujuken",
    label: "中学受験",
    subLabel: "小学生・算数",
    curriculum: [
      {
        id: "cj-cat-num",
        name: "数の性質・計算",
        ink: "#B5472A",
        units: [
          { id: "cj-num", name: "数の性質" },
          { id: "cj-calc", name: "計算のくふう" },
        ],
      },
      {
        id: "cj-cat-ratio",
        name: "割合と比",
        ink: "#2E7D5B",
        units: [
          { id: "cj-ratio", name: "割合" },
          { id: "cj-hi", name: "比" },
        ],
      },
      {
        id: "cj-cat-speed",
        name: "速さ",
        ink: "#3A5FA8",
        units: [{ id: "cj-speed", name: "速さの文章題" }],
      },
      {
        id: "cj-cat-figure",
        name: "図形",
        ink: "#A8842E",
        units: [
          { id: "cj-plane", name: "平面図形" },
          { id: "cj-solid", name: "立体図形" },
        ],
      },
      {
        id: "cj-cat-word",
        name: "場合の数・文章題",
        ink: "#7B4B94",
        units: [
          { id: "cj-combi", name: "場合の数" },
          { id: "cj-word", name: "特殊算（文章題）" },
        ],
      },
    ],
    typeNames: [
      "つるかめ算",
      "旅人算",
      "通過算",
      "流水算",
      "時計算",
      "仕事算",
      "ニュートン算",
      "過不足算",
      "差集め算",
      "消去算",
      "年齢算",
      "相当算",
      "植木算",
      "図形の回転移動",
      "場合の数（樹形図）",
    ],
    typeIdPrefix: "ct",
    seedUnitMap: [
      "cj-word",
      "cj-speed",
      "cj-speed",
      "cj-speed",
      "cj-speed",
      "cj-word",
      "cj-word",
      "cj-word",
      "cj-word",
      "cj-word",
      "cj-word",
      "cj-ratio",
      "cj-word",
      "cj-plane",
      "cj-combi",
    ],
    seedTitles: [
      "つるとかめが合わせて10匹います。足の数の合計は32本のとき、つるは何羽いますか。",
      "兄は分速80m、弟は分速60mで、1400m離れた地点から向かい合って同時に出発しました。2人は何分後に出会いますか。",
      "長さ150mの列車が秒速20mで走っています。長さ450mの鉄橋を渡り始めてから渡り終わるまでに何秒かかりますか。",
      "静水での速さが時速18kmの船が、川を24km上るのに2時間かかりました。この川の流れの速さは時速何kmですか。",
      "3時から4時の間で、時計の長針と短針が重なるのは3時何分ですか。",
      "ある仕事をAさん1人ですると12日、Bさん1人ですると24日かかります。2人でこの仕事をすると何日で終わりますか。",
      "牧場の草を、牛5頭では6日で、牛4頭では10日で食べつくします。牛3頭では何日で食べつくしますか。草は毎日一定の割合で伸びるものとします。",
      "みかんを何人かの子どもに配ります。1人に4個ずつ配ると6個余り、1人に6個ずつ配ると2個たりません。子どもの人数を求めなさい。",
      "ノートを何人かの子どもに配ります。1人に5冊ずつ配ると3冊余り、1人に7冊ずつ配ると9冊たりません。子どもの人数を求めなさい。",
      "りんご3個とみかん5個で650円、りんご3個とみかん2個で470円です。みかん1個の値段を求めなさい。",
      "現在、父は42歳、子は12歳です。父の年齢が子の年齢の3倍になるのは何年後ですか。",
      "ある本を1日目に全体の1/3を読み、2日目に残りの1/4を読んだところ、60ページ残りました。この本は全部で何ページですか。",
      "長さ120mの道の片側に、はしからはしまで10mおきに木を植えます。木は何本必要ですか。",
      "半径1cmの円が、1辺6cmの正方形の外側を辺にそってすべることなく1周するとき、円の中心が動いた道のりを求めなさい。円周率は3.14とします。",
      "1,2,3,4の4枚のカードから3枚を選んで3けたの整数をつくるとき、何通りできますか。",
    ],
  },
  {
    id: "koukoujuken",
    label: "高校受験",
    subLabel: "中学生・数学",
    curriculum: [
      {
        id: "kj-cat-num",
        name: "数と式",
        ink: "#B5472A",
        units: [
          { id: "kj-neg", name: "正負の数" },
          { id: "kj-literal", name: "文字と式" },
        ],
      },
      {
        id: "kj-cat-eq",
        name: "方程式",
        ink: "#2E7D5B",
        units: [
          { id: "kj-linear_eq", name: "一次方程式" },
          { id: "kj-simul_eq", name: "連立方程式" },
          { id: "kj-quad_eq", name: "二次方程式" },
        ],
      },
      {
        id: "kj-cat-func",
        name: "関数",
        ink: "#3A5FA8",
        units: [
          { id: "kj-prop", name: "比例・反比例" },
          { id: "kj-linear_func", name: "一次関数" },
          { id: "kj-quad_func", name: "二次関数（y=ax²）" },
        ],
      },
      {
        id: "kj-cat-geo",
        name: "図形",
        ink: "#A8842E",
        units: [
          { id: "kj-plane_geo", name: "平面図形" },
          { id: "kj-similar", name: "相似" },
          { id: "kj-circle", name: "円の性質" },
          { id: "kj-pythagorean", name: "三平方の定理" },
          { id: "kj-solid_geo", name: "空間図形" },
        ],
      },
      {
        id: "kj-cat-data",
        name: "データの活用",
        ink: "#7B4B94",
        units: [{ id: "kj-data", name: "確率・統計" }],
      },
    ],
    typeNames: [
      "文章題（方程式の利用）",
      "速さ・割合の文章題",
      "図形の証明",
      "相似の利用",
      "三平方の定理の利用",
      "関数と図形の融合",
      "確率の数え上げ",
      "規則性の発見",
      "動点問題",
      "場合分け",
    ],
    typeIdPrefix: "ht",
    seedUnitMap: [
      "kj-linear_eq",
      "kj-simul_eq",
      "kj-plane_geo",
      "kj-similar",
      "kj-pythagorean",
      "kj-quad_func",
      "kj-data",
      "kj-literal",
      "kj-linear_func",
      "kj-quad_func",
    ],
    seedTitles: [
      "ある数の3倍に5を加えると、その数の5倍から7を引いた数に等しくなります。ある数を求めなさい。",
      "生徒会のアンケートで、賛成と反対の人数の比は3:2でした。賛成が反対より15人多いとき、賛成と反対それぞれの人数を求めなさい。",
      "平行四辺形ABCDにおいて、対角線ACとBDの交点をOとするとき、AO=CO であることを証明しなさい。",
      "△ABCの辺AB上に点D、辺AC上に点Eをとり、DE//BCとする。AD:DB=2:3のとき、DEとBCの長さの比を求めなさい。",
      "直角をはさむ2辺の長さが6cmと8cmの直角三角形について、斜辺の長さを求めなさい。",
      "関数 y=x² のグラフ上に2点A(-1,1), B(2,4)がある。直線ABの式を求めなさい。",
      "大小2つのさいころを同時に投げるとき、出た目の和が7になる確率を求めなさい。",
      "1, 4, 9, 16, 25, … のように並ぶ数の、10番目の数を求めなさい。",
      "1辺が6cmの正方形ABCDの辺上を、点PがAからBまで秒速1cmで動くとき、x秒後の△APDの面積をxの式で表しなさい。",
      "関数 y=ax² について、xの変域が -2≦x≦3 のときのyの変域を、a>0 の場合と a<0 の場合に分けて求めなさい。",
    ],
  },
  {
    id: "daigakujuken",
    label: "大学受験",
    subLabel: "高校生・数学",
    curriculum: [
      {
        id: "I",
        name: "数学I",
        ink: "#B5472A",
        units: [
          { id: "I-1", name: "数と式" },
          { id: "I-2", name: "2次関数" },
          { id: "I-3", name: "図形と計量" },
          { id: "I-4", name: "データの分析" },
        ],
      },
      {
        id: "A",
        name: "数学A",
        ink: "#2E7D5B",
        units: [
          { id: "A-1", name: "場合の数と確率" },
          { id: "A-2", name: "整数の性質" },
          { id: "A-3", name: "図形の性質" },
        ],
      },
      {
        id: "II",
        name: "数学II",
        ink: "#3A5FA8",
        units: [
          { id: "II-1", name: "式と証明" },
          { id: "II-2", name: "複素数と方程式" },
          { id: "II-3", name: "図形と方程式" },
          { id: "II-4", name: "三角関数" },
          { id: "II-5", name: "指数関数・対数関数" },
          { id: "II-6", name: "微分法・積分法" },
        ],
      },
      {
        id: "B",
        name: "数学B",
        ink: "#A8842E",
        units: [
          { id: "B-1", name: "数列" },
          { id: "B-2", name: "統計的な推測" },
        ],
      },
      {
        id: "C",
        name: "数学C",
        ink: "#7B4B94",
        units: [
          { id: "C-1", name: "ベクトル" },
          { id: "C-2", name: "平面上の曲線と複素数平面" },
        ],
      },
      {
        id: "III",
        name: "数学III",
        ink: "#1F6F78",
        units: [
          { id: "III-1", name: "極限" },
          { id: "III-2", name: "微分法" },
          { id: "III-3", name: "積分法" },
        ],
      },
    ],
    typeNames: [
      "最大最小問題",
      "定数分離",
      "場合分け",
      "存在条件・成立条件",
      "領域・通過範囲",
      "軌跡",
      "漸化式",
      "数学的帰納法",
      "確率漸化式",
      "整数問題（不定方程式）",
      "接線・法線",
      "面積・体積",
      "極限の計算",
      "図形の証明",
      "対称性・置き換え",
    ],
    typeIdPrefix: "t",
    seedUnitMap: [
      "I-2",
      "II-6",
      "I-2",
      "I-2",
      "II-3",
      "II-3",
      "B-1",
      "B-1",
      "A-1",
      "A-2",
      "II-6",
      "II-6",
      "III-1",
      "A-3",
      "I-1",
    ],
    seedTitles: [
      "y=x²-4x+3 (0≤x≤3) の最大値・最小値を求めよ",
      "方程式 x³-3x=a の異なる実数解の個数を、aの値で分類せよ",
      "y=x²-2ax+1 (0≤x≤2) の最小値を、aの値で場合分けして求めよ",
      "すべての実数xに対して x²+ax+a>0 が成り立つような定数aの範囲を求めよ",
      "点(x, y)が円 x²+y²=1 上を動くとき、x+y のとり得る値の範囲を求めよ",
      "2点A(0,0), B(4,0)からの距離の比が AP:BP=1:2 である点Pの軌跡を求めよ",
      "a₁=1, a(n+1)=2a(n)+1 で定まる数列{a(n)}の一般項を求めよ",
      "すべての自然数nについて 1+2+…+n=n(n+1)/2 が成り立つことを数学的帰納法で証明せよ",
      "さいころをn回投げるとき、出た目の和が3の倍数になる確率を漸化式を用いて求めよ",
      "3x+5y=1 を満たす整数x, yの組をすべて求めよ",
      "曲線 y=x² 上の点(1,1)における接線の方程式を求めよ",
      "曲線 y=x² と直線 y=x で囲まれた部分の面積を求めよ",
      "lim(x→0) (sin x)/x の値を求めよ",
      "三角形の内角の二等分線が対辺を分ける比について成り立つ性質を証明せよ",
      "x+y=3, xy=1 のとき、x³+y³ の値を対称式の置き換えを用いて求めよ",
    ],
  },
];

const getLevel = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];

const SEEDED_KEY = "math-seeded-levels";

function unitsFlat(level) {
  return level.curriculum.flatMap((cat) =>
    cat.units.map((u) => ({ ...u, categoryId: cat.id, categoryName: cat.name, ink: cat.ink }))
  );
}

function defaultTypesForLevel(level) {
  return level.typeNames.map((name, i) => ({
    id: level.typeIdPrefix + "-" + i,
    name,
    color: TYPE_PALETTE[i % TYPE_PALETTE.length],
    level: level.id,
  }));
}

function buildSeedProblemsForLevel(level, levelTypes) {
  // 保存済みタイプが並び替え・削除されていてもよいよう、
  // インデックスではなくタイプ名で紐づける（該当なしならタグ無しで登録）
  const idByName = new Map(levelTypes.map((t) => [t.name, t.id]));
  return level.seedTitles.map((title, i) => {
    const typeId = idByName.get(level.typeNames[i]);
    return {
      id: "seed-" + level.id + "-" + i,
      level: level.id,
      unitId: level.seedUnitMap[i],
      types: typeId ? [typeId] : [],
      title,
      difficulty: 2,
      status: "todo",
      source: "入試基礎",
      memo: "",
      createdAt: Date.now() + i,
      updatedAt: Date.now() + i,
    };
  });
}

/* ===========================================================
   Storage helpers（個人データ）
=========================================================== */
// window.storage が無い環境（通常のブラウザ／プレビュー）でも保存できるよう多段フォールバック
const memoryStore = new Map();
const hasHostStorage = () =>
  typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";
const hasLocalStorage = () => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
};

async function loadJSON(key, fallback) {
  try {
    if (hasHostStorage()) {
      const res = await window.storage.get(key, false);
      return res && res.value ? JSON.parse(res.value) : fallback;
    }
    const raw = hasLocalStorage() ? window.localStorage.getItem(key) : memoryStore.get(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
async function saveJSON(key, value) {
  const json = JSON.stringify(value);
  try {
    if (hasHostStorage()) {
      await window.storage.set(key, json, false);
      return;
    }
    if (hasLocalStorage()) {
      window.localStorage.setItem(key, json);
      return;
    }
    memoryStore.set(key, json);
  } catch {
    memoryStore.set(key, json);
  }
}

/* ===========================================================
   小さな部品
=========================================================== */
function ProgressRing({ ratio, color, size = 40 }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - ratio);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4DFD3" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

function Stars({ value, onChange, size = 16 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => onChange && onChange(n)}
          style={{
            cursor: onChange ? "pointer" : "default",
            fontSize: size,
            color: n <= value ? "#B5472A" : "#DCD5C4",
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

/* ===========================================================
   メインアプリ
=========================================================== */
export default function MathOrganizer() {
  const [problems, setProblems] = useState([]);
  const [types, setTypes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [levelId, setLevelId] = useState("daigakujuken");
  const [homeTab, setHomeTab] = useState("unit");
  const [view, setView] = useState({ screen: "home" });
  const [modal, setModal] = useState(null);
  const [typeModal, setTypeModal] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const fontsInjected = useRef(false);

  // ---- サーバー同期 ----
  const [serverConfig, setServerConfig] = useState(() => loadConfig());
  const [syncModal, setSyncModal] = useState(null);
  // idle | syncing | synced | error
  const [sync, setSync] = useState({ state: "idle", message: "", at: 0 });
  const versionRef = useRef(null); // サーバーの最新 version（楽観ロック用）
  const pushTimer = useRef(null);
  const skipNextPush = useRef(false); // サーバーから来た値をそのまま返さない

  const level = getLevel(levelId);
  const levelUnits = useMemo(() => unitsFlat(level), [level]);
  const levelTypes = useMemo(() => types.filter((t) => t.level === levelId), [types, levelId]);
  const levelProblems = useMemo(() => problems.filter((p) => p.level === levelId), [problems, levelId]);

  useEffect(() => {
    if (fontsInjected.current) return;
    fontsInjected.current = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    (async () => {
      let p = await loadJSON("math-problems", []);
      let t = await loadJSON("math-problem-types", []);
      const seeded = await loadJSON(SEEDED_KEY, []);

      p = p.map((x) => (x.level ? x : { ...x, level: "daigakujuken" }));
      t = t.map((x) => (x.level ? x : { ...x, level: "daigakujuken" }));

      LEVELS.forEach((lv) => {
        // 初期投入済みのレベルは、ユーザーが消した内容を復活させない
        if (seeded.includes(lv.id)) return;

        let lvTypes = t.filter((x) => x.level === lv.id);
        if (lvTypes.length === 0) {
          lvTypes = defaultTypesForLevel(lv);
          t = [...t, ...lvTypes];
        }
        if (!p.some((x) => x.level === lv.id)) {
          p = [...p, ...buildSeedProblemsForLevel(lv, lvTypes)];
        }
      });

      setProblems(p);
      setTypes(t);
      setLoaded(true);
      saveJSON(SEEDED_KEY, LEVELS.map((lv) => lv.id));
    })();
  }, []);

  useEffect(() => {
    if (!modal && !typeModal) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setModal(null);
        setTypeModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, typeModal]);

  useEffect(() => {
    if (!loaded) return;
    saveJSON("math-problems", problems);
  }, [problems, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveJSON("math-problem-types", types);
  }, [types, loaded]);

  // 起動時（と接続先変更時）に一度サーバーと突き合わせる
  useEffect(() => {
    if (!loaded || !serverConfig) {
      versionRef.current = null;
      return;
    }
    const ac = new AbortController();

    (async () => {
      setSync({ state: "syncing", message: "サーバーと同期中", at: Date.now() });
      try {
        const remote = await fetchState(serverConfig, ac.signal);
        const local = { problems, types, seededLevels: LEVELS.map((lv) => lv.id) };
        const merged = mergeState(local, remote);
        versionRef.current = remote.version;

        const changed =
          merged.problems.length !== remote.problems.length || merged.types.length !== remote.types.length;

        if (changed) {
          const saved = await pushState(serverConfig, { ...merged, version: remote.version }, ac.signal);
          versionRef.current = saved.version;
        }

        skipNextPush.current = true;
        setProblems(merged.problems);
        setTypes(merged.types);
        setSync({ state: "synced", message: "同期しました", at: Date.now() });
      } catch (err) {
        if (ac.signal.aborted) return;
        setSync({ state: "error", message: err.message || "同期に失敗しました", at: Date.now() });
      }
    })();

    return () => ac.abort();
    // problems/types を依存に入れるとループするので、接続先が変わったときだけ走らせる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, serverConfig]);

  // 変更をまとめてサーバーへ送る（入力のたびに叩かないよう遅延させる）
  useEffect(() => {
    if (!loaded || !serverConfig) return;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }

    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      setSync({ state: "syncing", message: "保存中", at: Date.now() });
      const body = {
        problems,
        types,
        seededLevels: LEVELS.map((lv) => lv.id),
        version: versionRef.current ?? undefined,
      };
      try {
        const saved = await pushState(serverConfig, body);
        versionRef.current = saved.version;
        setSync({ state: "synced", message: "保存しました", at: Date.now() });
      } catch (err) {
        if (err.status === 409 && err.payload?.state) {
          // 別端末が先に書いていた。統合してから version 指定なしで上書きする。
          try {
            const merged = mergeState({ problems, types, seededLevels: [] }, err.payload.state);
            const saved = await pushState(serverConfig, merged);
            versionRef.current = saved.version;
            skipNextPush.current = true;
            setProblems(merged.problems);
            setTypes(merged.types);
            setSync({ state: "synced", message: "他の端末の変更と統合しました", at: Date.now() });
            return;
          } catch (retryErr) {
            setSync({ state: "error", message: retryErr.message, at: Date.now() });
            return;
          }
        }
        setSync({ state: "error", message: err.message || "保存に失敗しました", at: Date.now() });
      }
    }, 800);

    return () => clearTimeout(pushTimer.current);
  }, [problems, types, loaded, serverConfig]);

  const applyServerConfig = (config) => {
    saveConfig(config);
    setServerConfig(config);
    setSyncModal(null);
    if (!config) setSync({ state: "idle", message: "", at: 0 });
  };

  const stats = useMemo(() => {
    const total = levelProblems.length;
    const mastered = levelProblems.filter((p) => p.status === "mastered").length;
    return { total, mastered, ratio: total ? mastered / total : 0 };
  }, [levelProblems]);

  const unitStats = (unitId) => {
    const list = levelProblems.filter((p) => p.unitId === unitId);
    const mastered = list.filter((p) => p.status === "mastered").length;
    return { count: list.length, ratio: list.length ? mastered / list.length : 0 };
  };

  const typeStats = (typeId) => {
    const list = levelProblems.filter((p) => (p.types || []).includes(typeId));
    const mastered = list.filter((p) => p.status === "mastered").length;
    return { count: list.length, ratio: list.length ? mastered / list.length : 0 };
  };

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    return levelProblems.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.source || "").toLowerCase().includes(q) ||
        (p.memo || "").toLowerCase().includes(q)
    );
  }, [search, levelProblems]);

  const changeLevel = (id) => {
    setLevelId(id);
    setHomeTab("unit");
    setSearch("");
    setStatusFilter("all");
    setView({ screen: "home" });
  };

  // 別グループへ移動したときに前の絞り込みが残らないようリセットする
  const openGroup = (next) => {
    setStatusFilter("all");
    setView(next);
  };

  const openAdd = (presetUnitId, presetTypeId) =>
    setModal({ mode: "add", draft: emptyDraft(levelId, presetUnitId, presetTypeId ? [presetTypeId] : []) });
  const openEdit = (problem) => setModal({ mode: "edit", draft: { ...problem, types: problem.types || [] } });
  const closeModal = () => setModal(null);

  const submitModal = () => {
    if (!modal) return;
    const d = modal.draft;
    if (!d.title || !d.title.trim() || !d.unitId) return;
    const now = Date.now();
    if (modal.mode === "add") {
      setProblems((prev) => [...prev, { ...d, id: uid(), createdAt: now, updatedAt: now }]);
    } else {
      // updatedAt は端末間の統合で「新しい方を採る」判定に使う
      setProblems((prev) => prev.map((p) => (p.id === d.id ? { ...d, updatedAt: now } : p)));
    }
    closeModal();
  };

  const deleteProblem = (id) => {
    setProblems((prev) => prev.filter((p) => p.id !== id));
    closeModal();
  };

  const addType = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const t = {
      id: uid(),
      name: trimmed,
      color: TYPE_PALETTE[levelTypes.length % TYPE_PALETTE.length],
      level: levelId,
      updatedAt: Date.now(),
    };
    setTypes((prev) => [...prev, t]);
    setTypeModal(null);
    openGroup({ screen: "type", typeId: t.id });
  };

  const deleteType = (typeId) => {
    setTypes((prev) => prev.filter((t) => t.id !== typeId));
    setProblems((prev) => prev.map((p) => ({ ...p, types: (p.types || []).filter((id) => id !== typeId) })));
    setView({ screen: "home" });
  };

  return (
    <div
      style={{
        fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', YuGothic, sans-serif",
        color: "#2B2620",
        minHeight: "100vh",
        // 複数レイヤーの background 短縮記法では色は最終レイヤーにしか置けず、
        // 先頭に置くと宣言ごと無効になるため color と image を分ける
        backgroundColor: "#FAF8F2",
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 23px, #EDE7D8 24px), repeating-linear-gradient(90deg, transparent, transparent 23px, #EDE7D8 24px)",
        maxWidth: 480,
        margin: "0 auto",
        paddingBottom: 40,
        position: "relative",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        input, textarea, select, button { font-family: inherit; }
        input::placeholder, textarea::placeholder { color: #B3AC9B; }
        button { -webkit-tap-highlight-color: transparent; }
        select { -webkit-appearance: none; appearance: none; }
        select:disabled { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      `}</style>

      {view.screen === "home" && (
        <HomeScreen
          level={level}
          levelUnits={levelUnits}
          levelTypes={levelTypes}
          stats={stats}
          search={search}
          setSearch={setSearch}
          searchResults={searchResults}
          homeTab={homeTab}
          setHomeTab={setHomeTab}
          unitStats={unitStats}
          typeStats={typeStats}
          onChangeLevel={changeLevel}
          onOpenUnit={(unitId) => openGroup({ screen: "unit", unitId })}
          onOpenType={(typeId) => openGroup({ screen: "type", typeId })}
          onOpenProblem={openEdit}
          onOpenAddType={() => setTypeModal({ name: "" })}
          onOpenAddProblem={() => openAdd(null, null)}
          sync={sync}
          connected={!!serverConfig}
          onOpenSync={() => setSyncModal({ url: serverConfig?.url || "", token: serverConfig?.token || "" })}
        />
      )}

      {view.screen === "unit" && (
        <GroupScreen
          kind="unit"
          title={levelUnits.find((u) => u.id === view.unitId)?.name}
          subtitle={levelUnits.find((u) => u.id === view.unitId)?.categoryName}
          accent={levelUnits.find((u) => u.id === view.unitId)?.ink}
          problems={levelProblems.filter((p) => p.unitId === view.unitId)}
          levelUnits={levelUnits}
          levelTypes={levelTypes}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onBack={() => setView({ screen: "home" })}
          onAdd={() => openAdd(view.unitId, null)}
          onEdit={openEdit}
        />
      )}

      {view.screen === "type" && (
        <GroupScreen
          kind="type"
          title={levelTypes.find((t) => t.id === view.typeId)?.name}
          subtitle="問題タイプ"
          accent={levelTypes.find((t) => t.id === view.typeId)?.color}
          problems={levelProblems.filter((p) => (p.types || []).includes(view.typeId))}
          levelUnits={levelUnits}
          levelTypes={levelTypes}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onBack={() => setView({ screen: "home" })}
          onAdd={() => openAdd(null, view.typeId)}
          onEdit={openEdit}
          onDeleteGroup={() => deleteType(view.typeId)}
        />
      )}

      {modal && (
        <ProblemModal
          modal={modal}
          setModal={setModal}
          levelUnits={levelUnits}
          levelTypes={levelTypes}
          level={level}
          onClose={closeModal}
          onSubmit={submitModal}
          onDelete={deleteProblem}
        />
      )}

      {typeModal && <AddTypeModal typeModal={typeModal} setTypeModal={setTypeModal} onSubmit={addType} onClose={() => setTypeModal(null)} />}

      {syncModal && (
        <SyncModal
          draft={syncModal}
          setDraft={setSyncModal}
          connected={!!serverConfig}
          onApply={applyServerConfig}
          onClose={() => setSyncModal(null)}
        />
      )}
    </div>
  );
}

function emptyDraft(level, unitId, types) {
  return {
    level,
    unitId: unitId || "",
    types: types || [],
    title: "",
    difficulty: 3,
    status: "todo",
    source: "",
    memo: "",
  };
}

/* ===========================================================
   ホーム画面
=========================================================== */
function HomeScreen({
  level,
  levelUnits,
  levelTypes,
  stats,
  search,
  setSearch,
  searchResults,
  homeTab,
  setHomeTab,
  unitStats,
  typeStats,
  onChangeLevel,
  onOpenUnit,
  onOpenType,
  onOpenProblem,
  onOpenAddType,
  onOpenAddProblem,
  sync,
  connected,
  onOpenSync,
}) {
  return (
    <div style={{ padding: "28px 18px 100px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div
            style={{
              fontFamily: "'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, serif",
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: "0.03em",
              color: "#2B2620",
            }}
          >
            問題帳
          </div>
          <div style={{ fontSize: 12.5, color: "#8A8371", marginTop: 4, letterSpacing: "0.02em" }}>
            {level.label}（{level.subLabel}） &middot; 単元別 / タイプ別 索引
          </div>
        </div>
        <SyncBadge sync={sync} connected={connected} onClick={onOpenSync} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", paddingBottom: 2 }}>
        {LEVELS.map((lv) => (
          <button
            key={lv.id}
            onClick={() => onChangeLevel(lv.id)}
            style={{
              flexShrink: 0,
              fontSize: 12.5,
              padding: "8px 14px",
              borderRadius: 20,
              border: `1px solid ${lv.id === level.id ? "#2B2620" : "#E7E1D2"}`,
              background: lv.id === level.id ? "#2B2620" : "#FFFFFF",
              color: lv.id === level.id ? "#FFFFFF" : "#6B6656",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {lv.label}
            <span style={{ fontSize: 10.5, opacity: 0.75, marginLeft: 4 }}>{lv.subLabel}</span>
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "#FFFFFF",
          border: "1px solid #E7E1D2",
          borderRadius: 4,
          padding: "14px 16px",
          marginBottom: 20,
        }}
      >
        <ProgressRing ratio={stats.ratio} color="#2E7D5B" size={48} />
        <div>
          <div style={{ fontSize: 13, color: "#8A8371" }}>登録問題数</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, serif" }}>
            {stats.total}
            <span style={{ fontSize: 12, color: "#8A8371", fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', YuGothic, sans-serif" }}> 問</span>
            <span style={{ fontSize: 12, color: "#2E7D5B", marginLeft: 10 }}>習得 {stats.mastered}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#FFFFFF",
          border: "1px solid #E7E1D2",
          borderRadius: 4,
          padding: "9px 12px",
          marginBottom: 18,
        }}
      >
        <Search size={16} color="#B3AC9B" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="問題名・出典・メモで検索"
          style={{ border: "none", outline: "none", flex: 1, fontSize: 14, background: "transparent" }}
        />
        {search && <X size={15} color="#B3AC9B" style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
      </div>

      {searchResults ? (
        <div>
          <div style={{ fontSize: 12.5, color: "#8A8371", marginBottom: 10 }}>{searchResults.length} 件ヒット</div>
          {searchResults.length === 0 && (
            <div style={{ fontSize: 13.5, color: "#B3AC9B", padding: "20px 4px" }}>一致する問題が見つかりません。</div>
          )}
          {searchResults.map((p) => {
            const unit = levelUnits.find((u) => u.id === p.unitId);
            return (
              <ProblemRow key={p.id} problem={p} unit={unit} types={levelTypes} onClick={() => onOpenProblem(p)} showUnit showTypes />
            );
          })}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", background: "#EFE9DA", borderRadius: 24, padding: 3, marginBottom: 20 }}>
            <TabButton active={homeTab === "unit"} onClick={() => setHomeTab("unit")} icon={<Layers size={14} />} label="単元別" />
            <TabButton active={homeTab === "type"} onClick={() => setHomeTab("type")} icon={<Tag size={14} />} label="タイプ別" />
          </div>

          {homeTab === "unit" ? (
            <div>
              {level.curriculum.map((cat) => (
                <div key={cat.id} style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: cat.ink }} />
                    <div style={{ fontFamily: "'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, serif", fontWeight: 700, fontSize: 15.5, color: cat.ink }}>
                      {cat.name}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {cat.units.map((u) => {
                      const s = unitStats(u.id);
                      return (
                        <GroupCard key={u.id} label={u.name} count={s.count} ratio={s.ratio} accent={cat.ink} onClick={() => onOpenUnit(u.id)} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 12, lineHeight: 1.6 }}>
                単元をまたぐ解法パターンでまとめます。同じテクニックの問題だけを集めて演習できます。
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {levelTypes.map((t) => {
                  const s = typeStats(t.id);
                  return <GroupCard key={t.id} label={t.name} count={s.count} ratio={s.ratio} accent={t.color} onClick={() => onOpenType(t.id)} />;
                })}
                <button
                  onClick={onOpenAddType}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    border: "1px dashed #C9C2AE",
                    borderRadius: 3,
                    padding: "11px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    color: "#8A8371",
                    fontSize: 12.5,
                    minHeight: 78,
                  }}
                >
                  <Plus size={15} />
                  新しいタイプ
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <button
        onClick={onOpenAddProblem}
        aria-label="問題を追加"
        style={{
          position: "fixed",
          bottom: 26,
          right: "max(22px, calc(50% - 240px + 22px))",
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: "#2B2620",
          color: "#fff",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          cursor: "pointer",
        }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

/** 同期状態。押すと接続設定が開く。 */
function SyncBadge({ sync, connected, onClick }) {
  const look = !connected
    ? { icon: <CloudOff size={13} />, label: "この端末のみ", color: "#8A8371", border: "#E7E1D2" }
    : sync.state === "error"
    ? { icon: <CloudOff size={13} />, label: "同期エラー", color: "#B5472A", border: "#EBC9BC" }
    : sync.state === "syncing"
    ? { icon: <RefreshCw size={13} />, label: "同期中", color: "#B5842A", border: "#E7DCC0" }
    : { icon: <Cloud size={13} />, label: "同期済み", color: "#2E7D5B", border: "#CFE0D6" };

  return (
    <button
      onClick={onClick}
      title={sync.message || (connected ? "サーバーと同期しています" : "サーバーに接続していません")}
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        padding: "6px 10px",
        borderRadius: 20,
        border: `1px solid ${look.border}`,
        background: "#FFFFFF",
        color: look.color,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {look.icon}
      {look.label}
    </button>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        border: "none",
        borderRadius: 20,
        padding: "9px 0",
        fontSize: 13,
        fontWeight: 500,
        background: active ? "#FFFFFF" : "transparent",
        color: active ? "#2B2620" : "#8A8371",
        cursor: "pointer",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function GroupCard({ label, count, ratio, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: "#FFFFFF",
        border: "1px solid #E7E1D2",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 3,
        padding: "11px 12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35, minHeight: 34 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, color: "#8A8371" }}>{count} 問</span>
        <ProgressRing ratio={ratio} color={accent} size={26} />
      </div>
    </button>
  );
}

function ProblemRow({ problem, unit, types, onClick, showUnit, showTypes }) {
  const st = statusOf(problem.status);
  const tagObjs = showTypes ? (problem.types || []).map((id) => types.find((t) => t.id === id)).filter(Boolean) : [];
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        textAlign: "left",
        background: "#FFFFFF",
        border: "1px solid #E7E1D2",
        borderRadius: 3,
        padding: "10px 12px",
        marginBottom: 8,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {problem.title}
          </div>
          <div style={{ fontSize: 11, color: "#8A8371", marginTop: 2 }}>
            {showUnit && unit ? `${unit.name} ・ ` : ""}
            {st.label}
            {problem.source ? ` ・ ${problem.source}` : ""}
          </div>
        </div>
        <Stars value={problem.difficulty} size={11} />
      </div>
      {tagObjs.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", paddingLeft: 17 }}>
          {tagObjs.map((t) => (
            <span key={t.id} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: t.color + "1A", color: t.color }}>
              {t.name}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/* ===========================================================
   グループ詳細画面（単元 or タイプ 共通）
=========================================================== */
function GroupScreen({ kind, title, subtitle, accent, problems, levelUnits, levelTypes, statusFilter, setStatusFilter, onBack, onAdd, onEdit, onDeleteGroup }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const filtered = statusFilter === "all" ? problems : problems.filter((p) => p.status === statusFilter);
  return (
    <div style={{ padding: "18px 18px 90px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: "none",
            border: "none",
            color: accent || "#2B2620",
            fontSize: 13.5,
            cursor: "pointer",
            padding: "6px 4px 6px 0",
          }}
        >
          <ChevronLeft size={16} />
          {kind === "unit" ? "単元マップ" : "タイプ別索引"}
        </button>
        {kind === "type" && !confirmDelete && (
          <button onClick={() => setConfirmDelete(true)} style={{ background: "none", border: "none", color: "#B3AC9B", cursor: "pointer", padding: 6 }}>
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {confirmDelete && (
        <div style={{ background: "#FFF6F3", border: "1px solid #EBC9BC", borderRadius: 4, padding: "10px 12px", marginBottom: 14, fontSize: 12.5, color: "#7A3320" }}>
          このタイプを削除しますか？問題自体は残りますが、タグは外れます。
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={onDeleteGroup} style={{ background: "#B5472A", color: "#fff", border: "none", borderRadius: 4, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
              削除する
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ background: "#fff", color: "#6B6656", border: "1px solid #E7E1D2", borderRadius: 4, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div style={{ fontFamily: "'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, serif", fontWeight: 700, fontSize: 22, color: accent || "#2B2620", marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 16 }}>{subtitle}</div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
        <FilterChip active={statusFilter === "all"} label={`すべて ${problems.length}`} onClick={() => setStatusFilter("all")} />
        {STATUS.map((s) => (
          <FilterChip key={s.id} active={statusFilter === s.id} label={`${s.label} ${problems.filter((p) => p.status === s.id).length}`} color={s.color} onClick={() => setStatusFilter(s.id)} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ fontSize: 13.5, color: "#B3AC9B", padding: "30px 4px", textAlign: "center" }}>
          {problems.length === 0 ? "まだ問題が登録されていません。右下の + から追加できます。" : "該当する問題がありません。"}
        </div>
      ) : (
        filtered.map((p) => (
          <ProblemRow
            key={p.id}
            problem={p}
            unit={kind === "type" ? levelUnits.find((u) => u.id === p.unitId) : undefined}
            types={levelTypes}
            onClick={() => onEdit(p)}
            showUnit={kind === "type"}
            showTypes={kind === "unit"}
          />
        ))
      )}

      <button
        onClick={onAdd}
        aria-label="問題を追加"
        style={{
          position: "fixed",
          bottom: 26,
          right: "max(22px, calc(50% - 240px + 22px))",
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: accent || "#2B2620",
          color: "#fff",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
          cursor: "pointer",
        }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

function FilterChip({ active, label, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        fontSize: 12,
        padding: "6px 12px",
        borderRadius: 20,
        border: `1px solid ${active ? color || "#2B2620" : "#E7E1D2"}`,
        background: active ? color || "#2B2620" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#6B6656",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

/* ===========================================================
   問題追加・編集モーダル
=========================================================== */
function ProblemModal({ modal, setModal, levelUnits, levelTypes, level, onClose, onSubmit, onDelete }) {
  const { draft, mode } = modal;
  const update = (patch) => setModal({ ...modal, draft: { ...draft, ...patch } });
  const toggleType = (id) => {
    const cur = draft.types || [];
    update({ types: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  const canSubmit = draft.title.trim() && draft.unitId;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.42)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: "#FAF8F2", borderRadius: "14px 14px 0 0", padding: "18px 20px 26px", maxHeight: "88vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, serif", fontWeight: 700, fontSize: 17 }}>{mode === "add" ? "問題を追加" : "問題を編集"}</div>
            <div style={{ fontSize: 11, color: "#8A8371", marginTop: 2 }}>
              {level.label}（{level.subLabel}）
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
            <X size={18} color="#8A8371" />
          </button>
        </div>

        <Field label="問題名 / 内容">
          <input autoFocus value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder="例）2次関数の最大最小（場合分け）" style={inputStyle} />
        </Field>

        <Field label="所属単元">
          <select value={draft.unitId} onChange={(e) => update({ unitId: e.target.value })} style={selectStyle}>
            <option value="">選択してください</option>
            {level.curriculum.map((cat) => (
              <optgroup key={cat.id} label={cat.name}>
                {cat.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label="問題タイプ（複数選択可・任意）">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {levelTypes.map((t) => {
              const active = (draft.types || []).includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleType(t.id)}
                  style={{
                    fontSize: 12,
                    padding: "6px 11px",
                    borderRadius: 20,
                    border: `1px solid ${active ? t.color : "#E7E1D2"}`,
                    background: active ? t.color : "#FFFFFF",
                    color: active ? "#FFFFFF" : "#6B6656",
                    cursor: "pointer",
                  }}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="難易度">
          <Stars value={draft.difficulty} onChange={(n) => update({ difficulty: n })} size={22} />
        </Field>

        <Field label="習熟度">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUS.map((s) => (
              <button
                key={s.id}
                onClick={() => update({ status: s.id })}
                style={{
                  fontSize: 12.5,
                  padding: "7px 13px",
                  borderRadius: 20,
                  border: `1px solid ${draft.status === s.id ? s.color : "#E7E1D2"}`,
                  background: draft.status === s.id ? s.color : "#FFFFFF",
                  color: draft.status === s.id ? "#FFFFFF" : "#6B6656",
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="出典（任意）">
          <input value={draft.source} onChange={(e) => update({ source: e.target.value })} placeholder="例）予シリ p.84 / 2023 〇〇中" style={inputStyle} />
        </Field>

        <Field label="メモ（任意）">
          <textarea value={draft.memo} onChange={(e) => update({ memo: e.target.value })} placeholder="つまずいたポイントや解法の要点など" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          {mode === "edit" && (
            <button
              onClick={() => onDelete(draft.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", border: "1px solid #E7E1D2", background: "#FFFFFF", color: "#B5472A", borderRadius: 4, padding: "11px 16px", fontSize: 13, cursor: "pointer" }}
            >
              <Trash2 size={15} />
              削除
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              justifyContent: "center",
              border: "none",
              background: canSubmit ? "#2B2620" : "#D8D2C2",
              color: "#FFFFFF",
              borderRadius: 4,
              padding: "12px 16px",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            <Check size={15} />
            {mode === "add" ? "追加する" : "保存する"}
          </button>
        </div>
        {!draft.unitId && <div style={{ fontSize: 11, color: "#B5472A", marginTop: 8 }}>※ 所属単元の選択が必要です</div>}
      </div>
    </div>
  );
}

/* ===========================================================
   タイプ追加モーダル
=========================================================== */
function AddTypeModal({ typeModal, setTypeModal, onSubmit, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.42)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#FAF8F2", borderRadius: "14px 14px 0 0", padding: "18px 20px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, serif", fontWeight: 700, fontSize: 17 }}>新しい問題タイプ</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
            <X size={18} color="#8A8371" />
          </button>
        </div>
        <Field label="タイプ名">
          <input
            autoFocus
            value={typeModal.name}
            onChange={(e) => setTypeModal({ name: e.target.value })}
            placeholder="例）不等式の証明"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit(typeModal.name);
            }}
          />
        </Field>
        <button
          onClick={() => onSubmit(typeModal.name)}
          disabled={!typeModal.name.trim()}
          style={{
            width: "100%",
            border: "none",
            background: typeModal.name.trim() ? "#2B2620" : "#D8D2C2",
            color: "#FFFFFF",
            borderRadius: 4,
            padding: "12px 16px",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: typeModal.name.trim() ? "pointer" : "not-allowed",
            marginTop: 6,
          }}
        >
          追加する
        </button>
      </div>
    </div>
  );
}

/* ===========================================================
   接続設定モーダル
=========================================================== */
function SyncModal({ draft, setDraft, connected, onApply, onClose }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const canApply = draft.url.trim() && draft.token.trim();

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const info = await checkConnection({ url: draft.url, token: draft.token });
      setResult({
        ok: true,
        text: `つながりました。サーバー側に問題 ${info.problems} 件・タイプ ${info.types} 件（version ${info.version}）`,
      });
    } catch (err) {
      setResult({
        ok: false,
        text: err.status === 401 ? "トークンが違います" : err.message || "接続できませんでした",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.42)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: "#FAF8F2", borderRadius: "14px 14px 0 0", padding: "18px 20px 26px", maxHeight: "88vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, serif", fontWeight: 700, fontSize: 17 }}>
              サーバー接続
            </div>
            <div style={{ fontSize: 11, color: "#8A8371", marginTop: 2 }}>
              {connected ? "複数の端末で問題帳を共有しています" : "未接続。この端末の中だけに保存しています"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
            <X size={18} color="#8A8371" />
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#8A8371", lineHeight: 1.7, marginBottom: 16 }}>
          <code style={{ background: "#EFE9DA", padding: "1px 5px", borderRadius: 3 }}>npm run server</code> で起動したときに
          表示される URL とトークンを入れてください。トークンは <code style={{ background: "#EFE9DA", padding: "1px 5px", borderRadius: 3 }}>data/token</code> にも入っています。
        </div>

        <Field label="サーバー URL">
          <input
            autoFocus
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            placeholder="http://127.0.0.1:5174"
            style={inputStyle}
          />
        </Field>

        <Field label="トークン">
          <input
            value={draft.token}
            onChange={(e) => setDraft({ ...draft, token: e.target.value })}
            placeholder="data/token の中身"
            style={inputStyle}
          />
        </Field>

        {result && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              padding: "9px 11px",
              borderRadius: 4,
              marginBottom: 14,
              background: result.ok ? "#EFF5F1" : "#FFF6F3",
              border: `1px solid ${result.ok ? "#CFE0D6" : "#EBC9BC"}`,
              color: result.ok ? "#2E7D5B" : "#7A3320",
            }}
          >
            {result.text}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={test}
            disabled={!canApply || testing}
            style={{
              border: "1px solid #E7E1D2",
              background: "#FFFFFF",
              color: "#6B6656",
              borderRadius: 4,
              padding: "11px 16px",
              fontSize: 13,
              cursor: canApply && !testing ? "pointer" : "not-allowed",
            }}
          >
            {testing ? "確認中…" : "接続を確認"}
          </button>
          <button
            onClick={() => onApply({ url: normalizeUrl(draft.url), token: draft.token.trim() })}
            disabled={!canApply}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              justifyContent: "center",
              border: "none",
              background: canApply ? "#2B2620" : "#D8D2C2",
              color: "#FFFFFF",
              borderRadius: 4,
              padding: "12px 16px",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: canApply ? "pointer" : "not-allowed",
            }}
          >
            <Check size={15} />
            接続する
          </button>
        </div>

        {connected && (
          <button
            onClick={() => onApply(null)}
            style={{
              width: "100%",
              marginTop: 10,
              border: "1px solid #E7E1D2",
              background: "#FFFFFF",
              color: "#B5472A",
              borderRadius: 4,
              padding: "10px 16px",
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            接続を解除（この端末のデータは残ります）
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, color: "#8A8371", marginBottom: 6, letterSpacing: "0.02em" }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid #E7E1D2",
  borderRadius: 4,
  padding: "10px 12px",
  fontSize: 14,
  background: "#FFFFFF",
  outline: "none",
};

// appearance:none でネイティブの矢印が消えるため、独自のカーソルを描く
const selectStyle = {
  ...inputStyle,
  paddingRight: 32,
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%238A8371' stroke-width='1.6' stroke-linecap='round'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
};

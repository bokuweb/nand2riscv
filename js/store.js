// Progress persistence (localStorage) and rank table.

// v2, not v1: a stale 'nand2riscv.v1' save may still sit in a browser from before the course was
// briefly named NAND2LINUX, and must not shadow the newer 'nand2linux.v1' save.
const KEY = 'nand2riscv.v2';
// Older saves, read (never written or removed) when KEY is empty: newest name first.
const OLD_KEYS = ['nand2linux.v1', 'nand2riscv.v1', 'nandsmith.v1'];

const fresh = () => ({
  stages: {}, // id -> { cleared, stars, best, bestTime }
  circuits: {}, // id -> { nodes, wires, t, hint, ref }
  xp: 0,
  badges: [],
  noHint: 0,
  muted: false,
  lang: 'en', // 'en' | 'ja': language of the prose (js/i18n.js)
  // panes: { left, right, wide } in px, each optional (js/panes.js); absent = stylesheet widths
});

function load() {
  try {
    let raw = localStorage.getItem(KEY);
    for (const k of OLD_KEYS) raw = raw || localStorage.getItem(k);
    const st = { ...fresh(), ...JSON.parse(raw || '{}') };
    if (st.lang !== 'ja') st.lang = 'en';
    return st;
  } catch {
    return fresh();
  }
}

export const state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode); the game still runs.
  }
}

export function resetAll() {
  // Preferences survive an erase.
  const { muted, lang, panes } = state;
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh(), { muted, lang }, panes && { panes });
  save();
}

const RANKS = [
  [0, 'TRAINEE'],
  [200, 'SOLDERER'],
  [500, 'WIRER'],
  [900, 'TECHNICIAN'],
  [1500, 'DESIGNER'],
  [2200, 'ARCHITECT'],
  [3000, 'MASTER'],
];

export function rankOf(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++;
  const cur = RANKS[i][0];
  const next = RANKS[i + 1]?.[0] ?? null;
  return { level: i + 1, name: RANKS[i][1], next, pct: next ? ((xp - cur) / (next - cur)) * 100 : 100 };
}

// Language of the prose (EN / JA). The chrome stays English in both: titles, labels,
// part and pin names, mnemonics, hex. Japanese strings live in js/i18n.ja.js, keyed by
// a dotted path ('stages.not.hints.0', 'badges.first', 'ui.note.ref'); a missing one
// falls back to the English the caller passes.

import { JA } from './i18n.ja.js';

let lang = 'en';

export const getLang = () => lang;

export function setLang(l) {
  lang = l === 'ja' ? 'ja' : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return lang;
}

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The Japanese for `key` with {name} placeholders filled from `vars`, or null when the
// language is English or the string is missing or empty.
export function ja(key, vars) {
  if (lang !== 'ja') return null;
  const v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), JA);
  if (typeof v !== 'string' || !v.trim()) return null;
  return vars ? v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : v;
}

// Plain text: the Japanese, else the English.
export const tr = (key, en, vars) => ja(key, vars) ?? en;

// HTML for a run of prose. Japanese is escaped and marked lang="ja" so its type style
// applies (no capitals, no letter-spacing); English is returned as given.
export function trHtml(key, en, vars) {
  const j = ja(key, vars);
  return j == null ? en : `<span lang="ja">${esc(j)}</span>`;
}

// Fill an element's text, marking it lang="ja" only when the Japanese was used.
export function trText(el, key, en, vars) {
  const j = ja(key, vars);
  el.textContent = j ?? en;
  if (j == null) el.removeAttribute('lang');
  else el.setAttribute('lang', 'ja');
}

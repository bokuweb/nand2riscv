// Screens (drawing index, drawing sheet, verification report) and progression rules.

import { PARTS, truthTable, nandCount } from './sim.js';
import { WORLDS, STAGES, PLANNED_COUNT, BADGES, partsFor } from './levels.js';
import { state, save, resetAll, rankOf } from './store.js';
import { sfx } from './fx.js';
import { Editor, hex } from './editor.js';
import { runProgram, listing } from './rv32.js';
import { setLang, trHtml, trText } from './i18n.js';
import { initPanes, applyPanes, labelPanes } from './panes.js';

const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
const pad2 = (n) => String(n).padStart(2, '0');
const abar = (frac, n = 16) => {
  const k = Math.round(Math.min(1, Math.max(0, frac)) * n);
  return '[' + '#'.repeat(k) + '.'.repeat(n - k) + ']';
};
// Stored as 1..3; shown as grade C..A.
const starsFor = (st, n) => (n <= st.gold ? 3 : n <= st.silver ? 2 : 1);
const grade = (stars) => ['-', 'C', 'B', 'A'][stars || 0];
const cleared = (st) => !!state.stages[st.id]?.cleared;
const unlocked = (st) => st.idx === 0 || cleared(STAGES[st.idx - 1]);
const rewards = (st) => [].concat(st.reward || []);
// A CPU drawing runs a program.
const isCpu = (st) => !!st.prog;
const num = (n) => n.toLocaleString('en-US');
// Rows of the stage's test: truth table, clocked sequence, or program run.
const runTest = (st, circuit) => (st.prog ? runProgram(st, circuit) : { rows: truthTable(st, circuit) });
// A row's `n` is its instruction number where the table shows only part of a run.
const progTable = (rows, cur, verified) =>
  '<thead><tr><th>#</th><th>PC</th><th class="txt">INSTRUCTION</th><th></th></tr></thead><tbody>' +
  rows
    .map((r, i) => {
      const cls = [r.ok ? 'ok' : 'ng', i === cur ? 'cur' : '', i < verified ? 'verified' : ''].join(' ');
      const n = r.n ?? i;
      return `<tr class="${cls}" data-row="${n}"><td>${n}</td><td>${hex(r.pc, 32)}</td><td class="txt">${r.text}</td><td class="mark">${r.ok ? 'OK' : 'NG'}</td></tr>`;
    })
    .join('') +
  '</tbody>';
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Comments are written in sentence case like the rest of the text. The listing
// keeps case, so print them in capitals except character literals ('h', '\n').
const caps = (t) => t.replace(/'(?:\\.|[^'\\])'|[^']+|'/g, (m) => (m.length > 2 && m[0] === "'" ? m : m.toUpperCase()));
// The stage's program as written: labels on their own line, then address,
// machine word, mnemonic, operands and comment. `at` is the address of the
// instruction on the sheet; lines the reference run never reaches are dimmed.
const listTable = (lines, at, executed) =>
  '<thead><tr><th>ADDR</th><th>WORD</th><th colspan="3">SOURCE</th></tr></thead><tbody>' +
  lines
    .map((l) => {
      const sp = l.text.indexOf(' ');
      const cls = [l.addr === at ? 'cur' : '', executed.has(l.addr) ? 'run' : 'idle'].join(' ');
      return (
        (l.gap ? '<tr class="label"><td></td><td></td><td colspan="3">...</td></tr>' : '') +
        l.labels.map((n) => `<tr class="label"><td></td><td></td><td colspan="3">${esc(n)}:</td></tr>`).join('') +
        `<tr class="${cls}" data-addr="${l.addr}"><td>${hex(l.addr, 32)}</td><td>${hex(l.word, 32)}</td>` +
        `<td class="mn">${l.text.slice(0, sp)}</td><td>${l.text.slice(sp + 1)}</td>` +
        `<td class="cm">${l.comment ? '; ' + esc(caps(l.comment)) : ''}</td></tr>`
      );
    })
    .join('') +
  '</tbody>';
// Scroll `el` into view inside `box` only, leaving the panel around it alone.
// `top` is the height of a sticky header that would cover it.
function keepInView(box, el, top = 0) {
  if (!el) return;
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.top < b.top + top) box.scrollTop -= b.top + top - r.top;
  else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
}
const theadH = (box) => box.querySelector('thead')?.offsetHeight || 0;
// Bus values print as hex, single bits as 0 / 1; null is a don't-care.
const fmt = (st, name, v) => (v == null ? 'X' : st.w?.[name] > 1 ? hex(v, st.w[name]) : v);
// A mismatch reason: whole sentences have a translation; value lines (PC = ..., WANT ...) stay as they are.
const whyText = (w) => trHtml(`ui.why.${w}`, w);
// The prose lines of a dialog, by key: ui.<key>.0, ui.<key>.1, ...
const trLines = (key, en) => en.map((l, i) => trHtml(`ui.${key}.${i}`, l));
const langLabel = () => (state.lang === 'ja' ? 'LANG JA' : 'LANG EN');

let session = null;
let timerId = null;
setLang(state.lang);
const editor = new Editor($('#board'), { onChange: onCircuitChange });
editor.onStatus = (text) => ($('#status').textContent = text);
initPanes();

// Own modal confirm, in place of the browser's. Resolves true on OK / Enter.
function ask(title, lines, ok = 'OK') {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'overlay';
    el.innerHTML = `<div class="dialog" role="alertdialog" aria-label="${title}">
      <h3>Confirm</h3>
      <p class="ask-title">${title}</p>
      ${lines.map((l) => `<p>${l}</p>`).join('')}
      <div class="actions"><button data-v="">CANCEL [ESC]</button><button data-v="1" class="primary">${ok} [ENTER]</button></div>
    </div>`;
    const done = (v) => {
      removeEventListener('keydown', key, true);
      el.remove();
      resolve(v);
    };
    // Swallow every key while open so sheet shortcuts do not fire underneath.
    const key = (e) => {
      if (e.key === 'Tab') return;
      e.stopPropagation();
      e.preventDefault();
      if (e.key === 'Escape') done(false);
      if (e.key === 'Enter') done(true);
    };
    addEventListener('keydown', key, true);
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn) done(!!btn.dataset.v);
    });
    document.body.append(el);
    el.querySelector('.primary').focus();
  });
}

// ---------- drawing index ----------

function showMap() {
  stopTimer();
  session = null;
  $('#stage').hidden = true;
  $('#modal').hidden = true;
  const el = $('#map');
  el.hidden = false;

  const rk = rankOf(state.xp);
  const doneCount = STAGES.filter(cleared).length;
  const total = STAGES.length + PLANNED_COUNT;
  const current = STAGES.find((st) => !cleared(st));
  const ownedParts = new Set([
    'nand',
    ...STAGES.filter(cleared).flatMap(rewards),
    ...WORLDS.filter((w) => w.grant && unlocked(w.stages[0])).flatMap((w) => w.grant),
  ]);
  const gradeCount = (g) => STAGES.filter((s) => grade(state.stages[s.id]?.stars) === g).length;

  const sections = WORLDS.map((w, wi) => {
    const head = `<tr class="sec"><th colspan="8">SECTION ${wi + 1} / ${w.name}${w.goal ? ` / ${w.goal}` : ''}${w.stages ? '' : ' / NOT ISSUED'}</th></tr>`;
    // Planned rows follow the section's issued drawings, numbered after them.
    const planned = (w.planned || [])
      .map((p, i) => `<tr class="void"><td>${wi + 1}-${(w.stages?.length || 0) + i + 1}</td><td>${p}</td><td colspan="6">${w.stages ? 'NOT ISSUED' : '-'}</td></tr>`)
      .join('');
    if (!w.stages) return head + planned;
    return (
      head +
      w.stages
        .map((st) => {
          const rec = state.stages[st.id];
          const open = unlocked(st);
          const status = rec?.cleared ? 'PASSED' : st === current ? 'OPEN' : open ? 'OPEN' : 'LOCKED';
          const cls = [open ? 'open' : 'locked', st === current ? 'current' : ''].join(' ');
          return `<tr class="${cls}" ${open ? `data-stage="${st.id}" tabindex="0"` : ''}>
            <td>${st.num}</td><td>${st.title}${st.bonus ? ' *' : ''}</td>
            <td>${st.ins.length}/${st.outs.length}</td>
            <td class="status">${st === current ? '&gt; ' : ''}${status}</td>
            <td>${grade(rec?.stars)}</td><td>${rec?.best ?? '-'}</td>
            <td>${st.gold}/${st.silver}</td>
            <td>${rewards(st).map((k) => PARTS[k].label).join(' ') || '-'}</td></tr>`;
        })
        .join('') +
      planned
    );
  }).join('');

  const parts = Object.entries(PARTS)
    .map(([k, p]) => {
      const own = ownedParts.has(k);
      return `<tr class="${own ? '' : 'void'}"><td>${p.label}</td><td>${p.ins.length}/${p.outs.length}</td><td>${p.cost}</td><td>${own ? 'STOCK' : '-'}</td></tr>`;
    })
    .join('');

  const badges = BADGES.map((b) => {
    const has = state.badges.includes(b.id);
    return `<tr class="${has ? '' : 'void'}"><td>${b.icon}</td><td>${b.name}<small>${trHtml(`badges.${b.id}`, b.desc)}</small></td><td>${has ? '[X]' : '[ ]'}</td></tr>`;
  }).join('');

  el.innerHTML = `
    <header class="top">
      <div class="cell grow"><h1>NAND2RISCV</h1><small>FROM ONE NAND GATE TO A RISC-V COMPUTER</small></div>
      <div class="cell"><small>OPERATOR CLASS</small><b>${pad2(rk.level)} ${rk.name}</b></div>
      <div class="cell"><small>POINTS</small><b>${state.xp}${rk.next ? ` / ${rk.next}` : ''}</b><pre>${abar(rk.pct / 100)}</pre></div>
      <div class="cell"><small>GRADE A / B / C</small><b>${gradeCount('A')} / ${gradeCount('B')} / ${gradeCount('C')}</b></div>
      <div class="cell"><small>ISSUED</small><b>${doneCount} / ${total}</b><pre>${abar(doneCount / total)}</pre></div>
      <button id="mute">${state.muted ? 'SOUND OFF' : 'SOUND ON'}</button>
      <button id="lang" class="lang">${langLabel()}</button>
    </header>
    <div class="map-cols">
      <section>
        <h3>Drawing index</h3>
        <table class="sheet-table index">
          <thead><tr><th>DWG</th><th>TITLE</th><th>I/O</th><th>STATUS</th><th>GRADE</th><th>NAND</th><th>LIMIT A/B</th><th>RELEASES</th></tr></thead>
          <tbody>${sections}</tbody>
        </table>
        <p class="foot">${trHtml('ui.foot', '* OPTIONAL DRAWING. GRADE A: NAND COUNT WITHIN LIMIT A. GRADE B: WITHIN LIMIT B. GRADE C: FUNCTION CORRECT.')}</p>
      </section>
      <aside>
        <h3>Parts library</h3>
        <table class="sheet-table"><thead><tr><th>PART</th><th>I/O</th><th>NAND EQ</th><th>STATE</th></tr></thead><tbody>${parts}</tbody></table>
        <h3>Qualifications ${BADGES.filter((b) => state.badges.includes(b.id)).length} / ${BADGES.length}</h3>
        <table class="sheet-table quals"><tbody>${badges}</tbody></table>
        <button id="reset">ERASE ALL RECORDS</button>
      </aside>
    </div>`;

  el.querySelectorAll('[data-stage]').forEach((row) => {
    const go = () => openStage(STAGES.find((s) => s.id === row.dataset.stage));
    row.addEventListener('click', go);
    row.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  });
  $('#mute').onclick = () => {
    state.muted = !state.muted;
    save();
    showMap();
  };
  $('#lang').onclick = toggleLang;
  $('#reset').onclick = async () => {
    const lines = trLines('erase', ['ALL PROGRESS AND SAVED SHEETS WILL BE DELETED.', 'THIS CANNOT BE UNDONE.']);
    if (!(await ask('ERASE ALL RECORDS', lines, 'ERASE'))) return;
    resetAll();
    showMap();
  };
}

// ---------- drawing sheet ----------

function openStage(st) {
  $('#map').hidden = true;
  $('#modal').hidden = true;
  $('#stage').hidden = false;
  $('#stage').classList.remove('busy');
  // A CPU drawing with no sheet of its own starts from the previous one.
  const base = st.inherit && state.circuits[st.inherit];
  const saved = state.circuits[st.id] || (base && { nodes: base.nodes, wires: base.wires, ref: base.ref });
  session = { st, t: saved?.t || 0, hint: saved?.hint || 0, ref: !!saved?.ref, allOk: false, busy: false, verified: 0 };

  $('#st-num').textContent = st.num;
  $('#st-title').textContent = st.title;
  $('#st-targets').textContent = `A<=${st.gold} B<=${st.silver}`;
  renderBrief();
  $('#howto').open = st.idx === 0;
  $('.stage-cols').classList.toggle('wide', !!st.w);
  applyPanes();
  $('#test-title').textContent = isCpu(st) ? 'Execution trace' : st.seq ? 'Test sequence' : 'Truth table';
  $('#listing-box').hidden = !isCpu(st);
  $('#listing-title').textContent = 'Program listing';
  $('#listing').scrollTop = 0;
  session.lines = st.prog ? listing(st.prog) : null;
  session.listAt = null;
  $('#palette').innerHTML = partsFor(st)
    .map((k) => `<button class="chip" data-part="${k}">${PARTS[k].label}<small>${PARTS[k].cost}</small></button>`)
    .join('');
  editor.load(st, saved);
  $('#timer').textContent = fmtTime(session.t);
  startTimer();
}

// The stage's prose in the current language: specification, notes, hints, controls.
function renderBrief() {
  const { st } = session;
  trText($('#goal'), `stages.${st.id}.goal`, st.goal);
  trText($('#story'), `stages.${st.id}.story`, st.story);
  $('#howto')
    .querySelectorAll('li')
    .forEach((li, i) => {
      li.dataset.en ??= li.textContent;
      trText(li, `ui.howto.${i}`, li.dataset.en);
    });
  $('#st-lang').textContent = langLabel();
  labelPanes();
  renderHints();
}

// EN / JA. Re-renders the prose in place: the sheet, the test state and a running
// VERIFY are untouched.
function toggleLang() {
  state.lang = setLang(state.lang === 'ja' ? 'en' : 'ja');
  save();
  if (!session) return showMap();
  renderBrief();
  onCircuitChange(false);
}

function renderHints() {
  const { st, hint } = session;
  $('#hints').innerHTML =
    st.hints
      .slice(0, hint)
      .map((h, i) => `<p class="hint"><b>HINT ${i + 1}</b>${trHtml(`stages.${st.id}.hints.${i}`, h)}</p>`)
      .join('') +
    (hint < st.hints.length ? `<button id="more-hint">SHOW HINT ${hint + 1} / ${st.hints.length}</button>` : '');
  const btn = $('#more-hint');
  if (btn)
    btn.onclick = () => {
      session.hint++;
      persist();
      renderHints();
    };
}

function persist() {
  if (!session) return;
  state.circuits[session.st.id] = { ...editor.serialize(), t: session.t, hint: session.hint, ref: session.ref };
  save();
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (!session || session.busy || document.hidden) return;
    session.t++;
    $('#timer').textContent = fmtTime(session.t);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function onCircuitChange(structural) {
  if (!session) return;
  const { st } = session;
  const circuit = editor.circuit();
  const test = runTest(st, circuit);
  const rows = test.rows;
  const n = nandCount(circuit);
  const okCount = rows.filter((r) => r.ok).length;
  const rowsOk = rows.length > 0 && okCount === rows.length;
  // A printing stage also needs the drawn CPU's own output to be right. With
  // every row OK the two agree; checking it here keeps the goal explicit.
  const serialOk = !st.uart || test.uart === st.uart;
  const allOk = rowsOk && serialOk;
  const curKey = st.ins.map((nm) => editor.inputs['in:' + nm]).join('');
  // A clocked test has repeated input vectors, so the sheet tracks its own row.
  const cur = st.seq || st.prog ? editor.cursor : rows.findIndex((r) => r.ins.join('') === curKey);

  $('#nc').textContent = n;
  $('#nc-grade').textContent = !allOk ? '-' : session.ref ? 'C REF' : grade(starsFor(st, n));
  $('#table').innerHTML = st.prog
    ? progTable(rows, cur, session.verified)
    : `<thead><tr>${st.ins.map((x) => `<th>${x}</th>`).join('')}<th class="sep"></th>${st.outs.map((x) => `<th>${x}</th>`).join('')}<th></th></tr></thead><tbody>` +
    rows
      .map((r, i) => {
        const cls = [r.ok ? 'ok' : 'ng', i === cur ? 'cur' : '', i < session.verified ? 'verified' : ''].join(' ');
        return `<tr class="${cls}" data-row="${i}">${r.ins.map((v, j) => `<td>${fmt(st, st.ins[j], v)}</td>`).join('')}<td class="sep">|</td>${r.exp
          .map((v, j) => `<td class="exp ${v == null || r.got[j] === v ? '' : 'diff'}">${fmt(st, st.outs[j], v)}</td>`)
          .join('')}<td class="mark">${r.ok ? 'OK' : 'NG'}</td></tr>`;
      })
      .join('') +
    '</tbody>';
  $('#progress').innerHTML = `${abar(okCount / rows.length, 12)} ${okCount} / ${rows.length} MATCH`;
  if (st.prog) {
    const bad = rows.find((r) => !r.ok);
    $('#progress').innerHTML += bad ? `<p class="why">STEP ${rows.indexOf(bad)}: ${whyText(bad.why)}</p>` : '';
  }
  renderSerial(st, test, cur);
  if (st.prog) renderListing(rows, cur);
  if (session.busy) $('#table tr.cur')?.scrollIntoView({ block: 'nearest' });
  const submit = $('#submit');
  submit.disabled = !allOk || session.busy;
  submit.textContent = allOk ? 'VERIFY' : rowsOk ? 'SERIAL OUTPUT MUST MATCH' : 'ALL ROWS MUST MATCH';
  if (allOk && !session.allOk && !session.busy) sfx.ready();
  session.allOk = allOk;
  if (structural) persist();
}

// The serial console shows what the drawn CPU printed. During the sweep it is
// the output up to the last swept row, so characters appear as each store
// passes; with a row selected it is the output just before that instruction.
function renderSerial(st, test, cur) {
  const box = $('#serial');
  box.hidden = !st.uart;
  if (!st.uart) return;
  const { rows } = test;
  const upto = session.busy ? session.verified : cur != null && cur >= 0 ? cur : null;
  const text = upto == null ? test.uart : (rows[Math.min(upto, rows.length) - 1]?.out ?? '');
  session.serial = test.uart;
  const con = $('#console');
  const caret = document.createElement('span');
  caret.className = 'caret';
  con.textContent = text;
  con.append(caret);
  con.scrollTop = con.scrollHeight;
  $('#serial-status').textContent = `EXPECTED ${JSON.stringify(st.uart)}  ${test.uart === st.uart ? 'MATCH' : 'NO MATCH'}`;
}

// The listing marks the instruction of the selected or swept trace row. It
// follows that line only when it moves, so scrolling the listing by hand
// survives edits to the sheet.
// `executed`, if given, is the set of addresses to show as reached.
function renderListing(rows, cur, executed) {
  const box = $('#listing');
  const at = cur != null && cur >= 0 ? (rows[cur]?.pc ?? null) : null;
  session.pcs = rows.map((r) => r.pc);
  session.ns = rows.map((r, i) => r.n ?? i);
  box.querySelector('table').innerHTML = listTable(session.lines, at, executed || new Set(session.pcs));
  if (at !== session.listAt) keepInView(box, box.querySelector('tr.cur'), theadH(box));
  session.listAt = at;
}

// Put the sheet in the state of test row i.
function gotoRow(i) {
  const { st } = session;
  if (st.prog) {
    const run = runProgram(st, editor.circuit(), i);
    return editor.show(run.inputs, run.mem, i);
  }
  const rows = truthTable(st);
  if (st.seq) editor.replay(st.seq.slice(0, i + 1), rows[i].exp);
  else editor.setInputs(rows[i].ins);
}

async function submit() {
  if (!session || session.busy) return;
  if (!session.allOk) return;
  session.busy = true;
  editor.locked = true;
  $('#stage').classList.add('busy');
  const rows = runTest(session.st, editor.circuit()).rows;
  for (let i = 0; i < rows.length; i++) {
    session.verified = i + 1;
    gotoRow(i);
    sfx.row();
    // A printing program sweeps slowly enough to read the console fill up.
    await sleep(session.st.uart ? 170 : rows.length > 20 ? 40 : rows.length > 8 ? 80 : 160);
  }
  await sleep(200);
  finish();
}

function finish() {
  const { st } = session;
  const circuit = editor.circuit();
  const nand = nandCount(circuit);
  const ref = session.ref;
  // A sheet loaded from the reference solution passes, capped at grade C.
  const stars = ref ? 1 : starsFor(st, nand);
  const prev = state.stages[st.id] || { stars: 0 };
  const firstClear = !prev.cleared;
  const xpBefore = state.xp;
  let xp = (firstClear ? (ref ? 50 : 100) : 0) + (ref ? 0 : Math.max(0, stars - prev.stars) * 50);

  state.stages[st.id] = {
    cleared: true,
    stars: Math.max(stars, prev.stars),
    best: ref ? (prev.best ?? null) : Math.min(nand, prev.best ?? Infinity),
    bestTime: ref ? (prev.bestTime ?? null) : Math.min(session.t, prev.bestTime ?? Infinity),
  };
  if (firstClear && session.hint === 0 && !ref) state.noHint++;

  const newBadges = [];
  const award = (id, cond) => {
    if (cond && BADGES.some((b) => b.id === id) && !state.badges.includes(id) && (!ref || /^w\d/.test(id))) {
      state.badges.push(id);
      newBadges.push(BADGES.find((b) => b.id === id));
    }
  };
  award('first', true);
  award('gold', stars === 3 && st.gold < st.silver);
  award('purist', st.idx >= 4 && circuit.nodes.every((n) => n.type === 'in' || n.type === 'out' || n.type === 'nand'));
  award('fast', session.t <= 45 && st.idx >= 1);
  award('nohint', state.noHint >= 5);
  award('over', nand >= st.silver * 2);
  WORLDS.forEach((w, i) => award('w' + (i + 1), !!w.stages && w.stages.every(cleared)));
  award('allgold', STAGES.every((s) => state.stages[s.id]?.stars === 3));
  xp += newBadges.length * 75;
  state.xp += xp;
  persist();

  showResult({ st, nand, stars, ref, firstClear, xp, xpBefore, newBadges, record: !ref && !firstClear && nand < prev.best });
}

function showResult({ st, nand, stars, ref, firstClear, xp, xpBefore, newBadges, record }) {
  const next = STAGES[st.idx + 1];
  const before = rankOf(xpBefore);
  const after = rankOf(state.xp);
  const released = firstClear ? rewards(st).map((k) => PARTS[k]) : [];
  const note = ref
    ? trHtml('ui.note.ref', 'REFERENCE SOLUTION USED. GRADE CAPPED AT C. CLEAR THE SHEET AND REDRAW FOR A OR B.')
    : stars === 3
      ? trHtml('ui.note.a', 'LIMIT A MET. NO FURTHER REDUCTION REQUIRED.')
      : stars === 2
        ? trHtml('ui.note.b', `REMOVE ${nand - st.gold} NAND FOR GRADE A.`, { n: nand - st.gold })
        : trHtml('ui.note.c', `GRADE B REQUIRES NAND &lt;= ${st.silver}.`, { n: st.silver });
  const last = next ? '' : trHtml('ui.note.last', ' THIS IS THE LAST DRAWING OF THE COURSE.');
  const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;

  const m = $('#modal');
  m.innerHTML = `<div class="dialog">
    <h3>Verification report</h3>
    <table class="sheet-table report">
      ${row('DWG', `${st.num} ${st.title}`)}
      ${row('RESULT', '<b class="inv">PASS</b>')}
      ${row('GRADE', `<b class="big">${grade(stars)}</b>`)}
      ${row('NAND COUNT', `${nand}  (LIMIT A ${st.gold} / B ${st.silver})${record ? '  NEW BEST' : ''}`)}
      ${st.uart ? row('SERIAL OUT', `<span class="serial-out"></span>`) : ''}
      ${row('TIME', fmtTime(session.t))}
      ${row('POINTS', `+${xp}  TOTAL ${state.xp}`)}
      ${row('OPERATOR CLASS', `${pad2(after.level)} ${after.name}${after.level > before.level ? '  <b class="inv">PROMOTED</b>' : ''}`)}
      ${released.map((p) => row('PART RELEASED', `<b>${p.label}</b>  NAND EQ ${p.cost}`)).join('')}
      ${newBadges.map((b) => row('QUALIFICATION', `<b>${b.icon} ${b.name}</b>  ${trHtml(`badges.${b.id}`, b.desc)}`)).join('')}
      ${row('NOTE', note + last)}
    </table>
    <div class="actions">
      <button id="res-map">INDEX</button>
      ${stars < 3 ? '<button id="res-retry">REVISE</button>' : ''}
      ${next ? '<button id="res-next" class="primary">NEXT DWG &gt;</button>' : ''}
    </div>
  </div>`;
  // Filled as text: the output came from the player's circuit.
  if (st.uart) $('.serial-out', m).textContent = JSON.stringify(session.serial ?? '');
  m.hidden = false;
  sfx.pass();

  $('#res-map').onclick = showMap;
  if ($('#res-next')) $('#res-next').onclick = () => openStage(next);
  if ($('#res-retry'))
    $('#res-retry').onclick = () => {
      m.hidden = true;
      session.busy = false;
      session.verified = 0;
      editor.locked = false;
      $('#stage').classList.remove('busy');
      onCircuitChange(false);
    };
}

// ---------- wiring ----------

$('#back').onclick = () => {
  persist();
  showMap();
};
$('#submit').onclick = submit;
$('#st-lang').onclick = toggleLang;
// One button step is a clear jump; the wheel is for fine control.
$('#tool-zoom-out').onclick = () => {
  if (!session || session.busy) return;
  editor.zoomBy(1 / 1.5);
};
$('#tool-zoom-in').onclick = () => {
  if (!session || session.busy) return;
  editor.zoomBy(1.5);
};
$('#tool-fit').onclick = () => {
  if (!session || session.busy) return;
  editor.resetView();
};
$('#tool-del').onclick = () => editor.deleteSelected();
$('#tool-undo').onclick = () => editor.undo();
$('#tool-clear').onclick = () => {
  editor.clear();
  session.ref = false;
  persist();
  onCircuitChange(false);
};
$('#answer').onclick = async () => {
  if (!session || session.busy) return;
  const lines = trLines('answer', ['THE CURRENT SHEET WILL BE REPLACED.', 'GRADE IS CAPPED AT C UNTIL THE SHEET IS CLEARED.']);
  if (!(await ask('LOAD REFERENCE SOLUTION', lines, 'LOAD'))) return;
  if (!session || session.busy) return;
  session.ref = true;
  editor.loadSolution(session.st.solution);
};

$('#table').addEventListener('click', (e) => {
  const tr = e.target.closest('[data-row]');
  if (!tr || session.busy) return;
  gotoRow(+tr.dataset.row);
  sfx.toggle();
});

// A listing line selects the first trace step that runs it.
$('#listing').addEventListener('click', (e) => {
  const tr = e.target.closest('[data-addr]');
  if (!tr || !session || session.busy) return;
  const i = session.pcs.indexOf(+tr.dataset.addr);
  if (i < 0) return;
  gotoRow(session.ns[i]);
  sfx.toggle();
  const wrap = $('.table-wrap');
  keepInView(wrap, $('#table tr.cur'), theadH(wrap));
});

// Palette: click to drop a part at a default spot, or drag it onto the sheet.
$('#palette').addEventListener('pointerdown', (e) => {
  const chip = e.target.closest('[data-part]');
  if (!chip || session.busy) return;
  e.preventDefault();
  const type = chip.dataset.part;
  const ghost = document.createElement('div');
  ghost.className = 'ghost-part';
  ghost.textContent = PARTS[type].label;
  document.body.append(ghost);
  const follow = (ev) => {
    ghost.style.left = ev.clientX + 'px';
    ghost.style.top = ev.clientY + 'px';
  };
  follow(e);
  const drop = (ev) => {
    removeEventListener('pointermove', follow);
    ghost.remove();
    const r = $('#board').getBoundingClientRect();
    if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
      const p = editor.toSvg(ev.clientX, ev.clientY);
      editor.addPart(type, p.x - 44, p.y - 24);
    } else if (document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#palette')) {
      editor.addPart(type);
    }
  };
  addEventListener('pointermove', follow);
  addEventListener('pointerup', drop, { once: true });
});

addEventListener('keydown', (e) => {
  if (!session || session.busy) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    editor.deleteSelected();
  } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    editor.undo();
  } else if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) {
    // Leave browser zoom shortcuts and text entry alone.
  } else if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    editor.zoomBy(1.5);
  } else if (e.key === '-') {
    e.preventDefault();
    editor.zoomBy(1 / 1.5);
  } else if (e.key === '0') {
    e.preventDefault();
    editor.resetView();
  }
});

addEventListener('beforeunload', persist);

showMap();

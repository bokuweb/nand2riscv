// SHEET 00 / STATUS: the plate at the top of the drawing index. Where the player is, what is
// next, and what it adds up to, read from the save only (nothing here writes it).

import { PARTS } from './sim.js';
import { WORLDS, STAGES, BADGES } from './levels.js';
import { state } from './store.js';
import { trHtml } from './i18n.js';

const num = (n) => n.toLocaleString('en-US');
const pad2 = (n) => String(n).padStart(2, '0');
const cleared = (st) => !!state.stages[st.id]?.cleared;
const unlocked = (st) => st.idx === 0 || cleared(STAGES[st.idx - 1]);
const isGrade = (st, stars) => (state.stages[st.id]?.stars || 0) === stars;
// Seconds as M:SS, or H:MM:SS from an hour.
const clock = (t) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor(t / 60) % 60;
  const s = String(t % 60).padStart(2, '0');
  return h ? `${h}:${pad2(m)}:${s}` : `${m}:${s}`;
};

// The RV32I base instructions, each with the CPU drawing that first implements it, in course
// order: read from the drawings' `isa` tables (a later table repeating LW or SW adds nothing).
export const ISA = [];
for (const st of STAGES)
  for (const g of st.isa || [])
    for (const m of g.name.split(' ')) if (!ISA.some((i) => i.m === m)) ISA.push({ m, st });

// ---------- course ladder ----------
// One block per section, NAND on the left, joined by a line that is drawn solid once the
// section before it is passed. Inside each block a tick per drawing: filled when passed,
// outlined while open, grey while locked. The section in progress gets a second frame.

const TICK = 7;
const TGAP = 3;

function sectionInfo(w, wi, current) {
  const stages = w.stages || [];
  const done = stages.filter(cleared).length;
  return {
    w,
    no: wi + 1,
    stages,
    done,
    all: done === stages.length,
    here: stages.includes(current),
    open: stages.length > 0 && unlocked(stages[0]),
  };
}

function ticks(s, x, y) {
  return s.stages
    .map((st, i) => {
      const cls = cleared(st) ? 'tk on' : unlocked(st) ? 'tk open' : 'tk';
      return `<rect class="${cls}" x="${x + i * (TICK + TGAP)}" y="${y}" width="${TICK}" height="${TICK}"/>`;
    })
    .join('');
}

function frame(s, x, y, w, h) {
  const cls = s.open ? 'blk' : 'blk off';
  return (
    `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>` +
    (s.here ? `<rect class="blk" x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}"/>` : '')
  );
}

// Wide: all eight in a row.
function ladderRow(secs) {
  const n = secs.length;
  const x0 = 58;
  const bw = 100;
  const gap = (960 - x0 - n * bw) / (n - 1);
  const y = 22;
  const h = 62;
  let out = `<text class="lb" x="0" y="${y + h / 2 - 6}">1 NAND</text><rect class="term" x="40" y="${y + h / 2 - 3}" width="6" height="6"/>`;
  out += `<line class="wire${secs[0].open ? ' on' : ''}" x1="46" y1="${y + h / 2}" x2="${x0}" y2="${y + h / 2}"/>`;
  secs.forEach((s, i) => {
    const x = x0 + i * (bw + gap);
    if (i) out += `<line class="wire${secs[i - 1].all ? ' on' : ''}" x1="${x - gap}" y1="${y + h / 2}" x2="${x}" y2="${y + h / 2}"/>`;
    const dim = s.open ? '' : ' off';
    out += frame(s, x, y, bw, h);
    out += `<text class="lb${dim}" x="${x + 6}" y="${y + 13}">S${s.no}</text>`;
    out += `<text class="lb${dim}" x="${x + bw - 6}" y="${y + 13}" text-anchor="end">${s.done}/${s.stages.length}</text>`;
    out += `<text class="nm${dim}" x="${x + 6}" y="${y + 32}">${s.w.name}</text>`;
    out += ticks(s, x + 6, y + h - 6 - TICK);
    if (s.w.goal) out += `<text class="lb" x="${x}" y="${y - 9}">${s.w.goal}</text>`;
    if (s.here) out += `<text class="lb here" x="${x}" y="${y + h + 17}">&gt; IN PROGRESS</text>`;
  });
  return `<svg class="ladder wide" viewBox="0 0 960 108" role="img" aria-label="COURSE LADDER">${out}</svg>`;
}

// Narrow: the same chain read downwards.
function ladderCol(secs) {
  const bh = 40;
  const gap = 14;
  const x = 8;
  const bw = 324;
  const y0 = 22;
  let out = `<text class="lb" x="${x}" y="10">1 NAND</text><line class="wire${secs[0].open ? ' on' : ''}" x1="${x + 20}" y1="14" x2="${x + 20}" y2="${y0}"/>`;
  secs.forEach((s, i) => {
    const y = y0 + i * (bh + gap);
    if (i) out += `<line class="wire${secs[i - 1].all ? ' on' : ''}" x1="${x + 20}" y1="${y - gap}" x2="${x + 20}" y2="${y}"/>`;
    const dim = s.open ? '' : ' off';
    out += frame(s, x, y, bw, bh);
    out += `<text class="lb${dim}" x="${x + 6}" y="${y + 15}">S${s.no}</text>`;
    out += `<text class="nm${dim}" x="${x + 34}" y="${y + 15}">${s.w.name}</text>`;
    out += `<text class="lb${dim}" x="${x + bw - 6}" y="${y + 15}" text-anchor="end">${s.here ? '&gt; ' : ''}${s.w.goal ? s.w.goal + '  ' : ''}${s.done}/${s.stages.length}</text>`;
    out += ticks(s, x + 34, y + bh - 8 - TICK);
  });
  const h = y0 + secs.length * (bh + gap) - gap + 6;
  return `<svg class="ladder tall" viewBox="0 0 340 ${h}" role="img" aria-label="COURSE LADDER">${out}</svg>`;
}

// ---------- the plate ----------

// `owned` is the set of PARTS keys released so far (as the parts library shows them).
export function dashboard(owned) {
  const done = STAGES.filter(cleared);
  const current = STAGES.find((st) => !cleared(st));
  const fresh = done.length === 0;
  const secs = WORLDS.map((w, wi) => sectionInfo(w, wi, current));

  // NEXT DRAWING
  let next;
  if (current) {
    const sec = WORLDS[current.world];
    next = `
      <small>NEXT DRAWING</small>
      <p class="dash-dwg"><b>${current.num}</b> ${current.title}</p>
      <small>SECTION ${current.world + 1} / ${sec.name}${sec.goal ? ` / ${sec.goal}` : ''}</small>
      <p class="dash-goal">${trHtml(`stages.${current.id}.goal`, current.goal)}</p>
      ${fresh ? `<p class="dash-note">${trHtml('ui.dash.start', 'Every part of the computer is built from one NAND gate. Start with the first drawing.')}</p>` : ''}
      <div class="dash-act"><button id="dash-open" class="primary" data-stage="${current.id}">OPEN ${current.num}</button></div>`;
  } else {
    const last = STAGES.find((st) => st.demo) || STAGES[STAGES.length - 1];
    const below = STAGES.filter((st) => !isGrade(st, 3));
    next = `
      <small>NEXT DRAWING</small>
      <p class="dash-dwg"><b>COURSE COMPLETE</b></p>
      <small>${STAGES.length} / ${STAGES.length} DRAWINGS PASSED</small>
      <p class="dash-goal">${trHtml('ui.dash.done', 'Your processor runs the RV32I base instruction set, built from one NAND gate. Run a longer program on it.')}</p>
      ${below.length ? `<p class="dash-note">${trHtml('ui.dash.below', `${below.length} drawings below grade A.`, { n: below.length })}</p>` : ''}
      <div class="dash-act">
        <button id="dash-open" class="primary" data-stage="${last.id}" data-demo="1">RUN FIZZBUZZ</button>
        ${below.length ? `<button id="dash-revise" data-stage="${below[0].id}">REVISE ${below[0].num}</button>` : ''}
      </div>`;
  }

  // MACHINE: the biggest thing built, all of it, and what the library holds.
  let machine = '';
  let record = '';
  if (!fresh) {
    const big = done.reduce((a, st) => ((state.stages[st.id].best ?? 0) > (state.stages[a.id].best ?? 0) ? st : a));
    const sum = done.reduce((n, st) => n + (state.stages[st.id].best ?? 0), 0);
    const part = Object.entries(PARTS)
      .filter(([k]) => owned.has(k))
      .reduce((a, b) => (b[1].cost > a[1].cost ? b : a));
    const times = done.map((st) => state.stages[st.id].bestTime).filter(Number.isFinite);
    const kv = (k, v, sub = '') => `<div class="kv"><small>${k}</small><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    machine = `
      <section class="dash-p dash-machine">
        <h3>Machine</h3>
        ${kv('LARGEST SHEET', `${num(state.stages[big.id].best ?? 0)} NAND`, `${big.num} ${big.title}`)}
        ${kv('ALL SHEETS', `${num(sum)} NAND`, `BEST OF ${done.length} PASSED`)}
        ${kv('LARGEST PART', `${num(part[1].cost)} NAND EQ`, part[1].label)}
        ${kv('PARTS RELEASED', `${owned.size} / ${Object.keys(PARTS).length}`)}
        ${times.length * 2 >= done.length ? kv('TIME ON SHEETS', clock(times.reduce((a, b) => a + b, 0)), `SUM OF ${times.length} BEST TIMES`) : ''}
      </section>`;
    const g = (s) => STAGES.filter((st) => isGrade(st, s)).length;
    const quals = BADGES.map((b) => `<span class="cellx${state.badges.includes(b.id) ? ' on' : ''}" title="${b.name}">${b.icon}</span>`).join('');
    record = `
      <section class="dash-p dash-record">
        <h3>Grades</h3>
        <div class="grades">${kv('A', g(3))}${kv('B', g(2))}${kv('C', g(1))}</div>
        <h3>Qualifications ${BADGES.filter((b) => state.badges.includes(b.id)).length} / ${BADGES.length}</h3>
        <div class="cells">${quals}</div>
      </section>`;
  }

  // RV32I: one cell per instruction, grouped by the drawing that adds it.
  const groups = [];
  for (const i of ISA) {
    const g = groups.at(-1);
    if (g?.st === i.st) g.ms.push(i.m);
    else groups.push({ st: i.st, ms: [i.m] });
  }
  const lit = ISA.filter((i) => cleared(i.st)).length;
  const isa = groups
    .map(({ st, ms }) => {
      const on = cleared(st);
      const cls = on ? 'cellx on' : st === current ? 'cellx due' : 'cellx';
      return `<div class="isa-g"><small>${st.num}${st === current ? ' NEXT' : ''}</small><div class="cells">${ms.map((m) => `<span class="${cls}">${m}</span>`).join('')}</div></div>`;
    })
    .join('');

  return `
    <div class="plate${fresh ? ' fresh' : ''}">
      <div class="plate-head"><b>SHEET 00</b><span>STATUS</span><span class="grow"></span><small>${done.length} / ${STAGES.length} PASSED</small></div>
      <div class="plate-row">
        <section class="dash-p dash-next">${next}</section>
        ${machine}${record}
      </div>
      <section class="dash-p dash-course">
        <h3>Course</h3>
        ${ladderRow(secs)}${ladderCol(secs)}
      </section>
      <section class="dash-p dash-isa">
        <h3>RV32I base instruction set ${lit} / ${ISA.length}</h3>
        <div class="isa">${isa}</div>
      </section>
    </div>`;
}

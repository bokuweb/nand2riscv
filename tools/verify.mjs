#!/usr/bin/env node
// Course self-check: for every stage, load its reference netlist (SOLUTIONS in
// js/levels.js) the way SHOW ANSWER does and check that
//   - every part it uses is in the stage's palette and every wire joins equal widths,
//   - it passes the stage's test (and prints the expected serial output),
//   - its NAND-equivalent count equals the stage's grade A limit,
//   - an empty sheet fails,
//   - it has Japanese text (js/i18n.ja.js): a goal, notes when the English has notes, and as many
//     hints as the English (every qualification needs a Japanese description too),
//   - for a program stage, the previous program stage's reference CPU fails the new program
//     (skipped when the two references are the same circuit, as for HELLO).
// Then the demo: the FizzBuzz program assembles, the last CPU drawing's reference runs it to
// the end in lockstep with the reference interpreter, and the UART prints the 100 expected lines.
// The demo's interface prose needs Japanese too.
// One line per stage, then the elapsed time; exits 1 on any failure.
// No dependencies: node tools/verify.mjs

import { PARTS, truthTable, nandCount } from '../js/sim.js';
import { STAGES, BADGES, partsFor } from '../js/levels.js';
import { JA } from '../js/i18n.ja.js';
import { runProgram, startProgram, assemble, refRun } from '../js/rv32.js';
import { fizzbuzzText } from '../js/fizzbuzz.js';

const t0 = performance.now();
const secs = (t) => ((performance.now() - t) / 1000).toFixed(1) + ' S';
const base = (sig) => sig.split('.')[0];
const port = (sig) => +(sig.split('.')[1] || 0);

// Pins plus the netlist's parts and wires, in the editor's circuit shape.
function build(stage, sol) {
  const errs = [];
  const nodes = [...stage.ins.map((n) => ({ id: 'in:' + n, type: 'in', name: n })), ...stage.outs.map((n) => ({ id: 'out:' + n, type: 'out', name: n }))];
  const wires = [];
  if (!sol) return { circuit: { nodes, wires }, errs };
  for (const [k, [type]] of Object.entries(sol.g)) {
    if (!PARTS[type]) errs.push(`UNKNOWN PART ${type}`);
    nodes.push({ id: 'g:' + k, type, name: k });
  }
  const src = (sig) => {
    if (sol.g[base(sig)]) return ['g:' + base(sig), port(sig)];
    if (stage.ins.includes(sig)) return ['in:' + sig, 0];
    errs.push(`UNKNOWN SIGNAL ${sig}`);
    return null;
  };
  for (const [k, [, ...args]] of Object.entries(sol.g)) args.forEach((sig, i) => (sig = src(sig)) && wires.push({ from: sig, to: ['g:' + k, i] }));
  for (const [pin, sig] of Object.entries(sol.o)) {
    if (!stage.outs.includes(pin)) errs.push(`UNKNOWN OUTPUT ${pin}`);
    const f = src(sig);
    if (f) wires.push({ from: f, to: ['out:' + pin, 0] });
  }
  return { circuit: { nodes, wires }, errs };
}

// Same rule as the editor's portW.
function width(stage, node, dir, i) {
  if (node.type === 'in' || node.type === 'out') return stage.w?.[node.name] || 1;
  return PARTS[node.type][dir === 'in' ? 'iw' : 'ow']?.[i] || 1;
}

function structure(stage, sol, circuit) {
  const errs = [];
  const byId = Object.fromEntries(circuit.nodes.map((n) => [n.id, n]));
  const palette = new Set(partsFor(stage));
  for (const [k, [type, ...args]] of Object.entries(sol.g)) {
    if (!PARTS[type]) continue;
    if (!palette.has(type)) errs.push(`${type} NOT IN PALETTE`);
    if (args.length !== PARTS[type].ins.length) errs.push(`${k}: ${args.length} INPUTS, ${type} HAS ${PARTS[type].ins.length}`);
  }
  for (const w of circuit.wires) {
    const a = byId[w.from[0]];
    const c = byId[w.to[0]];
    if (a.type !== 'in' && w.from[1] >= PARTS[a.type].outs.length) errs.push(`${a.name}.${w.from[1]}: NO SUCH OUTPUT`);
    const wa = width(stage, a, 'out', w.from[1]);
    const wc = width(stage, c, 'in', w.to[1]);
    if (wa !== wc) errs.push(`WIDTH ${a.name}.${w.from[1]} ${wa} -> ${c.name}.${w.to[1]} ${wc}`);
  }
  return errs;
}

// { ok, why }: does the circuit pass the stage the way the VERIFY button judges it?
function judge(stage, circuit) {
  if (stage.prog) {
    const run = runProgram(stage, circuit);
    const bad = run.rows.find((r) => !r.ok);
    if (bad) return { ok: false, why: `STEP ${run.rows.indexOf(bad)}: ${bad.why}` };
    if (!run.rows.length) return { ok: false, why: 'NO ROWS' };
    if (stage.uart && run.uart !== stage.uart) return { ok: false, why: `SERIAL ${JSON.stringify(run.uart)}` };
    if (stage.uart && run.uartExpected !== stage.uart) return { ok: false, why: `REFERENCE PRINTS ${JSON.stringify(run.uartExpected)}` };
    return { ok: true, why: `${run.rows.length} STEPS` };
  }
  const rows = truthTable(stage, circuit);
  const bad = rows.findIndex((r) => !r.ok);
  return bad < 0 ? { ok: true, why: `${rows.length} ROWS` } : { ok: false, why: `ROW ${bad}` };
}

// The Japanese for a stage: goal, notes (when the English has them), the same number of hints.
const filled = (v) => typeof v === 'string' && v.trim() !== '';
function jaChecks(st) {
  const j = JA.stages[st.id];
  if (!j) return ['NO JAPANESE TEXT'];
  const errs = [];
  if (!filled(j.goal)) errs.push('NO JAPANESE GOAL');
  if (filled(st.story) && !filled(j.story)) errs.push('NO JAPANESE NOTES');
  const n = st.hints.length;
  if (!Array.isArray(j.hints) || j.hints.length !== n || !j.hints.every(filled))
    errs.push(`JAPANESE HINTS ${Array.isArray(j.hints) ? j.hints.filter(filled).length : 0}, WANT ${n}`);
  return errs;
}

let failed = 0;
let prevProg = null;
for (const st of STAGES) {
  const problems = [];
  const notes = [];
  const sol = st.solution;
  if (!sol) problems.push('NO REFERENCE SOLUTION');
  const { circuit, errs } = build(st, sol);
  problems.push(...errs);
  if (sol && !errs.length) {
    problems.push(...structure(st, sol, circuit));
    const res = judge(st, circuit);
    if (!res.ok) problems.push('REFERENCE FAILS ' + res.why);
    else notes.push(res.why);
    const n = nandCount(circuit);
    if (n !== st.gold) problems.push(`NAND ${n} != GOLD ${st.gold}`);
    if (!(st.gold <= st.silver)) problems.push(`GOLD ${st.gold} > SILVER ${st.silver}`);
    notes.push(`NAND ${n}`);
  }
  if (judge(st, build(st, null).circuit).ok) problems.push('EMPTY SHEET PASSES');
  problems.push(...jaChecks(st));
  if (st.prog) {
    if (prevProg && sol) {
      if (JSON.stringify(prevProg.solution) === JSON.stringify(sol)) notes.push(`SAME CPU AS ${prevProg.id}`);
      else {
        const old = judge(st, build(st, prevProg.solution).circuit);
        if (old.ok) problems.push(`${prevProg.id} REFERENCE ALSO PASSES`);
        else notes.push(`${prevProg.id} FAILS ${old.why}`);
      }
    }
    prevProg = st;
  }
  if (problems.length) failed++;
  console.log(`${problems.length ? 'FAIL' : 'OK  '} ${st.num.padEnd(5)} ${st.id.padEnd(7)} ${st.title.padEnd(22)} gold ${String(st.gold).padStart(6)}  ${[...problems, ...notes].join('; ')}`);
}
// The FizzBuzz demo on the stage that offers it, run to the end like the DEMO control does.
function demoCheck() {
  const t = performance.now();
  const st = STAGES.find((s) => s.demo);
  if (!st) return ['NO STAGE OFFERS THE DEMO'];
  const words = assemble(st.demo);
  const want = fizzbuzzText();
  if (words.length * 4 > 0x400) return [`${words.length} WORDS RUN INTO THE DATA AT 80000400`];
  const ref = refRun(words);
  if (ref.uart !== want) return [`REFERENCE INTERPRETER PRINTS ${JSON.stringify(ref.uart.slice(0, 40))}...`];
  const m = startProgram({ words, outs: st.outs }, build(st, st.solution).circuit);
  let n = 0;
  for (; !m.done() && n < ref.steps; n++) {
    const { pc, why } = m.step();
    if (why) return [`STEP ${n} PC ${pc.toString(16).toUpperCase().padStart(8, '0')}: ${why}`];
  }
  if (!m.done()) return [`NOT DONE AFTER ${n} STEPS`];
  if (m.uart !== want) return [`SERIAL ${JSON.stringify(m.uart.slice(0, 40))}...`];
  return { notes: `${words.length} WORDS; ${n} INSTRUCTIONS; ${want.split('\n').length - 1} LINES; ${secs(t)}` };
}
const demo = demoCheck();
const demoFail = Array.isArray(demo);
console.log(`${demoFail ? 'FAIL' : 'OK  '} DEMO  FIZZBUZZ ON ${STAGES.find((s) => s.demo)?.id ?? '-'}  ${demoFail ? demo.join('; ') : demo.notes}`);

// Japanese for the demo's prose (renderDemo and renderDemoControls in js/main.js).
const demoJa = [
  ['ui.demo.idle', JA.ui?.demo?.idle],
  ['ui.demo.stopped', JA.ui?.demo?.stopped],
  ['ui.demo.locked', JA.ui?.demo?.locked],
  ['ui.why.SERIAL OUTPUT DIFFERS', JA.ui?.why?.['SERIAL OUTPUT DIFFERS']],
  ['ui.verify.stopped', JA.ui?.verify?.stopped],
]
  .filter(([, v]) => !filled(v))
  .map(([k]) => k);
const noJa = BADGES.filter((b) => !filled(JA.badges?.[b.id])).map((b) => b.id);
const unknownJa = Object.keys(JA.stages).filter((id) => !STAGES.some((s) => s.id === id));
if (noJa.length) console.log(`FAIL QUALIFICATIONS WITHOUT A JAPANESE DESCRIPTION: ${noJa.join(' ')}`);
if (unknownJa.length) console.log(`FAIL JAPANESE TEXT FOR UNKNOWN STAGES: ${unknownJa.join(' ')}`);
if (demoJa.length) console.log(`FAIL NO JAPANESE FOR ${demoJa.join(', ')}`);
const jaFail = noJa.length > 0 || unknownJa.length > 0 || demoJa.length > 0;
if (!jaFail) console.log(`OK   JAPANESE TEXT FOR ${STAGES.length} STAGES AND ${BADGES.length} QUALIFICATIONS`);
console.log(failed ? `${failed} OF ${STAGES.length} STAGES FAIL` : demoFail ? `ALL ${STAGES.length} STAGES OK, DEMO FAILS` : jaFail ? `ALL ${STAGES.length} STAGES OK, JAPANESE TEXT INCOMPLETE` : `ALL ${STAGES.length} STAGES OK`);
console.log(`ELAPSED ${secs(t0)}`);
process.exit(failed || jaFail || demoFail ? 1 : 0);

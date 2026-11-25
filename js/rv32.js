// RV32I support for the CPU drawings: a small assembler, a disassembler, a
// reference interpreter, and the harness that runs a program on a drawn CPU in
// lockstep with the reference.
//
// Scope: OP, OP-IMM, loads and stores of words, half-words and bytes, branches,
// JAL, JALR, LUI and AUIPC: RV32I without ECALL, EBREAK and FENCE.

import { evaluate, newMem, aluFn, loadFn, storeFn, immI, immS, immB, immU, immJ, RAM_BASE } from './sim.js';

export const UART = 0x10000000;
const HALT = 0x0000006f; // jal x0, 0: jump to self
const u = (x) => x >>> 0;
const hex = (v) => u(v).toString(16).toUpperCase().padStart(8, '0');
const bin4 = (m) => m.toString(2).padStart(4, '0');
// Byte mask -> bit mask over the word.
const lanes = (m) => u((m & 1 ? 0xff : 0) | (m & 2 ? 0xff00 : 0) | (m & 4 ? 0xff0000 : 0) | (m & 8 ? 0xff000000 : 0));
// A byte as the serial console shows it. Newline stays real; other control and
// non-ASCII bytes become '.' so a wrong CPU cannot garble the panel.
const serialChar = (b) => (b === 10 ? '\n' : b >= 32 && b < 127 ? String.fromCharCode(b) : '.');

// name: [format, opcode, funct3, funct7]
const OPS = {
  add: ['R', 0x33, 0, 0],
  sub: ['R', 0x33, 0, 0x20],
  sll: ['R', 0x33, 1, 0],
  slt: ['R', 0x33, 2, 0],
  sltu: ['R', 0x33, 3, 0],
  xor: ['R', 0x33, 4, 0],
  srl: ['R', 0x33, 5, 0],
  sra: ['R', 0x33, 5, 0x20],
  or: ['R', 0x33, 6, 0],
  and: ['R', 0x33, 7, 0],
  addi: ['I', 0x13, 0],
  slti: ['I', 0x13, 2],
  sltiu: ['I', 0x13, 3],
  xori: ['I', 0x13, 4],
  ori: ['I', 0x13, 6],
  andi: ['I', 0x13, 7],
  slli: ['SH', 0x13, 1, 0],
  srli: ['SH', 0x13, 5, 0],
  srai: ['SH', 0x13, 5, 0x20],
  lb: ['I', 0x03, 0],
  lh: ['I', 0x03, 1],
  lw: ['I', 0x03, 2],
  lbu: ['I', 0x03, 4],
  lhu: ['I', 0x03, 5],
  jalr: ['I', 0x67, 0],
  sb: ['S', 0x23, 0],
  sh: ['S', 0x23, 1],
  sw: ['S', 0x23, 2],
  beq: ['B', 0x63, 0],
  bne: ['B', 0x63, 1],
  blt: ['B', 0x63, 4],
  bge: ['B', 0x63, 5],
  bltu: ['B', 0x63, 6],
  bgeu: ['B', 0x63, 7],
  lui: ['U', 0x37],
  auipc: ['U', 0x17],
  jal: ['J', 0x6f],
};
// Assemble a list of lines. A string is a label; an array is
// [mnemonic, ...operands] with operands in assembly order:
//   R: rd, rs1, rs2      I: rd, rs1, imm      SH: rd, rs1, shamt
//   S: rs2, rs1, imm     B: rs1, rs2, label   U: rd, imm20      J: rd, label
// An instruction may end with a comment, a string starting with ';'. Operands
// are read by position, so the assembler never sees it.
export function assemble(lines) {
  const labels = labelOffsets(lines);
  const out = [];
  for (const l of lines) {
    if (typeof l === 'string') continue;
    const a = l.slice(1);
    const [fmt, op, f3, f7] = OPS[l[0]];
    const rel = (t) => (typeof t === 'string' ? labels[t] - out.length * 4 : t);
    let w;
    if (fmt === 'R') w = (f7 << 25) | (a[2] << 20) | (a[1] << 15) | (f3 << 12) | (a[0] << 7) | op;
    else if (fmt === 'I') w = ((a[2] & 0xfff) << 20) | (a[1] << 15) | (f3 << 12) | (a[0] << 7) | op;
    else if (fmt === 'SH') w = (f7 << 25) | ((a[2] & 31) << 20) | (a[1] << 15) | (f3 << 12) | (a[0] << 7) | op;
    else if (fmt === 'S') w = (((a[2] >> 5) & 0x7f) << 25) | (a[0] << 20) | (a[1] << 15) | (f3 << 12) | ((a[2] & 31) << 7) | op;
    else if (fmt === 'B') {
      const d = rel(a[2]);
      w = (((d >> 12) & 1) << 31) | (((d >> 5) & 63) << 25) | (a[1] << 20) | (a[0] << 15) | (f3 << 12) | (((d >> 1) & 15) << 8) | (((d >> 11) & 1) << 7) | op;
    } else if (fmt === 'U') w = ((a[1] & 0xfffff) << 12) | (a[0] << 7) | op;
    else {
      const d = rel(a[1]);
      w = (((d >> 20) & 1) << 31) | (((d >> 1) & 1023) << 21) | (((d >> 11) & 1) << 20) | (((d >> 12) & 255) << 12) | (a[0] << 7) | op;
    }
    out.push(u(w));
  }
  return out;
}

// Byte offset of each label from the start of the program.
function labelOffsets(lines) {
  const labels = {};
  let count = 0;
  for (const l of lines) typeof l === 'string' ? (labels[l] = count * 4) : count++;
  return labels;
}

// Address -> label name (capitals, as listings print it). The first label
// wins where several mark the same address.
export function labelNames(lines, base = RAM_BASE) {
  const names = new Map();
  for (const [name, off] of Object.entries(labelOffsets(lines))) {
    const a = u(base + off);
    if (!names.has(a)) names.set(a, name.toUpperCase());
  }
  return names;
}

// The program as an assembler listing: one line per instruction with its
// address, machine word, the labels that mark it, the text with branch and
// jump targets named, and the comment if it has one. The text comes from
// disassembling the word, so listing and trace read alike.
export function listing(lines, base = RAM_BASE) {
  const words = assemble(lines);
  const names = labelNames(lines, base);
  const out = [];
  let labels = [];
  for (const l of lines) {
    if (typeof l === 'string') {
      labels.push(l.toUpperCase());
      continue;
    }
    const k = out.length;
    const addr = u(base + 4 * k);
    const last = l[l.length - 1];
    const comment = typeof last === 'string' && last.startsWith(';') ? last.slice(1).trim() : '';
    const text = disasm(words[k], (d) => names.get(u(addr + d)));
    out.push({ addr, word: words[k], labels, text, comment });
    labels = [];
  }
  return out;
}

// `at`, if given, maps a branch or jump offset to a label name; a target
// without one prints as the signed offset.
export function disasm(i, at) {
  const op = i & 127;
  const rd = (i >>> 7) & 31;
  const f3 = (i >>> 12) & 7;
  const rs1 = (i >>> 15) & 31;
  const rs2 = (i >>> 20) & 31;
  const hit = Object.entries(OPS).find(
    ([, [fmt, o, g, h]]) => o === op && (g === undefined || g === f3) && (fmt === 'R' || fmt === 'SH' ? h === i >>> 25 : true),
  );
  if (!hit) return `.WORD ${hex(i)}`;
  const [name, [fmt]] = hit;
  const n = name.toUpperCase();
  const s = (v) => v | 0;
  const off = (v) => (s(v) >= 0 ? '+' : '') + s(v);
  if (fmt === 'R') return `${n} X${rd}, X${rs1}, X${rs2}`;
  if (fmt === 'SH') return `${n} X${rd}, X${rs1}, ${rs2}`;
  if (fmt === 'I') return op === 0x03 ? `${n} X${rd}, ${s(immI(i))}(X${rs1})` : `${n} X${rd}, X${rs1}, ${s(immI(i))}`;
  if (fmt === 'S') return `${n} X${rs2}, ${s(immS(i))}(X${rs1})`;
  const target = (v) => at?.(s(v)) ?? off(v);
  if (fmt === 'B') return `${n} X${rs1}, X${rs2}, ${target(immB(i))}`;
  if (fmt === 'U') return `${n} X${rd}, 0x${(i >>> 12).toString(16).toUpperCase()}`;
  return `${n} X${rd}, ${target(immJ(i))}`;
}

// Execute one instruction on `s` = { pc, x[32] }. Returns the memory write it
// performs, if any: { addr, data, mask }, data already shifted into its lane,
// mask one bit per byte. JALR does not clear bit 0 of the target, matching the
// datapath the course builds. Other opcodes do nothing here.
export function refStep(s, read) {
  const i = read(s.pc);
  const op = i & 127;
  const rd = (i >>> 7) & 31;
  const f3 = (i >>> 12) & 7;
  const a = s.x[(i >>> 15) & 31];
  const c = s.x[(i >>> 20) & 31];
  const b30 = (i >>> 30) & 1;
  let next = u(s.pc + 4);
  let val = null;
  let write = null;
  if (op === 0x33) val = aluFn(a, c, f3, b30);
  else if (op === 0x13) val = aluFn(a, immI(i), f3, f3 === 5 ? b30 : 0);
  else if (op === 0x03) {
    const ad = u(a + immI(i));
    // LW keeps its old behaviour: the aligned word, whatever the low bits.
    val = f3 === 2 ? read(ad) : loadFn(read(ad), ad, f3);
  } else if (op === 0x23) {
    const ad = u(a + immS(i));
    if (f3 === 2) write = { addr: ad, data: c, mask: 15 };
    else {
      const [data, mask] = storeFn(c, ad, (f3 >> 1) & 1, f3 & 1);
      write = { addr: ad, data, mask };
    }
  } else if (op === 0x63) {
    const taken = [a === c, a !== c, false, false, (a | 0) < (c | 0), (a | 0) >= (c | 0), a < c, a >= c][f3];
    if (taken) next = u(s.pc + immB(i));
  } else if (op === 0x6f) {
    val = next;
    next = u(s.pc + immJ(i));
  } else if (op === 0x67) {
    val = next;
    next = u(a + immI(i));
  } else if (op === 0x37) val = immU(i);
  else if (op === 0x17) val = u(s.pc + immU(i));
  if (val != null && rd) s.x[rd] = val;
  s.pc = next;
  return write;
}

// Run the stage's program on the drawn CPU and compare it with the reference
// after every instruction. The CPU's pins are:
//   in:  inst (word at pc), rdata (word at addr), reset, clk
//   out: pc, addr, wdata, memw, and from section 8 wmask
// Memory is supplied here: the program sits at RAM_BASE, and a write to UART
// that covers byte 0 is collected as a character (its low byte). The register
// file is read straight out of the single REGFILE part on the sheet.
//
// memw says whether a step writes; wmask, where the stage has it, says which
// bytes (bit 0 = lowest). A wmask of 0000 with memw set writes the whole word,
// so CPU sheets from before section 8, which never drive wmask, keep working.
// A write matches the reference when addr and the effective mask are equal and
// wdata agrees on the bytes written; the other bytes of wdata are don't-care.
//
// Serial output is collected twice. `uart` is what the drawn CPU printed: a step
// where it drives memw with addr = UART before the clock edge, taking the low
// byte of wdata. `uartExpected` is what the reference printed. Each row carries
// `out`, the drawn CPU's output so far including that step, so the console can
// be shown as of any row.
//
// With `upto`, stop with the circuit settled on instruction number `upto`, not
// yet clocked, so the sheet can show that instruction flowing through.
export function runProgram(stage, circuit, upto = Infinity) {
  const m = startProgram(stage, circuit);
  const names = labelNames(stage.prog || []);
  const rows = [];
  for (let step = 0; step < 300; step++) {
    if (m.done() || step === upto) break;
    const { pc, inst, why } = m.step();
    rows.push({ pc, inst, text: disasm(inst, (d) => names.get(u(pc + d))), ok: !why, why, out: m.uart });
  }
  return { rows, uart: m.uart, uartExpected: m.uartExpected, mem: m.mem, inputs: m.inputs };
}

// Apply a reference write to `ram`. A write to the UART changes no memory; it
// returns the character it prints, if it covers byte 0.
function apply(ram, w) {
  if (w.addr === UART) return w.mask & 1 ? serialChar(w.data & 255) : '';
  const k = u(w.addr & ~3);
  const bits = lanes(w.mask);
  ram.set(k, u(((ram.get(k) || 0) & ~bits) | (w.data & bits)));
  return '';
}

// The drawn CPU powered on and reset at the start of `stage.words`, next to the
// reference. `step()` runs one instruction on both and returns { pc, inst, why },
// `why` empty when they agree; `done()` says the reference has reached the end
// or the halt loop. `uart`, `uartExpected`, `mem` and `inputs` are live.
export function startProgram(stage, circuit) {
  const ram = new Map(stage.words.map((w, k) => [u(RAM_BASE + 4 * k), w]));
  const read = (addr) => ram.get(u(addr & ~3)) || 0;
  const end = u(RAM_BASE + 4 * stage.words.length);
  const ref = { pc: RAM_BASE, x: Array(32).fill(0) };
  const hasMask = stage.outs.includes('wmask');
  const mem = newMem();
  const inputs = { 'in:inst': 0, 'in:rdata': 0, 'in:reset': 1, 'in:clk': 0 };
  const regfiles = circuit.nodes.filter((n) => n.type === 'regfile');
  let r;
  const out = (name) => r.outs['out:' + name];
  // The memory answers combinationally, so feed it back until nothing changes.
  const settle = () => {
    for (let k = 0; k < 6; k++) {
      r = evaluate(circuit, inputs, mem);
      const inst = read(out('pc'));
      const rdata = read(out('addr'));
      if (inst === inputs['in:inst'] && rdata === inputs['in:rdata']) break;
      inputs['in:inst'] = inst;
      inputs['in:rdata'] = rdata;
    }
  };
  const clock = () => {
    inputs['in:clk'] = 1;
    evaluate(circuit, inputs, mem);
    inputs['in:clk'] = 0;
  };

  settle();
  clock();
  inputs['in:reset'] = 0;
  settle();

  const m = { uart: '', uartExpected: '', mem, inputs, ref };
  m.done = () => ref.pc === end || read(ref.pc) === HALT;
  m.step = () => {
    const pc = ref.pc;
    const inst = read(pc);
    const got = { pc: out('pc'), memw: out('memw'), addr: out('addr'), wdata: out('wdata'), stable: r.stable };
    const gmask = got.memw ? (hasMask && out('wmask')) || 15 : 0;
    // Judge the drawn CPU by what it drives, not by what the reference does.
    if (got.memw && got.addr === UART && gmask & 1) m.uart += serialChar(got.wdata & 255);
    const write = refStep(ref, read);
    clock();
    if (write) m.uartExpected += apply(ram, write);
    settle();

    let why = '';
    const x = mem.st[regfiles[0]?.id]?.x || [];
    const reg = ref.x.findIndex((v, k) => (x[k] || 0) !== v);
    if (!got.stable || !r.stable) why = 'CIRCUIT DOES NOT SETTLE';
    else if (got.pc !== pc) why = `PC = ${hex(got.pc)}, WANT ${hex(pc)}`;
    else if (!!got.memw !== !!write) why = write ? 'MEMORY WRITE MISSING' : 'UNEXPECTED MEMORY WRITE';
    else if (write && (got.addr !== write.addr || gmask !== write.mask || (got.wdata ^ write.data) & lanes(write.mask)))
      why = hasMask
        ? `WROTE ${hex(got.wdata)} MASK ${bin4(gmask)} AT ${hex(got.addr)}, WANT ${hex(write.data)} MASK ${bin4(write.mask)} AT ${hex(write.addr)}`
        : `WROTE ${hex(got.wdata)} AT ${hex(got.addr)}, WANT ${hex(write.data)} AT ${hex(write.addr)}`;
    else if (regfiles.length !== 1) why = 'THE SHEET NEEDS EXACTLY ONE REGFILE';
    else if (reg >= 0) why = `X${reg} = ${hex(x[reg] || 0)}, WANT ${hex(ref.x[reg])}`;
    else if (out('pc') !== ref.pc) why = `NEXT PC = ${hex(out('pc'))}, WANT ${hex(ref.pc)}`;
    return { pc, inst, why };
  };
  return m;
}

// Run the reference alone to the end: instruction count, serial output and the
// set of addresses it reaches. Cheap; used for a long demo's progress and listing.
export function refRun(words, limit = 1e6) {
  const ram = new Map(words.map((w, k) => [u(RAM_BASE + 4 * k), w]));
  const read = (addr) => ram.get(u(addr & ~3)) || 0;
  const end = u(RAM_BASE + 4 * words.length);
  const s = { pc: RAM_BASE, x: Array(32).fill(0) };
  const reached = new Set();
  let uart = '';
  let steps = 0;
  for (; steps < limit && s.pc !== end && read(s.pc) !== HALT; steps++) {
    reached.add(s.pc);
    const w = refStep(s, read);
    if (w) uart += apply(ram, w);
  }
  return { steps, uart, reached };
}

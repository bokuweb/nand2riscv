// Circuit model and evaluation.
//
// A circuit is { nodes: [{ id, type, x, y }], wires: [{ id, from: [nodeId, port], to: [nodeId, port] }] }.
// Node types: 'in' (stage input pin), 'out' (stage output pin), or a key of PARTS.
// `cost` is the NAND-equivalent size of a part, used for scoring.
//
// A part is either combinational (`fn(ins) -> outs`) or stateful:
//   init() -> state, out(ins, state) -> outs, commit(ins, state) mutates state.
// `out` must depend only on the committed state; `commit` runs once the
// circuit has settled, so every stateful part samples the same instant.
//
// Terminals are 1 bit wide unless the part gives `iw` / `ow` (widths per input /
// output). Bus values are unsigned integers.

const b = (x) => (x ? 1 : 0);
const u = (x) => x >>> 0;
export const RAM_BASE = 0x80000000;
// Rising edge detector over a state's `pc` (previous clock) field.
const rise = (st, clk) => {
  const r = clk && !st.pc;
  st.pc = clk;
  return r;
};

export const PARTS = {
  nand: { label: 'NAND', ins: ['a', 'b'], outs: ['out'], cost: 1, sym: true, fn: ([a, c]) => [b(!(a && c))] },
  not: { label: 'NOT', ins: ['in'], outs: ['out'], cost: 1, sym: true, fn: ([a]) => [b(!a)] },
  and: { label: 'AND', ins: ['a', 'b'], outs: ['out'], cost: 2, sym: true, fn: ([a, c]) => [b(a && c)] },
  or: { label: 'OR', ins: ['a', 'b'], outs: ['out'], cost: 3, sym: true, fn: ([a, c]) => [b(a || c)] },
  nor: { label: 'NOR', ins: ['a', 'b'], outs: ['out'], cost: 4, sym: true, fn: ([a, c]) => [b(!(a || c))] },
  xor: { label: 'XOR', ins: ['a', 'b'], outs: ['out'], cost: 4, sym: true, fn: ([a, c]) => [b(a !== c)] },
  xnor: { label: 'XNOR', ins: ['a', 'b'], outs: ['out'], cost: 5, sym: true, fn: ([a, c]) => [b(a === c)] },
  mux: { label: 'MUX', ins: ['a', 'b', 'sel'], outs: ['out'], cost: 4, fn: ([a, c, s]) => [s ? c : a] },
  dmux: { label: 'DMUX', ins: ['in', 'sel'], outs: ['a', 'b'], cost: 4, fn: ([x, s]) => [s ? 0 : x, s ? x : 0] },
  half: { label: 'HALF', ins: ['a', 'b'], outs: ['sum', 'carry'], cost: 5, fn: ([a, c]) => [a ^ c, a & c] },
  full: {
    label: 'FULL',
    ins: ['a', 'b', 'c'],
    outs: ['sum', 'carry'],
    cost: 9,
    fn: ([a, c, d]) => [a ^ c ^ d, b(a + c + d >= 2)],
  },
  sr: {
    label: 'SR',
    ins: ['s', 'r'],
    outs: ['q'],
    cost: 4,
    init: () => ({ q: 0 }),
    out: ([s, r], st) => [r ? 0 : s ? 1 : st.q],
    commit: ([s, r], st) => {
      if (r) st.q = 0;
      else if (s) st.q = 1;
    },
  },
  dlatch: {
    label: 'DLATCH',
    ins: ['d', 'en'],
    outs: ['q'],
    cost: 4,
    init: () => ({ q: 0 }),
    out: ([d, en], st) => [en ? d : st.q],
    commit: ([d, en], st) => {
      if (en) st.q = d;
    },
  },
  dff: {
    label: 'DFF',
    ins: ['d', 'clk'],
    outs: ['q'],
    cost: 9,
    init: () => ({ q: 0, pc: 0 }),
    out: (_, st) => [st.q],
    commit: ([d, clk], st) => {
      if (rise(st, clk)) st.q = d;
    },
  },
  reg: {
    label: 'REG',
    ins: ['d', 'load', 'clk'],
    outs: ['q'],
    cost: 13,
    init: () => ({ q: 0, pc: 0 }),
    out: (_, st) => [st.q],
    commit: ([d, load, clk], st) => {
      if (rise(st, clk) && load) st.q = d;
    },
  },
};

// ---- 32-bit parts ----
// The plain ones are 32 copies of a 1-bit part side by side, so they cost 32x.
// Constants, taps, extensions and fixed shifts are wiring only and cost nothing.

// Immediate of each RV32 instruction format, sign-extended to 32 bits.
export const immI = (i) => u((i | 0) >> 20);
export const immS = (i) => u((((i | 0) >> 25) << 5) | ((i >>> 7) & 31));
export const immB = (i) => u((((i | 0) >> 31) << 12) | (((i >>> 7) & 1) << 11) | (((i >>> 25) & 63) << 5) | (((i >>> 8) & 15) << 1));
export const immU = (i) => u(i & 0xfffff000);
export const immJ = (i) => u((((i | 0) >> 31) << 20) | (((i >>> 12) & 255) << 12) | (((i >>> 20) & 1) << 11) | (((i >>> 21) & 1023) << 1));
// Major opcodes, in the order of OPDEC's one-hot outputs.
const OPCODES = [0x33, 0x13, 0x03, 0x23, 0x63, 0x6f, 0x67, 0x37, 0x17];

// RV32 ALU function, selected by funct3 `f` and the funct7 bit `alt`.
export function aluFn(a, c, f, alt) {
  const sh = c & 31;
  switch (f) {
    case 0:
      return u(alt ? a - c : a + c);
    case 1:
      return u(a << sh);
    case 2:
      return b((a | 0) < (c | 0));
    case 3:
      return b(a < c);
    case 4:
      return u(a ^ c);
    case 5:
      return alt ? u((a | 0) >> sh) : a >>> sh;
    case 6:
      return u(a | c);
    default:
      return u(a & c);
  }
}
// Section 8: the value a load returns from the word at the aligned address.
// f3 is funct3: f1 picks the whole word, else f0 picks half-word over byte,
// and f2 asks for zero- instead of sign-extension. Bits 1 and 0 of addr move
// the addressed byte down to bit 0 first (LOAD UNIT drawing, same structure).
export function loadFn(word, addr, f3) {
  const v = word >>> ((addr & 3) * 8);
  if (f3 & 2) return v;
  if (f3 & 1) return f3 & 4 ? v & 0xffff : u((v << 16) >> 16);
  return f3 & 4 ? v & 0xff : u((v << 24) >> 24);
}
// Store data shifted into its lane, and the 4-bit byte mask (bit 0 = lowest byte).
// f1 f0 are funct3 bits 1 and 0: 00 SB, 01 SH, 10 SW.
export function storeFn(data, addr, f1, f0) {
  const a1 = (addr >>> 1) & 1;
  const a0 = addr & 1;
  let mask = 0;
  for (let i = 0; i < 4; i++) if (f1 || ((i >> 1 === a1) && (f0 || (i & 1) === a0))) mask |= 1 << i;
  return [u(data << ((addr & 3) * 8)), mask];
}
// a + b + cin as [sum, carry out].
const add = (a, c, cin) => {
  const s = a + c + cin;
  return [u(s), b(s > 0xffffffff)];
};
const bus = (label, ins, iw, outs, ow, cost, fn) => ({ label, ins, iw, outs, ow, cost, fn });
const konst = (label, width, value) => ({ label, ins: [], outs: ['out'], ow: [width], cost: 0, fn: () => [value] });

Object.assign(PARTS, {
  k0: konst('0', 1, 0),
  k1: konst('1', 1, 1),
  z32: konst('ZERO32', 32, 0),
  k4: konst('FOUR32', 32, 4),
  kbase: konst('BASE32', 32, RAM_BASE),
  not32: bus('NOT32', ['a'], [32], ['out'], [32], 32, ([a]) => [u(~a)]),
  and32: bus('AND32', ['a', 'b'], [32, 32], ['out'], [32], 64, ([a, c]) => [u(a & c)]),
  or32: bus('OR32', ['a', 'b'], [32, 32], ['out'], [32], 96, ([a, c]) => [u(a | c)]),
  xor32: bus('XOR32', ['a', 'b'], [32, 32], ['out'], [32], 128, ([a, c]) => [u(a ^ c)]),
  mux32: bus('MUX32', ['a', 'b', 'sel'], [32, 32, 1], ['out'], [32], 128, ([a, c, s]) => [s ? c : a]),
  add32: bus('ADD32', ['a', 'b', 'cin'], [32, 32, 1], ['sum', 'cout'], [32, 1], 288, ([a, c, ci]) => add(a, c, ci)),
  rep32: bus('REP32', ['in'], [1], ['out'], [32], 0, ([x]) => [x ? 0xffffffff : 0]),
  zext32: bus('ZEXT32', ['in'], [1], ['out'], [32], 0, ([x]) => [x]),
  msb32: bus('MSB32', ['a'], [32], ['out'], [1], 0, ([a]) => [a >>> 31]),
  any32: bus('ANY32', ['a'], [32], ['out'], [1], 93, ([a]) => [b(a !== 0)]),
  ...Object.fromEntries([1, 2, 4, 8, 16].map((k) => ['shl' + k, bus('SHL' + k, ['a'], [32], ['out'], [32], 0, ([a]) => [u(a << k)])])),
  reg32: {
    label: 'REG32',
    ins: ['d', 'load', 'clk'],
    iw: [32, 1, 1],
    outs: ['q'],
    ow: [32],
    cost: 416,
    init: () => ({ q: 0, pc: 0 }),
    out: (_, st) => [st.q],
    commit: ([d, load, clk], st) => {
      if (rise(st, clk) && load) st.q = d;
    },
  },
  // Released by section 5 drawings.
  addsub: bus('ADDSUB', ['a', 'b', 'sub'], [32, 32, 1], ['out', 'cout'], [32, 1], 416, ([a, c, s]) => add(a, s ? u(~c) : c, s)),
  cmp: bus('CMP32', ['a', 'b'], [32, 32], ['eq', 'ltu', 'lt'], [1, 1, 1], 525, ([a, c]) => [b(a === c), b(a < c), b((a | 0) < (c | 0))]),
  sll32: bus('SLL32', ['a', 'b'], [32, 32], ['out'], [32], 640, ([a, c]) => [aluFn(a, c, 1, 0)]),
  srl32: bus('SRL32', ['a', 'b'], [32, 32], ['out'], [32], 640, ([a, c]) => [aluFn(a, c, 5, 0)]),
  sra32: bus('SRA32', ['a', 'b'], [32, 32], ['out'], [32], 672, ([a, c]) => [aluFn(a, c, 5, 1)]),
  alu: bus('ALU', ['a', 'b', 'f2', 'f1', 'f0', 'alt'], [32, 32, 1, 1, 1, 1], ['out'], [32], 4205, ([a, c, f2, f1, f0, alt]) => [
    aluFn(a, c, f2 * 4 + f1 * 2 + f0, alt),
  ]),
  regfile: {
    label: 'REGFILE',
    ins: ['wd', 'we', 'rd', 'rs1', 'rs2', 'clk'],
    iw: [32, 1, 5, 5, 5, 1],
    outs: ['r1', 'r2'],
    ow: [32, 32],
    cost: 14000,
    init: () => ({ x: Array(32).fill(0), pc: 0 }),
    out: ([, , , rs1, rs2], st) => [st.x[rs1], st.x[rs2]],
    commit: ([wd, we, rd, , , clk], st) => {
      if (rise(st, clk) && we && rd) st.x[rd] = wd;
    },
  },
  // Section 6: instruction fields are wiring only. OPDEC is nine 5-input ANDs.
  opdec: bus('OPDEC', ['inst'], [32], ['op', 'opimm', 'load', 'store', 'branch', 'jal', 'jalr', 'lui', 'auipc'], [], 77, ([i]) =>
    OPCODES.map((o) => b((i & 127) === o)),
  ),
  f_rd: bus('RD', ['inst'], [32], ['rd'], [5], 0, ([i]) => [(i >>> 7) & 31]),
  f_rs1: bus('RS1', ['inst'], [32], ['rs1'], [5], 0, ([i]) => [(i >>> 15) & 31]),
  f_rs2: bus('RS2', ['inst'], [32], ['rs2'], [5], 0, ([i]) => [(i >>> 20) & 31]),
  f_f3: bus('FUNCT3', ['inst'], [32], ['f2', 'f1', 'f0'], [], 0, ([i]) => [(i >>> 14) & 1, (i >>> 13) & 1, (i >>> 12) & 1]),
  f_b30: bus('BIT30', ['inst'], [32], ['out'], [], 0, ([i]) => [(i >>> 30) & 1]),
  imm_i: bus('IMM-I', ['inst'], [32], ['imm'], [32], 0, ([i]) => [immI(i)]),
  imm_s: bus('IMM-S', ['inst'], [32], ['imm'], [32], 0, ([i]) => [immS(i)]),
  imm_b: bus('IMM-B', ['inst'], [32], ['imm'], [32], 0, ([i]) => [immB(i)]),
  imm_u: bus('IMM-U', ['inst'], [32], ['imm'], [32], 0, ([i]) => [immU(i)]),
  imm_j: bus('IMM-J', ['inst'], [32], ['imm'], [32], 0, ([i]) => [immJ(i)]),
  immgen: bus('IMMGEN', ['inst', 's', 'b', 'u', 'j'], [32], ['imm'], [32], 512, ([i, s, bb, uu, j]) => [
    j ? immJ(i) : uu ? immU(i) : bb ? immB(i) : s ? immS(i) : immI(i),
  ]),
  brcond: {
    label: 'BRCOND',
    ins: ['eq', 'ltu', 'lt', 'f2', 'f1', 'f0'],
    outs: ['taken'],
    cost: 12,
    fn: ([eq, ltu, lt, f2, f1, f0]) => [(f2 ? (f1 ? ltu : lt) : eq) ^ f0],
  },
  pc: {
    label: 'PC',
    ins: ['target', 'jump', 'reset', 'clk'],
    iw: [32, 1, 1, 1],
    outs: ['pc'],
    ow: [32],
    cost: 960,
    init: () => ({ q: 0, pc: 0 }),
    out: (_, st) => [st.q],
    commit: ([target, jump, reset, clk], st) => {
      if (rise(st, clk)) st.q = reset ? RAM_BASE : jump ? target : u(st.q + 4);
    },
  },
  // Section 8 wiring: fixed right shifts, address bits 1 and 0, byte and half-word
  // extensions and a 4-line joiner.
  shr8: bus('SHR8', ['a'], [32], ['out'], [32], 0, ([a]) => [a >>> 8]),
  shr16: bus('SHR16', ['a'], [32], ['out'], [32], 0, ([a]) => [a >>> 16]),
  low2: bus('LOW2', ['a'], [32], ['a1', 'a0'], [], 0, ([a]) => [(a >>> 1) & 1, a & 1]),
  sext8: bus('SEXT8', ['a'], [32], ['out'], [32], 0, ([a]) => [u((a << 24) >> 24)]),
  zext8: bus('ZEXT8', ['a'], [32], ['out'], [32], 0, ([a]) => [a & 0xff]),
  sext16: bus('SEXT16', ['a'], [32], ['out'], [32], 0, ([a]) => [u((a << 16) >> 16)]),
  zext16: bus('ZEXT16', ['a'], [32], ['out'], [32], 0, ([a]) => [a & 0xffff]),
  join4: bus('JOIN4', ['b3', 'b2', 'b1', 'b0'], [], ['out'], [4], 0, ([b3, b2, b1, b0]) => [b3 * 8 + b2 * 4 + b1 * 2 + b0]),
  // Released by section 8 drawings.
  loadunit: bus('LOADUNIT', ['rdata', 'addr', 'f2', 'f1', 'f0'], [32, 32, 1, 1, 1], ['out'], [32], 768, ([w, a, f2, f1, f0]) => [
    loadFn(w, a, f2 * 4 + f1 * 2 + f0),
  ]),
  storeunit: bus('STOREUNIT', ['data', 'addr', 'f1', 'f0'], [32, 32, 1, 1], ['wdata', 'mask'], [32, 4], 270, ([d, a, f1, f0]) => storeFn(d, a, f1, f0)),
});

// Simulation memory carried between evaluations: wire values and part states.
export const newMem = () => ({ vals: {}, st: {} });

// Relax the circuit from its previous values until no output changes, then
// let stateful parts commit, and repeat until nothing moves. Feedback loops are
// allowed; `stable` is false when the circuit keeps oscillating.
export function evaluate({ nodes, wires }, inputs, mem = newMem()) {
  const drv = {};
  for (const w of wires) drv[w.to[0] + ':' + w.to[1]] = w.from[0] + ':' + w.from[1];
  const { vals, st } = mem;
  const insOf = (n, p) => p.ins.map((_, i) => vals[drv[n.id + ':' + i]] || 0);
  const stateful = nodes.filter((n) => PARTS[n.type]?.commit);
  let stable = false;

  for (let round = 0; round < 16; round++) {
    stable = false;
    for (let it = 0; it < 64 && !stable; it++) {
      stable = true;
      for (const n of nodes) {
        if (n.type === 'out') continue;
        let o;
        if (n.type === 'in') o = [inputs[n.id] >>> 0];
        else {
          const p = PARTS[n.type];
          o = p.out ? p.out(insOf(n, p), (st[n.id] ??= p.init())) : p.fn(insOf(n, p));
        }
        o.forEach((x, j) => {
          const k = n.id + ':' + j;
          if ((vals[k] || 0) !== x) {
            vals[k] = x;
            stable = false;
          }
        });
      }
    }
    // Sample every stateful part against the same settled values.
    const sampled = stateful.map((n) => insOf(n, PARTS[n.type]));
    let moved = false;
    stateful.forEach((n, i) => {
      const s = (st[n.id] ??= PARTS[n.type].init());
      const before = JSON.stringify(s);
      PARTS[n.type].commit(sampled[i], s);
      if (JSON.stringify(s) !== before) moved = true;
    });
    if (!moved) break;
  }

  const outs = {};
  for (const n of nodes) if (n.type === 'out') outs[n.id] = vals[drv[n.id + ':0']] || 0;
  return { vals, stable, outs, drv };
}

export function nandCount({ nodes }) {
  return nodes.reduce((s, n) => s + (PARTS[n.type]?.cost || 0), 0);
}

// The stage's test rows with expected outputs and, when a circuit is given,
// what the circuit actually produces.
//  - Combinational stage (`fn`): every input combination (or the listed `vec`), each from power-on.
//  - Clocked stage (`seq` + `model`): the input vectors applied in order to one
//    powered-on circuit. An expected value of null means "don't care".
export function truthTable(stage, circuit) {
  const run = (ins, exp, mem) => {
    let got = null;
    let ok = false;
    if (circuit) {
      const r = evaluate(circuit, Object.fromEntries(stage.ins.map((nm, i) => ['in:' + nm, ins[i]])), mem);
      got = stage.outs.map((o) => r.outs['out:' + o]);
      ok = r.stable && exp.every((e, i) => e == null || e === got[i]);
    }
    return { ins, exp, got, ok };
  };
  if (stage.seq) {
    const mem = newMem();
    const ms = stage.model.init();
    return stage.seq.map((ins) => run(ins, stage.model.step(ms, ins), mem));
  }
  // Bus stages list their test vectors instead of enumerating every input.
  if (stage.vec) return stage.vec.map((ins) => run(ins, stage.fn(ins), newMem()));
  const n = stage.ins.length;
  const rows = [];
  for (let k = 0; k < 1 << n; k++) {
    const ins = stage.ins.map((_, i) => (k >> (n - 1 - i)) & 1);
    rows.push(run(ins, stage.fn(ins), newMem()));
  }
  return rows;
}

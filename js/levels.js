// Sections, drawings (stages) and qualifications. All text is terse spec-sheet English.
//
// A playable stage: { id, title, goal, story, ins, outs, silver, gold, reward, hints } plus either
//   fn(ins) -> outs                      for a combinational stage, tested by truth table, or
//   model { init, step } and seq [ins..]  for a clocked stage, tested step by step against the model.
// Grade: C for a correct circuit, B for NAND count <= silver, A for NAND count <= gold.
// `reward` is the PARTS key (or keys) released for later stages. `w` gives pin widths for buses,
// `prog` is a program for a CPU drawing, run in lockstep with a reference (see rv32.js; an instruction may
// end with a '; comment' string, shown in the listing), and `inherit`
// names the stage whose saved sheet a CPU drawing starts from.
// and `vec` lists the test vectors of a bus stage in place of a full truth table. `zoom` enlarges the sheet
// for drawings with many parts. `demo` is a longer program a passed CPU drawing can run for show
// (RUN FIZZBUZZ on the stage screen); it scores nothing and never changes the save.
// `solution` is a reference netlist at the grade A NAND count (see SOLUTIONS).
// A section is { name, stages }, { name, planned: [titles] } when not issued yet, or both: issued
// stages followed by planned rows. An optional `goal` ('GOAL 2') is shown after the section name in
// the index.

import { PARTS, aluFn, loadFn, storeFn, immI, immS, immB, immU, immJ } from './sim.js';
import { assemble } from './rv32.js';
import { FIZZBUZZ } from './fizzbuzz.js';

// One instruction of each format, for the immediate generator's test vectors.
const IMMW = assemble(['top', ['bne', 1, 2, 'top'], ['addi', 1, 2, -5], ['sw', 3, 4, -36], ['beq', 1, 2, 'far'], ['lui', 5, 0xabcde], ['jal', 1, 'far'], ['jal', 0, 'top'], 'far']);

// Every CPU drawing has the same pins and palette. Memory is outside the sheet.
const CPU_IO = {
  ins: ['inst', 'rdata', 'reset', 'clk'],
  outs: ['pc', 'addr', 'wdata', 'memw'],
  w: { inst: 32, rdata: 32, pc: 32, addr: 32, wdata: 32 },
  zoom: 2.6,
  parts: [
    'pc', 'regfile', 'alu', 'cmp', 'immgen', 'brcond', 'opdec', 'f_rd', 'f_rs1', 'f_rs2', 'f_f3', 'f_b30', 'imm_i',
    'mux32', 'add32', 'z32', 'k4', 'k0', 'k1', 'not', 'and', 'or', 'nor',
  ],
};

// Section 8 CPUs add a 4-bit byte mask output for stores (see runProgram in rv32.js).
const CPU8_IO = {
  ...CPU_IO,
  outs: [...CPU_IO.outs, 'wmask'],
  w: { ...CPU_IO.w, wmask: 4 },
  zoom: 3,
  parts: [...CPU_IO.parts, 'loadunit', 'storeunit'],
};
// Test words for the load unit: every byte offset and both half-words see both signs.
const LDW = [0x7f80ff01, 0x80017ffe];
const LDF = { 0: [0, 1, 2, 3], 4: [0, 1, 2, 3], 1: [0, 2], 5: [0, 2], 2: [0] };
const maj = (a, b, c) => (a + b + c >= 2 ? 1 : 0);

export const WORLDS = [
  {
    name: 'LOGIC GATES',
    stages: [
      {
        id: 'not',
        title: 'NOT',
        goal: 'Invert the input. 0 gives 1, 1 gives 0.',
        story:
          'The only part in stock is NAND: output is 0 only when both inputs are 1. Every circuit in a computer can be built from this one part.',
        ins: ['in'],
        outs: ['out'],
        fn: ([a]) => [a ? 0 : 1],
        silver: 1,
        gold: 1,
        reward: 'not',
        hints: ['Feed the same signal to both NAND inputs.', 'Drag from the input pin to each NAND input, then from the NAND output to the output pin.'],
      },
      {
        id: 'and',
        title: 'AND',
        goal: 'Output 1 only when both inputs are 1.',
        story: 'NAND means NOT AND: it is AND with the result inverted. NOT is now in stock.',
        ins: ['a', 'b'],
        outs: ['out'],
        fn: ([a, c]) => [a & c],
        silver: 2,
        gold: 2,
        reward: 'and',
        hints: ['Invert the NAND output.', 'NAND, then NOT.'],
      },
      {
        id: 'or',
        title: 'OR',
        goal: 'Output 1 when at least one input is 1.',
        story: "De Morgan's law: a OR b equals NOT (NOT a AND NOT b).",
        ins: ['a', 'b'],
        outs: ['out'],
        fn: ([a, c]) => [a | c],
        silver: 4,
        gold: 3,
        reward: 'or',
        hints: ['Invert each input before the NAND.', 'NAND(NOT a, NOT b). Three NAND equivalents.'],
      },
      {
        id: 'nor',
        title: 'NOR',
        goal: 'Output 1 only when both inputs are 0.',
        story: 'NOR is OR inverted. Like NAND it is universal: any circuit can be built from NOR alone.',
        ins: ['a', 'b'],
        outs: ['out'],
        fn: ([a, c]) => [a | c ? 0 : 1],
        silver: 5,
        gold: 4,
        reward: 'nor',
        hints: ['Use the OR part.', 'OR, then NOT.'],
      },
      {
        id: 'xor',
        title: 'XOR',
        goal: 'Output 1 only when the inputs differ.',
        story: 'XOR is the core of addition. 0+0=0, 0+1=1, 1+0=1, 1+1=0 carry 1. The low digit of the sum is XOR.',
        ins: ['a', 'b'],
        outs: ['out'],
        fn: ([a, c]) => [a ^ c],
        silver: 6,
        gold: 4,
        reward: 'xor',
        hints: [
          'At least one input is 1, and not both.',
          '(a OR b) AND (a NAND b). Grade B.',
          'Grade A: build NAND(a, b) once and use its output twice. Four NAND total.',
        ],
      },
      {
        id: 'xnor',
        title: 'XNOR',
        goal: 'Output 1 only when the inputs are equal.',
        story: 'XNOR is a one-bit equality detector, the basic cell of a comparator.',
        ins: ['a', 'b'],
        outs: ['out'],
        fn: ([a, c]) => [a === c ? 1 : 0],
        silver: 6,
        gold: 5,
        reward: 'xnor',
        hints: ['The inverse of XOR.', 'XOR, then NOT.'],
      },
    ],
  },
  {
    name: 'ROUTING',
    stages: [
      {
        id: 'mux',
        title: 'MUX',
        goal: 'Output a when sel is 0. Output b when sel is 1.',
        story: 'A multiplexer is a switch driven by a signal: the hardware form of an if statement. It appears throughout a CPU.',
        ins: ['a', 'b', 'sel'],
        outs: ['out'],
        fn: ([a, c, s]) => [s ? c : a],
        silver: 8,
        gold: 4,
        reward: 'mux',
        hints: [
          'Either sel is 0 and a is 1, or sel is 1 and b is 1.',
          '(a AND NOT sel) OR (b AND sel). Grade B.',
          'Grade A: expand AND and OR into NAND and cancel the double inversions. NAND(NAND(a, NOT sel), NAND(b, sel)).',
        ],
      },
      {
        id: 'dmux',
        title: 'DMUX',
        goal: 'Route in to a when sel is 0, to b when sel is 1. The other output is 0.',
        story: 'The reverse of MUX: one signal sent to a selected destination. Memory uses it to choose which cell is written.',
        ins: ['in', 'sel'],
        outs: ['a', 'b'],
        fn: ([x, s]) => [s ? 0 : x, s ? x : 0],
        silver: 5,
        gold: 4,
        reward: 'dmux',
        hints: ['a = in AND NOT sel. b = in AND sel.', 'Grade A: share one NAND(in, sel). in AND NOT sel equals in AND NAND(in, sel).'],
      },
      {
        id: 'maj',
        title: 'MAJ3',
        bonus: true,
        goal: 'Output 1 when two or more of the three inputs are 1.',
        story: 'Optional drawing. A three-input majority vote. It is the same function as the carry of an adder.',
        ins: ['a', 'b', 'c'],
        outs: ['out'],
        fn: ([a, c, d]) => [maj(a, c, d)],
        silver: 9,
        gold: 6,
        reward: null,
        hints: [
          '(a AND b) OR (b AND c) OR (a AND c).',
          'Alternative: a and b are both 1, or a and b differ and c is 1.',
          'Grade A: a four-NAND XOR contains NAND(a, b). Reuse it.',
        ],
      },
    ],
  },
  {
    name: 'ARITHMETIC',
    stages: [
      {
        id: 'half',
        title: 'HALF ADDER',
        goal: 'Add two bits. sum is the low digit, carry is the high digit.',
        story: 'Binary addition: 0+0=00, 0+1=01, 1+0=01, 1+1=10. Each output digit is one gate function of the inputs.',
        ins: ['a', 'b'],
        outs: ['sum', 'carry'],
        fn: ([a, c]) => [a ^ c, a & c],
        silver: 6,
        gold: 5,
        reward: 'half',
        hints: ['sum is XOR. carry is AND.', 'Grade A: build XOR from four NAND and invert its internal NAND(a, b) for carry.'],
      },
      {
        id: 'full',
        title: 'FULL ADDER',
        goal: 'Add three bits a, b, c. c is the carry from the lower digit.',
        story: 'Long addition also adds the carry from the digit below. Chain full adders to add numbers of any width.',
        ins: ['a', 'b', 'c'],
        outs: ['sum', 'carry'],
        fn: ([a, c, d]) => [a ^ c ^ d, maj(a, c, d)],
        silver: 13,
        gold: 9,
        reward: 'full',
        hints: [
          'Two half adders: add a and b, then add c to the result.',
          'The two half-adder carries are never 1 together. OR them.',
          'Grade A: NAND only. Two XOR stages of four NAND each, plus one NAND for carry.',
        ],
      },
      {
        id: 'add2',
        title: 'ADD2',
        goal: 'Add two 2-bit numbers a1a0 and b1b0. The result is the 3-bit number c s1 s0.',
        story: 'Add the low digits, then pass the carry to the high digits. The same chain extends to 8 or 64 bits.',
        ins: ['a1', 'a0', 'b1', 'b0'],
        outs: ['c', 's1', 's0'],
        fn: ([a1, a0, b1, b0]) => {
          const s = a1 * 2 + a0 + b1 * 2 + b0;
          return [(s >> 2) & 1, (s >> 1) & 1, s & 1];
        },
        silver: 18,
        gold: 14,
        reward: null,
        hints: ['The low digits have no carry in: a half adder is enough.', 'The high digits also add the low carry: a full adder. Its carry is c.'],
      },
    ],
  },
  {
    name: 'MEMORY',
    stages: [
      {
        id: 'sr',
        title: 'SR LATCH',
        goal: 'Hold one bit. s=1 sets q to 1. r=1 resets q to 0. With both at 0, q keeps its value.',
        story:
          'Feed a gate output back into its own input and the circuit remembers. This is the first part whose output depends on the past, so it is tested as a sequence of steps, not a truth table. Click a step to replay up to it.',
        ins: ['s', 'r'],
        outs: ['q'],
        model: {
          init: () => ({ q: null }),
          step: (m, [s, r]) => {
            if (r) m.q = 0;
            else if (s) m.q = 1;
            return [m.q];
          },
        },
        seq: [[0, 1], [0, 0], [1, 0], [0, 0], [0, 1], [0, 0], [1, 0], [0, 0]],
        silver: 8,
        gold: 4,
        reward: 'sr',
        hints: [
          'Two gates, each feeding the other.',
          'Two NOR gates cross-coupled: q = NOR(r, nq), nq = NOR(s, q). Grade B.',
          'Grade A: two cross-coupled NAND gates latch on active-low inputs. Invert s and r first.',
        ],
      },
      {
        id: 'dlatch',
        title: 'D LATCH',
        goal: 'While en is 1, q follows d. While en is 0, q keeps its value.',
        story: 'An SR latch needs two control lines. A D latch stores one data line under an enable. It is transparent while enabled.',
        ins: ['d', 'en'],
        outs: ['q'],
        model: {
          init: () => ({ q: null }),
          step: (m, [d, en]) => {
            if (en) m.q = d;
            return [m.q];
          },
        },
        seq: [[1, 1], [1, 0], [0, 0], [0, 1], [0, 0], [1, 0], [1, 1], [1, 0]],
        silver: 9,
        gold: 4,
        reward: 'dlatch',
        hints: [
          'Set when d and en are both 1. Reset when d is 0 and en is 1.',
          's = d AND en, r = (NOT d) AND en, into an SR latch. Grade B.',
          'Grade A: x = NAND(d, en) is the active-low set. NAND(x, en) is the active-low reset. Two more NAND cross-coupled.',
        ],
      },
      {
        id: 'dff',
        title: 'D FLIP-FLOP',
        goal: 'Copy d to q only at the instant clk rises from 0 to 1. Hold q at all other times.',
        story:
          'A latch is open for as long as enable is high. A flip-flop samples at one instant, the clock edge. Every register in a CPU is built from it, and the clock is what makes the whole machine advance in steps.',
        ins: ['d', 'clk'],
        outs: ['q'],
        model: {
          init: () => ({ q: null, pc: 0 }),
          step: (m, [d, clk]) => {
            if (clk && !m.pc) m.q = d;
            m.pc = clk;
            return [m.q];
          },
        },
        seq: [[0, 0], [0, 1], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0], [0, 1], [1, 1], [1, 0], [1, 1]],
        silver: 10,
        gold: 9,
        reward: 'dff',
        hints: [
          'Two D latches in series, enabled on opposite clock levels.',
          'First latch enabled by NOT clk, second by clk. The first closes exactly when the second opens.',
        ],
      },
      {
        id: 'reg',
        title: 'REGISTER',
        goal: 'On a rising clk edge, store d if load is 1. Otherwise keep q.',
        story: 'A flip-flop overwrites itself on every clock. A register only takes a new value when told to. RISC-V has 32 of these, each 32 bits wide.',
        ins: ['d', 'load', 'clk'],
        outs: ['q'],
        model: {
          init: () => ({ q: null, pc: 0 }),
          step: (m, [d, load, clk]) => {
            if (clk && !m.pc && load) m.q = d;
            m.pc = clk;
            return [m.q];
          },
        },
        seq: [[1, 1, 0], [1, 1, 1], [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]],
        silver: 15,
        gold: 13,
        reward: 'reg',
        hints: ['Choose what the flip-flop stores: the new d, or its own q.', 'MUX(q, d, load) into the D input. Feed q back to the MUX.'],
      },
      {
        id: 'ram2',
        zoom: 1.2,
        title: 'RAM 2X1',
        goal: 'Two 1-bit cells. q always shows the cell selected by addr. On a rising clk edge with load=1, write d to that cell.',
        story: 'Memory is registers plus addressing: DMUX steers the write, MUX selects the read. Real RAM is the same structure with more address bits.',
        ins: ['d', 'addr', 'load', 'clk'],
        outs: ['q'],
        model: {
          init: () => ({ m: [null, null], pc: 0 }),
          step: (m, [d, addr, load, clk]) => {
            if (clk && !m.pc && load) m.m[addr] = d;
            m.pc = clk;
            return [m.m[addr]];
          },
        },
        seq: [
          [1, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 0], [0, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 1], [1, 1, 1, 0],
          [1, 1, 1, 1], [1, 1, 0, 0], [1, 0, 0, 0], [0, 0, 1, 0], [0, 0, 1, 1], [0, 1, 0, 0],
        ],
        silver: 40,
        gold: 34,
        reward: null,
        hints: ['One register per cell. Both see the same d and clk.', 'DMUX(load, addr) gives each register its own load. MUX(cell0, cell1, addr) drives q.'],
      },
      {
        id: 'cnt',
        zoom: 1.2,
        title: 'COUNTER',
        goal: 'A 2-bit counter q1 q0. On each rising clk edge: go to 0 if reset is 1, otherwise add 1 and wrap from 3 to 0.',
        story: 'This is a program counter in miniature. A CPU fetches the instruction at the address it holds, then steps it forward.',
        ins: ['reset', 'clk'],
        outs: ['q1', 'q0'],
        model: {
          init: () => ({ q: null, pc: 0 }),
          step: (m, [reset, clk]) => {
            if (clk && !m.pc) m.q = reset ? 0 : m.q == null ? null : (m.q + 1) & 3;
            m.pc = clk;
            return m.q == null ? [null, null] : [(m.q >> 1) & 1, m.q & 1];
          },
        },
        seq: [[1, 0], [1, 1], [0, 0], [0, 1], [0, 0], [0, 1], [0, 0], [0, 1], [0, 0], [0, 1], [0, 0], [0, 1], [1, 0], [1, 1]],
        silver: 34,
        gold: 29,
        reward: null,
        hints: [
          'Two flip-flops hold q1 and q0. Gates compute the next value from the current one.',
          'q0 flips every step. q1 flips when q0 is 1: next q1 = q1 XOR q0.',
          'Force both next values to 0 while reset is 1. NOR(reset, q0) does the low bit in one part.',
        ],
      },
    ],
  },
  {
    name: 'DATAPATH',
    // Parts handed out when this section opens.
    grant: ['k0', 'k1', 'z32', 'k4', 'kbase', 'not32', 'and32', 'or32', 'xor32', 'mux32', 'add32', 'reg32', 'rep32', 'zext32', 'msb32', 'any32', 'shl1', 'shl2', 'shl4', 'shl8', 'shl16'],
    stages: [
      {
        id: 'neg',
        title: 'NEGATE',
        goal: "Output the two's complement negation of a: out = -a.",
        story:
          'From here a wire carries 32 bits. A thick wire is a bus, and a bus only connects to a terminal of the same width. NOT32, AND32, OR32, XOR32 and MUX32 are 32 copies of the gates you built, side by side. ADD32 is the full-adder chain of ADD2, 32 long. Bus input pins step through their test values when clicked. Select a part or wire to read its value in the status bar.',
        ins: ['a'],
        outs: ['out'],
        w: { a: 32, out: 32 },
        parts: ['not32', 'add32', 'z32', 'k0', 'k1'],
        fn: ([a]) => [(0 - a) >>> 0],
        vec: [[0], [1], [2], [0x7fffffff], [0x80000000], [0xffffffff], [0x12345678]],
        silver: 608,
        gold: 320,
        reward: null,
        hints: ["Two's complement: invert every bit, then add 1.", 'NOT32, then ADD32 with ZERO32 on the other input and 1 on the carry input.'],
      },
      {
        id: 'sub',
        title: 'SUB32',
        goal: 'Output a - b.',
        story: 'There is no subtractor in a CPU. a - b is a + (-b), and the carry input supplies the +1 for free.',
        ins: ['a', 'b'],
        outs: ['out'],
        w: { a: 32, b: 32, out: 32 },
        parts: ['not32', 'add32', 'z32', 'k0', 'k1'],
        fn: ([a, c]) => [(a - c) >>> 0],
        vec: [[0, 0], [5, 3], [3, 5], [0, 1], [0x80000000, 1], [0xffffffff, 0xffffffff], [0x12345678, 0x11111111]],
        silver: 608,
        gold: 320,
        reward: null,
        hints: ['a + NOT b + 1.', 'One NOT32 on b, one ADD32, carry input tied to 1.'],
      },
      {
        id: 'addsub',
        title: 'ADD / SUB',
        goal: 'Output a + b when sub is 0, a - b when sub is 1. cout is the carry out of the adder.',
        story: 'One adder does both jobs. The control bit has to invert b and supply the carry at the same time.',
        ins: ['a', 'b', 'sub'],
        outs: ['out', 'cout'],
        w: { a: 32, b: 32, out: 32 },
        parts: ['not32', 'xor32', 'mux32', 'add32', 'rep32', 'k0', 'k1'],
        fn: ([a, c, sub]) => {
          const t = a + (sub ? ~c >>> 0 : c) + sub;
          return [t >>> 0, t > 0xffffffff ? 1 : 0];
        },
        vec: [
          [1, 1, 0], [1, 1, 1], [0, 1, 1], [0xffffffff, 1, 0], [0x80000000, 0x80000000, 0], [5, 3, 1], [3, 5, 1],
          [0x12345678, 0x11111111, 0], [0x12345678, 0x11111111, 1],
        ],
        silver: 448,
        gold: 416,
        reward: 'addsub',
        hints: [
          'Choose between b and NOT b with a MUX32. Grade B.',
          'XOR with 1 inverts, XOR with 0 passes. REP32 copies one bit onto all 32 lines.',
          'Grade A: XOR32(b, REP32(sub)) into the adder, sub into the carry input.',
        ],
      },
      {
        id: 'cmp',
        zoom: 1.3,
        title: 'COMPARE',
        goal: 'eq = 1 when a equals b. ltu = 1 when a < b as unsigned numbers. lt = 1 when a < b as signed numbers.',
        story:
          'Every branch instruction is a subtraction whose result is thrown away. Only three facts are kept: was it zero, did it borrow, and what sign did it have. MSB32 taps the top bit of a bus. ANY32 is 1 when any bit is set.',
        ins: ['a', 'b'],
        outs: ['eq', 'ltu', 'lt'],
        w: { a: 32, b: 32 },
        parts: ['addsub', 'xor32', 'any32', 'msb32', 'k0', 'k1', 'not', 'and', 'or', 'xor'],
        fn: ([a, c]) => [a === c ? 1 : 0, a < c ? 1 : 0, (a | 0) < (c | 0) ? 1 : 0],
        vec: [
          [0, 0], [1, 2], [2, 1], [0xffffffff, 1], [1, 0xffffffff], [0x80000000, 0x7fffffff], [0x7fffffff, 0x80000000],
          [0x12345678, 0x12345678], [0x80000000, 0x80000001],
        ],
        silver: 700,
        gold: 525,
        reward: 'cmp',
        hints: [
          'Compute a - b once. eq: the difference has no bit set.',
          'ltu: a - b borrows exactly when the adder carry out is 0.',
          'lt: the sign of the difference, flipped when the subtraction overflowed. Overflow = (a31 XOR b31) AND (a31 XOR d31).',
        ],
      },
      {
        id: 'shl',
        zoom: 1.3,
        title: 'SHIFT LEFT',
        goal: 'Shift a left by the 5-bit amount s4 s3 s2 s1 s0. Bits shifted out are lost, zeros come in.',
        story:
          'A barrel shifter never loops. Any amount from 0 to 31 is a sum of 1, 2, 4, 8 and 16, so five optional fixed shifts in series cover them all. SHL1 to SHL16 are fixed shifts: wiring only.',
        ins: ['a', 's4', 's3', 's2', 's1', 's0'],
        outs: ['out'],
        w: { a: 32, out: 32 },
        parts: ['mux32', 'shl1', 'shl2', 'shl4', 'shl8', 'shl16', 'k0', 'k1'],
        fn: ([a, s4, s3, s2, s1, s0]) => [(a << (s4 * 16 + s3 * 8 + s2 * 4 + s1 * 2 + s0)) >>> 0],
        vec: [0, 1, 2, 4, 8, 16, 31, 5].map((n) => [1, (n >> 4) & 1, (n >> 3) & 1, (n >> 2) & 1, (n >> 1) & 1, n & 1]).concat([
          [0x80000001, 0, 0, 0, 0, 1], [0xdeadbeef, 0, 0, 1, 0, 0], [0xdeadbeef, 0, 1, 1, 0, 0], [0xdeadbeef, 0, 0, 0, 0, 0],
        ]),
        silver: 800,
        gold: 640,
        reward: ['sll32', 'srl32', 'sra32'],
        hints: ['One stage per shift-amount bit: shift by a fixed distance, or pass through.', 'MUX32(x, SHL1(x), s0), then the same with SHL2 and s1, and so on to SHL16 and s4.'],
      },
      {
        id: 'alu',
        zoom: 1.9,
        title: 'ALU',
        goal: 'The RV32I arithmetic unit. f2 f1 f0 select: 000 add (sub if alt), 001 shift left, 010 signed less-than, 011 unsigned less-than, 100 xor, 101 shift right (arithmetic if alt), 110 or, 111 and.',
        story:
          'These select bits are funct3 of a RISC-V instruction, and alt is bit 30. The ALU computes every result at once and a multiplexer tree keeps one. The shifters take their amount from the low 5 bits of b. ZEXT32 widens one bit to a 32-bit 0 or 1.',
        ins: ['a', 'b', 'f2', 'f1', 'f0', 'alt'],
        outs: ['out'],
        w: { a: 32, b: 32, out: 32 },
        parts: ['addsub', 'cmp', 'sll32', 'srl32', 'sra32', 'and32', 'or32', 'xor32', 'mux32', 'zext32', 'k0', 'k1'],
        fn: ([a, c, f2, f1, f0, alt]) => [aluFn(a, c, f2 * 4 + f1 * 2 + f0, alt)],
        vec: [0, 1, 2, 3, 4, 5, 6, 7].flatMap((f) =>
          (f === 0 || f === 5 ? [0, 1] : [0]).flatMap((alt) =>
            [[5, 3], [0x80000000, 1], [0xfffffff0, 0x1f], [3, 5]].map(([a, c]) => [a, c, (f >> 2) & 1, (f >> 1) & 1, f & 1, alt]),
          ),
        ),
        silver: 5000,
        gold: 4205,
        reward: 'alu',
        hints: [
          'Build all eight results from a and b first. alt goes to the sub input of ADDSUB.',
          'Shift right: compute SRL32 and SRA32, choose between them with alt.',
          'Seven MUX32 in a tree: four selected by f0, two by f1, one by f2.',
        ],
      },
      {
        id: 'rf4',
        zoom: 1.7,
        title: 'REGISTER FILE',
        goal: 'Four 32-bit registers x0 to x3. r1 shows register a1a0, r2 shows register b1b0. On a rising clk edge with we=1, write wd to register d1d0. x0 always reads 0.',
        story:
          'RISC-V instructions read two registers and write one, every cycle. This is the same structure as RAM 2X1 with two read ports. The real file has 32 registers and 5-bit addresses, and is released once this drawing passes.',
        ins: ['wd', 'we', 'd1', 'd0', 'a1', 'a0', 'b1', 'b0', 'clk'],
        outs: ['r1', 'r2'],
        w: { wd: 32, r1: 32, r2: 32 },
        parts: ['reg32', 'mux32', 'z32', 'dmux', 'and', 'not', 'k0', 'k1'],
        model: {
          init: () => ({ x: [0, null, null, null], pc: 0 }),
          step: (m, [wd, we, d1, d0, a1, a0, b1, b0, clk]) => {
            if (clk && !m.pc && we && d1 * 2 + d0) m.x[d1 * 2 + d0] = wd;
            m.pc = clk;
            return [m.x[a1 * 2 + a0], m.x[b1 * 2 + b0]];
          },
        },
        seq: [
          [0x11111111, 1, 0, 1, 0, 1, 0, 0], [0x22222222, 1, 1, 0, 1, 0, 0, 1], [0xdeadbeef, 1, 1, 1, 1, 1, 1, 0],
          [0xffffffff, 1, 0, 0, 0, 0, 1, 1], [0x55555555, 0, 0, 1, 0, 1, 1, 0], [0xcafe0001, 1, 0, 1, 0, 1, 0, 1],
        ].flatMap((v) => [[...v, 0], [...v, 1]]),
        silver: 2400,
        gold: 2028,
        reward: 'regfile',
        hints: [
          'x0 is not a register: read ZERO32. Three REG32 hold x1 to x3, all fed by wd and clk.',
          'Steer we to one register with a DMUX tree on d1 then d0.',
          'Each read port is three MUX32: two selected by the low address bit, one by the high bit.',
        ],
      },
      {
        id: 'pcu',
        zoom: 1.5,
        title: 'PROGRAM COUNTER',
        goal: 'On each rising clk edge: pc becomes 80000000 if reset is 1, else target if jump is 1, else pc + 4.',
        story:
          'Instructions are 4 bytes, so the next one is at pc + 4 unless a branch or jump says otherwise. 80000000 is where RAM starts on the target machine, and where programs are loaded. FOUR32 and BASE32 are those constants.',
        ins: ['target', 'jump', 'reset', 'clk'],
        outs: ['pc'],
        w: { target: 32, pc: 32 },
        parts: ['reg32', 'add32', 'mux32', 'k4', 'kbase', 'z32', 'k0', 'k1'],
        model: {
          init: () => ({ q: null, pc: 0 }),
          step: (m, [target, jump, reset, clk]) => {
            if (clk && !m.pc) m.q = reset ? 0x80000000 : jump ? target : m.q == null ? null : (m.q + 4) >>> 0;
            m.pc = clk;
            return [m.q];
          },
        },
        seq: [[0, 0, 1], [0, 0, 0], [0, 0, 0], [0x80000100, 1, 0], [0, 0, 0], [0x80000008, 1, 0], [0, 0, 1]].flatMap((v) => [[...v, 0], [...v, 1]]),
        silver: 1100,
        gold: 960,
        reward: 'pc',
        hints: ['A REG32 that loads on every clock: tie load to 1.', 'ADD32(pc, FOUR32) is the default next value.', 'Two MUX32 in series: jump picks target, then reset picks BASE32.'],
      },
    ],
  },
  {
    name: 'RV32I CPU',
    grant: ['opdec', 'f_rd', 'f_rs1', 'f_rs2', 'f_f3', 'f_b30', 'imm_i', 'imm_s', 'imm_b', 'imm_u', 'imm_j'],
    stages: [
      {
        id: 'immgen',
        title: 'IMMEDIATE GENERATOR',
        goal: 'Output the immediate of the instruction. Format I by default; S, B, U or J when that select line is 1.',
        story:
          'A RISC-V instruction is 32 bits. Constants are packed into it in five layouts, chosen so that the sign bit is always bit 31 and most fields stay in place. IMM-I to IMM-J each unpack one layout and sign-extend it: wiring only. This drawing picks the one the instruction uses.',
        ins: ['inst', 's', 'b', 'u', 'j'],
        outs: ['imm'],
        w: { inst: 32, imm: 32 },
        parts: ['imm_i', 'imm_s', 'imm_b', 'imm_u', 'imm_j', 'mux32', 'k0', 'k1'],
        fn: ([i, sel, bb, uu, j]) => [j ? immJ(i) : uu ? immU(i) : bb ? immB(i) : sel ? immS(i) : immI(i)],
        vec: [
          [IMMW[1], 0, 0, 0, 0], [IMMW[2], 1, 0, 0, 0], [IMMW[3], 0, 1, 0, 0], [IMMW[4], 0, 0, 1, 0], [IMMW[5], 0, 0, 0, 1],
          [IMMW[0], 0, 1, 0, 0], [IMMW[6], 0, 0, 0, 1], [IMMW[2], 0, 0, 0, 0], [IMMW[4], 0, 0, 0, 0],
        ],
        silver: 640,
        gold: 512,
        reward: 'immgen',
        hints: ['Unpack all five, then select.', 'Four MUX32 in a chain: I or S, then B, then U, then J.'],
      },
      {
        id: 'brc',
        title: 'BRANCH CONDITION',
        goal: 'taken = 1 when the branch selected by f2 f1 f0 holds: 000 equal, 001 not equal, 100 less, 101 greater-or-equal, 110 less unsigned, 111 greater-or-equal unsigned.',
        story: 'The comparator already gives eq, ltu and lt. funct3 of a branch picks one of them with f2 and f1, and f0 asks for the opposite.',
        ins: ['eq', 'ltu', 'lt', 'f2', 'f1', 'f0'],
        outs: ['taken'],
        parts: ['nand', 'not', 'and', 'or', 'xor', 'mux'],
        fn: ([eq, ltu, lt, f2, f1, f0]) => [(f2 ? (f1 ? ltu : lt) : eq) ^ f0],
        vec: [[1, 0, 0], [0, 1, 1], [0, 1, 0], [0, 0, 1], [0, 0, 0]].flatMap((c) => [0, 1, 4, 5, 6, 7].map((f) => [...c, (f >> 2) & 1, (f >> 1) & 1, f & 1])),
        silver: 16,
        gold: 12,
        reward: 'brcond',
        hints: ['Pick lt or ltu with f1, then that or eq with f2.', 'XOR with f0 inverts the result for the odd funct3 values.'],
      },
      {
        id: 'cpu1',
        title: 'CPU / ARITHMETIC',
        ...CPU_IO,
        goal: 'Execute register and immediate arithmetic: ADD SUB AND OR XOR SLT SLTU SLL SRL SRA and their immediate forms.',
        story:
          'A processor is the parts you have, wired in a loop: PC gives an address, memory returns the instruction there, its fields pick two registers, the ALU combines them, the result is written back, PC steps. The test runs a program and compares your registers and PC with a reference after every instruction. Click a step to see that instruction on the sheet. Memory is outside the sheet: inst is the word at pc.',
        prog: [
          ['addi', 1, 0, 5],
          ['addi', 2, 0, -3, '; negative constant, sign-extended'],
          ['add', 3, 1, 2], ['sub', 4, 1, 2], ['xori', 5, 1, 0x7ff],
          ['addi', 6, 0, 0x400, '; bit 30 set by the constant: add'],
          ['slli', 7, 1, 4],
          ['srai', 8, 2, 1, '; bit 30 set: shift in the sign'],
          ['srli', 9, 2, 28, '; bit 30 clear: shift in zeros'],
          ['slt', 10, 2, 1], ['sltiu', 11, 1, 6], ['and', 12, 5, 7],
          ['or', 13, 5, 7], ['sll', 14, 1, 1], ['sra', 15, 2, 1], ['andi', 17, 5, 0x0f0],
          ['add', 0, 1, 1, '; x0 ignores the write'],
        ],
        reward: null,
        hints: [
          'PC needs only reset and clk for now. RD, RS1 and RS2 go to the register file. FUNCT3 goes to the ALU.',
          'ALU input b: the second register for OP, IMM-I for OP-IMM. OPDEC tells which.',
          'alt must not follow bit 30 blindly: in ADDI it is part of the constant. alt = BIT30 AND (op OR funct3 is 101).',
        ],
      },
      {
        id: 'cpu2',
        title: 'CPU / LOAD AND STORE',
        ...CPU_IO,
        inherit: 'cpu1',
        goal: 'Add LW and SW. addr and wdata go to memory, memw is 1 for a store, rdata is the word at addr.',
        story:
          'Both compute an address with the ALU: register plus immediate. So the ALU must add no matter what funct3 says, the immediate comes in S layout for a store, and a store must not write a register. Your sheet from the previous drawing is carried over.',
        prog: [
          ['addi', 1, 0, 0x123], ['addi', 2, 0, 1],
          ['slli', 2, 2, 31, '; x2 = 80000000, start of RAM'],
          ['sw', 1, 2, 0x100, '; store x1 at 80000100'],
          ['lw', 3, 2, 0x100, '; and read it back'],
          ['addi', 3, 3, 1], ['sw', 3, 2, 0x104], ['lw', 4, 2, 0x104], ['addi', 6, 2, 0x110],
          ['sw', 4, 6, -8, '; negative offset: 80000108'],
          ['lw', 5, 6, -8], ['add', 7, 5, 3],
        ],
        reward: null,
        hints: [
          'Gate f2 f1 f0 with (op OR opimm) so the ALU adds for everything else.',
          'IMMGEN with store on the s line. ALU b takes the immediate unless the instruction is OP.',
          'Write back rdata for a load. Register write enable = NOR(store, branch).',
        ],
      },
      {
        id: 'cpu3',
        title: 'CPU / BRANCH',
        ...CPU_IO,
        inherit: 'cpu2',
        goal: 'Add BEQ BNE BLT BGE BLTU BGEU. When the condition holds, PC becomes pc + immediate.',
        story: 'A branch compares two registers and changes where the program goes. This is what makes loops and decisions possible. The target is relative to the branch itself.',
        prog: [
          ['addi', 1, 0, 0],
          ['addi', 2, 0, 5, '; loop counter'],
          'loop',
          ['add', 1, 1, 2, '; x1 = 5 + 4 + 3 + 2 + 1'],
          ['addi', 2, 2, -1],
          ['bne', 2, 0, 'loop', '; again until x2 is 0'],
          ['beq', 1, 0, 'bad'],
          ['addi', 3, 0, -1, '; x3 = ffffffff'],
          ['blt', 3, 0, 'l1', '; -1 < 0 signed: taken'],
          ['addi', 20, 0, 1], 'l1',
          ['bltu', 3, 0, 'bad', '; ffffffff > 0 unsigned: not taken'],
          ['bge', 0, 3, 'l2'], ['addi', 21, 0, 1],
          'l2', ['bgeu', 3, 0, 'l3'], ['addi', 22, 0, 1], 'l3', ['beq', 2, 0, 'end'],
          'bad', ['addi', 31, 0, 1, '; reached only by a wrong branch'],
          'end', ['addi', 4, 1, 0],
        ],
        reward: null,
        hints: [
          'CMP32 on the two registers, BRCOND with funct3, AND with the branch line from OPDEC.',
          'ADD32(pc, immediate) is the target. Put branch on the b line of IMMGEN.',
          'Feed target and taken to the PC part.',
        ],
      },
      {
        id: 'cpu4',
        title: 'CPU / JUMP AND UPPER',
        ...CPU_IO,
        inherit: 'cpu3',
        goal: 'Add JAL, JALR, LUI and AUIPC. Jumps write pc + 4 to rd. LUI writes the immediate. AUIPC writes pc + immediate.',
        story: 'JAL and JALR are calls: they jump and leave the return address in a register. LUI and AUIPC build the upper 20 bits of a constant or an address. With these four the base integer instruction set is complete, except for byte and half-word memory access.',
        prog: [
          ['lui', 1, 0x12345, '; x1 = 12345000'],
          ['addi', 1, 1, 0x678, '; x1 = 12345678'],
          ['auipc', 2, 0x1, '; x2 = pc + 1000'],
          ['jal', 3, 'over', '; x3 = pc + 4, skip one line'],
          ['addi', 30, 0, 1], 'over', ['addi', 10, 0, 0],
          ['jal', 1, 'func', '; call: x1 = return address'],
          ['jal', 1, 'func', '; call again'],
          ['lui', 5, 0xfffff], ['jal', 0, 'end'],
          'func', ['addi', 10, 10, 1, '; count the calls in x10'],
          ['jalr', 0, 1, 0, '; return to the address in x1'],
          'end', ['addi', 11, 10, 0],
        ],
        reward: null,
        hints: [
          'IMMGEN: u line for LUI or AUIPC, j line for JAL.',
          'PC jumps when a branch is taken or the instruction is JAL or JALR. JALR takes its target from the ALU.',
          'Write-back is a MUX32 chain: ALU, then rdata for load, pc + 4 for jumps, immediate for LUI, pc + immediate for AUIPC.',
        ],
      },
    ],
  },
  {
    name: 'HELLO',
    goal: 'GOAL 1',
    stages: [
      {
        id: 'hello',
        title: 'HELLO',
        ...CPU_IO,
        inherit: 'cpu4',
        goal: 'Run the program. It writes H E L L O and a newline, one character at a time, to the UART at address 10000000.',
        story:
          'GOAL 1. Nothing new to build: this is your processor running a real program. A device is just an address: storing a word at 10000000 sends its low byte out of the serial port. From one NAND gate to a machine that prints.',
        prog: [
          ['lui', 5, 0x10000, '; x5 = 10000000, the uart'],
          ...[...'HELLO\n'].flatMap((ch) => [
            ['addi', 6, 0, ch.charCodeAt(0), `; x6 = '${ch === '\n' ? '\\n' : ch}'`],
            ['sw', 6, 5, 0, '; send its low byte to the uart'],
          ]),
          'halt',
          ['jal', 0, 'halt', '; jump to itself: stop'],
        ],
        uart: 'HELLO\n',
        reward: null,
        hints: ['The sheet from CPU / JUMP AND UPPER is carried over and should pass as it is.', 'If a step fails, click it: the status bar shows the value on any selected wire.'],
      },
    ],
  },
  // Byte and half-word access: the rest of RV32I. GOAL 2, the end of the course.
  {
    name: 'RV32I',
    goal: 'GOAL 2',
    grant: ['low2', 'shr8', 'shr16', 'sext8', 'zext8', 'sext16', 'zext16', 'join4'],
    stages: [
      {
        id: 'ldu',
        zoom: 1.6,
        title: 'LOAD UNIT',
        goal: 'Output the value a load returns from rdata, the word at the aligned address. f2 f1 f0 is funct3: 000 LB, 001 LH, 010 LW, 100 LBU, 101 LHU. Bits 1 and 0 of addr pick the byte or half-word. LB and LH sign-extend it, LBU and LHU zero-extend it.',
        story:
          'Memory answers in whole words. A byte load takes the word that holds the byte, moves the byte down to bit 0 and widens it back to 32 bits: with copies of its top bit when signed, with zeros when not. SHR8 and SHR16 are fixed shifts, LOW2 taps address bits 1 and 0, SEXT8 to ZEXT16 keep the low 8 or 16 bits and extend them: wiring only.',
        ins: ['rdata', 'addr', 'f2', 'f1', 'f0'],
        outs: ['out'],
        w: { rdata: 32, addr: 32, out: 32 },
        parts: ['low2', 'shr8', 'shr16', 'sext8', 'zext8', 'sext16', 'zext16', 'mux32', 'k0', 'k1'],
        fn: ([w, a, f2, f1, f0]) => [loadFn(w, a, f2 * 4 + f1 * 2 + f0)],
        vec: [0, 4, 1, 5, 2].flatMap((f) => LDW.flatMap((w) => LDF[f].map((o) => [w, 0x80000400 + o, (f >> 2) & 1, (f >> 1) & 1, f & 1]))),
        silver: 896,
        gold: 768,
        reward: 'loadunit',
        hints: [
          'Bring the addressed byte down to bit 0 first: MUX32 between rdata and SHR8 on address bit 0, then the same with SHR16 on bit 1.',
          'Four widened candidates from the shifted word: SEXT8, ZEXT8, SEXT16, ZEXT16. f2 picks signed or unsigned.',
          'f0 picks byte or half-word, f1 the whole shifted word. Six MUX32 in all.',
        ],
      },
      {
        id: 'stu',
        zoom: 1.6,
        title: 'STORE UNIT',
        goal: 'f1 f0 is funct3 of a store: 00 SB, 01 SH, 10 SW. wdata is data shifted left by 8 times address bits 1 and 0. mask has one bit per byte of the word, bit 0 for the lowest: 1 for each byte the store writes.',
        story:
          'Memory takes a whole word on its data lines and a byte mask saying which bytes to replace. A byte store to address 3 sends data << 24 with mask 1000, a half-word store to address 2 sends data << 16 with mask 1100. JOIN4 gathers four single lines into a 4-bit bus: wiring only.',
        ins: ['data', 'addr', 'f1', 'f0'],
        outs: ['wdata', 'mask'],
        w: { data: 32, addr: 32, wdata: 32, mask: 4 },
        parts: ['low2', 'shl8', 'shl16', 'mux32', 'join4', 'nand', 'not', 'and', 'or', 'k0', 'k1'],
        fn: ([d, a, f1, f0]) => storeFn(d, a, f1, f0),
        vec: [0x12345678, 0xdeadbeef].flatMap((d) =>
          [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0], [1, 0, 1], [1, 2, 1], [2, 0, 2]].map(([f, o]) => [d, 0x80000400 + o, (f >> 1) & 1, f & 1]),
        ),
        silver: 300,
        gold: 270,
        reward: 'storeunit',
        hints: [
          'wdata is the load unit in reverse: MUX32 with SHL8 on address bit 0, then SHL16 on bit 1.',
          'Byte i is written by a word store, by a half-word store when address bit 1 matches bit 1 of i, by a byte store when both bits match.',
          'mask bit i = f1 OR (a1 matches AND (f0 OR a0 matches)). Grade A: NAND only, one NOT per input, the (f0 OR a0) terms shared.',
        ],
      },
      {
        id: 'cpu5',
        title: 'CPU / RV32I',
        ...CPU8_IO,
        inherit: 'hello',
        goal: 'Add LB LH LBU LHU SB SH. Loads go through LOADUNIT. Stores drive wdata and wmask from STOREUNIT; memw still says when to write. The program tries every load and store width on both signs and on every byte lane, then turns a string in memory to upper case one byte at a time and prints it: HELLO RV32I. Once it passes, RUN FIZZBUZZ runs a longer program on the same circuit at full speed: FizzBuzz from 1 to 100.',
        story:
          'GOAL 2, the last drawing. C strings are bytes, and a CPU that can only move whole words cannot store one character without destroying its neighbours. The new output wmask selects the bytes a store writes, bit 0 for the lowest. 0000 with memw set writes the whole word, as every sheet before this one does, so your HELLO sheet is carried over and still runs its word stores. addr keeps its low two bits: the units use them, memory ignores them. With byte and half-word access your processor runs the whole RV32I base instruction set, the one every RISC-V processor implements: only ECALL, EBREAK and FENCE are left out, and on this machine they would have nothing to do. From one NAND gate to a 32-bit processor that runs real programs: this is where the course ends.',
        prog: [
          ['lui', 2, 0x80000], ['addi', 2, 2, 0x400, '; x2 = 80000400, a data area'],
          ['lui', 1, 0x7f810], ['addi', 1, 1, -255, '; x1 = 7F80FF01: bytes 01 FF 80 7F'],
          ['lui', 3, 0x80018], ['addi', 3, 3, -2, '; x3 = 80017FFE: bytes FE 7F 01 80'],
          ['sw', 1, 2, 0], ['sw', 3, 2, 4],
          ['lb', 4, 2, 1, '; FFFFFFFF: sign-extended'],
          ['lb', 5, 2, 3, '; 0000007F'],
          ['lbu', 6, 2, 1, '; 000000FF: zero-extended'],
          ['lbu', 7, 2, 6, '; 00000001'],
          ['lb', 8, 2, 7, '; FFFFFF80'],
          ['lh', 9, 2, 0, '; FFFFFF01'],
          ['lh', 10, 2, 2, '; 00007F80'],
          ['lhu', 11, 2, 0, '; 0000FF01'],
          ['lhu', 12, 2, 6, '; 00008001: zero-extended'],
          ['lh', 13, 2, 6, '; FFFF8001: sign-extended'],
          ['addi', 16, 0, -86, '; x16 = FFFFFFAA'], ['addi', 17, 0, 0x55],
          ['sb', 16, 2, 9, '; one byte to lane 1 of 80000408'], ['sb', 17, 2, 11, '; and one to lane 3'],
          ['lw', 18, 2, 8, '; 5500AA00'],
          ['sh', 1, 2, 12, '; FF01 to the low half'], ['sh', 3, 2, 14, '; 7FFE to the high half'],
          ['lw', 19, 2, 12, '; 7FFEFF01'],
          ['sb', 16, 2, 2, '; replace one byte: the other three stay'], ['lw', 20, 2, 0, '; 7FAAFF01'],
          ['sh', 17, 2, 6], ['lw', 21, 2, 4, '; 00557FFE'],
          ['lui', 28, 0x6c6c6], ['addi', 28, 28, 0x548, "; 'Hell'"], ['sw', 28, 2, 16],
          ['lui', 28, 0x76722], ['addi', 28, 28, 0x06f, "; 'o rv'"], ['sw', 28, 2, 20],
          ['lui', 28, 0x0a693], ['addi', 28, 28, 0x233, "; '32i\\n'"], ['sw', 28, 2, 24, '; a 12-byte string at 80000410'],
          ['addi', 30, 2, 16, '; x30 = the string'], ['addi', 31, 2, 28, '; x31 = its end'],
          'upper',
          ['lbu', 28, 30, 0, '; next character'],
          ['sltiu', 29, 28, 97, "; below 'a'?"],
          ['bne', 29, 0, 'keep', '; then leave it'],
          ['addi', 28, 28, -32, '; to upper case'],
          ['sb', 28, 30, 0, '; write it back: its neighbours stay'],
          'keep',
          ['addi', 30, 30, 1],
          ['bne', 30, 31, 'upper'],
          ['lui', 5, 0x10000, '; x5 = 10000000, the uart'],
          ['addi', 30, 2, 16],
          'print',
          ['lbu', 28, 30, 0],
          ['sb', 28, 5, 0, '; one byte to the uart'],
          ['addi', 30, 30, 1],
          ['bne', 30, 31, 'print'],
          'done',
          ['jal', 0, 'done', '; stop'],
        ],
        uart: 'HELLO RV32I\n',
        // Once passed, RUN FIZZBUZZ runs this longer program on the sheet; it scores nothing.
        demo: FIZZBUZZ,
        reward: null,
        hints: [
          'LOADUNIT takes rdata, the ALU result as address, and FUNCT3. Its output replaces rdata in the write-back MUX32.',
          'STOREUNIT takes the second register, the address, and f1 f0 of FUNCT3. Its outputs drive wdata and wmask.',
          'The ALU already adds for every load and store, whatever funct3 says.',
        ],
      },
    ],
  },
];

export const STAGES = [];
WORLDS.forEach((w, wi) => {
  (w.stages || []).forEach((s, si) => {
    s.world = wi;
    s.num = `${wi + 1}-${si + 1}`;
    s.idx = STAGES.length;
    STAGES.push(s);
  });
});

// Reference CPUs, each extending the one before. OPDEC outputs: d.0 op, d.1 opimm, d.2 load,
// d.3 store, d.4 branch, d.5 jal, d.6 jalr, d.7 lui, d.8 auipc. FUNCT3 outputs: f.0 f2, f.1 f1, f.2 f0.
const CPU1 = {
  d: ['opdec', 'inst'], rd: ['f_rd', 'inst'], rs1: ['f_rs1', 'inst'], rs2: ['f_rs2', 'inst'], f: ['f_f3', 'inst'], b30: ['f_b30', 'inst'],
  one: ['k1'], zero: ['k0'], z: ['z32'],
  p: ['pc', 'z', 'zero', 'reset', 'clk'],
  rf: ['regfile', 'alu', 'one', 'rd', 'rs1', 'rs2', 'clk'],
  im: ['imm_i', 'inst'],
  bsel: ['mux32', 'rf.1', 'im', 'd.1'],
  nf1: ['not', 'f.1'], t1: ['and', 'f', 'nf1'], t2: ['and', 't1', 'f.2'], t3: ['or', 'd', 't2'], alt: ['and', 'b30', 't3'],
  alu: ['alu', 'rf', 'bsel', 'f', 'f.1', 'f.2', 'alt'],
};
const { im: _im, ...CPU1B } = CPU1;
const CPU2 = {
  ...CPU1B,
  ig: ['immgen', 'inst', 'd.3', 'zero', 'zero', 'zero'],
  nop: ['not', 'd'], bsel: ['mux32', 'rf.1', 'ig', 'nop'],
  uf: ['or', 'd', 'd.1'], g2: ['and', 'f', 'uf'], g1: ['and', 'f.1', 'uf'], g0: ['and', 'f.2', 'uf'],
  t2b: ['and', 't2', 'd.1'], t3: ['or', 'd', 't2b'],
  alu: ['alu', 'rf', 'bsel', 'g2', 'g1', 'g0', 'alt'],
  wb: ['mux32', 'alu', 'rdata', 'd.2'], rw: ['nor', 'd.3', 'd.4'],
  rf: ['regfile', 'wb', 'rw', 'rd', 'rs1', 'rs2', 'clk'],
};
const CPU3 = {
  ...CPU2,
  ig: ['immgen', 'inst', 'd.3', 'd.4', 'zero', 'zero'],
  c: ['cmp', 'rf', 'rf.1'], bc: ['brcond', 'c', 'c.1', 'c.2', 'f', 'f.1', 'f.2'], tk: ['and', 'd.4', 'bc'],
  bt: ['add32', 'p', 'ig', 'zero'],
  p: ['pc', 'bt', 'tk', 'reset', 'clk'],
};
const CPU4 = {
  ...CPU3,
  ui: ['or', 'd.7', 'd.8'], ig: ['immgen', 'inst', 'd.3', 'd.4', 'ui', 'd.5'],
  jmp: ['or', 'd.5', 'd.6'], js: ['or', 'tk', 'jmp'], tg: ['mux32', 'bt', 'alu', 'd.6'],
  p: ['pc', 'tg', 'js', 'reset', 'clk'],
  four: ['k4'], p4: ['add32', 'p', 'four', 'zero'],
  w2: ['mux32', 'wb', 'p4', 'jmp'], w3: ['mux32', 'w2', 'ig', 'd.7'], w4: ['mux32', 'w3', 'bt', 'd.8'],
  rf: ['regfile', 'w4', 'rw', 'rd', 'rs1', 'rs2', 'clk'],
};
const cpu = (g, memw) => ({ g, o: { pc: 'p', addr: 'alu', wdata: 'rf.1', memw } });
// Section 8. Loads return through LOADUNIT, stores leave through STOREUNIT.
const CPU5 = {
  ...CPU4,
  lu: ['loadunit', 'rdata', 'alu', 'f', 'f.1', 'f.2'],
  wb: ['mux32', 'alu', 'lu', 'd.2'],
  su: ['storeunit', 'rf.1', 'alu', 'f.1', 'f.2'],
};
// Section 8 and later: wdata and wmask come from STOREUNIT.
const cpuMask = (g) => ({ g, o: { pc: 'p', addr: 'alu', wdata: 'su', memw: 'd.3', wmask: 'su.1' } });

// Reference solutions. `g` maps a signal name to [part, ...input signals];
// `o` maps each output pin to a signal. 'x.1' is output port 1 of gate x.
const XOR4 = { n: ['nand', 'a', 'b'], x: ['nand', 'a', 'n'], y: ['nand', 'b', 'n'], z: ['nand', 'x', 'y'] };
const SOLUTIONS = {
  not: { g: { x: ['nand', 'in', 'in'] }, o: { out: 'x' } },
  and: { g: { x: ['nand', 'a', 'b'], y: ['not', 'x'] }, o: { out: 'y' } },
  or: { g: { x: ['not', 'a'], y: ['not', 'b'], z: ['nand', 'x', 'y'] }, o: { out: 'z' } },
  nor: { g: { x: ['or', 'a', 'b'], y: ['not', 'x'] }, o: { out: 'y' } },
  xor: { g: XOR4, o: { out: 'z' } },
  xnor: { g: { x: ['xor', 'a', 'b'], y: ['not', 'x'] }, o: { out: 'y' } },
  mux: { g: { ns: ['not', 'sel'], x: ['nand', 'a', 'ns'], y: ['nand', 'b', 'sel'], z: ['nand', 'x', 'y'] }, o: { out: 'z' } },
  dmux: { g: { n: ['nand', 'in', 'sel'], x: ['nand', 'in', 'n'], qa: ['not', 'x'], qb: ['not', 'n'] }, o: { a: 'qa', b: 'qb' } },
  maj: { g: { ...XOR4, m: ['nand', 'c', 'z'], q: ['nand', 'n', 'm'] }, o: { out: 'q' } },
  half: { g: { ...XOR4, k: ['not', 'n'] }, o: { sum: 'z', carry: 'k' } },
  full: {
    g: { ...XOR4, m: ['nand', 'z', 'c'], p: ['nand', 'z', 'm'], q: ['nand', 'c', 'm'], s: ['nand', 'p', 'q'], k: ['nand', 'n', 'm'] },
    o: { sum: 's', carry: 'k' },
  },
  add2: { g: { h: ['half', 'a0', 'b0'], f: ['full', 'a1', 'b1', 'h.1'] }, o: { s0: 'h', s1: 'f', c: 'f.1' } },
  sr: { g: { ns: ['not', 's'], nr: ['not', 'r'], q: ['nand', 'ns', 'nq'], nq: ['nand', 'nr', 'q'] }, o: { q: 'q' } },
  dlatch: { g: { x: ['nand', 'd', 'en'], y: ['nand', 'x', 'en'], q: ['nand', 'x', 'nq'], nq: ['nand', 'y', 'q'] }, o: { q: 'q' } },
  dff: { g: { nc: ['not', 'clk'], m: ['dlatch', 'd', 'nc'], s: ['dlatch', 'm', 'clk'] }, o: { q: 's' } },
  reg: { g: { m: ['mux', 'f', 'd', 'load'], f: ['dff', 'm', 'clk'] }, o: { q: 'f' } },
  ram2: {
    g: { w: ['dmux', 'load', 'addr'], c0: ['reg', 'd', 'w', 'clk'], c1: ['reg', 'd', 'w.1', 'clk'], m: ['mux', 'c0', 'c1', 'addr'] },
    o: { q: 'm' },
  },
  neg: { g: { n: ['not32', 'a'], z: ['z32'], one: ['k1'], s: ['add32', 'n', 'z', 'one'] }, o: { out: 's' } },
  sub: { g: { n: ['not32', 'b'], one: ['k1'], s: ['add32', 'a', 'n', 'one'] }, o: { out: 's' } },
  addsub: { g: { r: ['rep32', 'sub'], x: ['xor32', 'b', 'r'], s: ['add32', 'a', 'x', 'sub'] }, o: { out: 's', cout: 's.1' } },
  cmp: {
    g: {
      one: ['k1'],
      d: ['addsub', 'a', 'b', 'one'],
      nz: ['any32', 'd'],
      e: ['not', 'nz'],
      lu: ['not', 'd.1'],
      ma: ['msb32', 'a'],
      mb: ['msb32', 'b'],
      md: ['msb32', 'd'],
      x1: ['xor', 'ma', 'mb'],
      x2: ['xor', 'ma', 'md'],
      v: ['and', 'x1', 'x2'],
      l: ['xor', 'md', 'v'],
    },
    o: { eq: 'e', ltu: 'lu', lt: 'l' },
  },
  shl: {
    g: {
      h0: ['shl1', 'a'], m0: ['mux32', 'a', 'h0', 's0'],
      h1: ['shl2', 'm0'], m1: ['mux32', 'm0', 'h1', 's1'],
      h2: ['shl4', 'm1'], m2: ['mux32', 'm1', 'h2', 's2'],
      h3: ['shl8', 'm2'], m3: ['mux32', 'm2', 'h3', 's3'],
      h4: ['shl16', 'm3'], m4: ['mux32', 'm3', 'h4', 's4'],
    },
    o: { out: 'm4' },
  },
  alu: {
    g: {
      as: ['addsub', 'a', 'b', 'alt'], sl: ['sll32', 'a', 'b'], c: ['cmp', 'a', 'b'], lt: ['zext32', 'c.2'], lu: ['zext32', 'c.1'],
      x: ['xor32', 'a', 'b'], sr: ['srl32', 'a', 'b'], sa: ['sra32', 'a', 'b'], sx: ['mux32', 'sr', 'sa', 'alt'],
      o: ['or32', 'a', 'b'], n: ['and32', 'a', 'b'],
      m00: ['mux32', 'as', 'sl', 'f0'], m01: ['mux32', 'lt', 'lu', 'f0'], m10: ['mux32', 'x', 'sx', 'f0'], m11: ['mux32', 'o', 'n', 'f0'],
      m0: ['mux32', 'm00', 'm01', 'f1'], m1: ['mux32', 'm10', 'm11', 'f1'], m: ['mux32', 'm0', 'm1', 'f2'],
    },
    o: { out: 'm' },
  },
  rf4: {
    g: {
      t: ['dmux', 'we', 'd1'], u: ['dmux', 't', 'd0'], v: ['dmux', 't.1', 'd0'],
      x1: ['reg32', 'wd', 'u.1', 'clk'], x2: ['reg32', 'wd', 'v', 'clk'], x3: ['reg32', 'wd', 'v.1', 'clk'], z: ['z32'],
      p: ['mux32', 'z', 'x1', 'a0'], q: ['mux32', 'x2', 'x3', 'a0'], ra: ['mux32', 'p', 'q', 'a1'],
      s: ['mux32', 'z', 'x1', 'b0'], w: ['mux32', 'x2', 'x3', 'b0'], rb: ['mux32', 's', 'w', 'b1'],
    },
    o: { r1: 'ra', r2: 'rb' },
  },
  pcu: {
    g: {
      one: ['k1'], zero: ['k0'], four: ['k4'], base: ['kbase'],
      r: ['reg32', 'm2', 'one', 'clk'], inc: ['add32', 'r', 'four', 'zero'],
      m1: ['mux32', 'inc', 'target', 'jump'], m2: ['mux32', 'm1', 'base', 'reset'],
    },
    o: { pc: 'r' },
  },
  immgen: {
    g: {
      ii: ['imm_i', 'inst'], is: ['imm_s', 'inst'], ib: ['imm_b', 'inst'], iu: ['imm_u', 'inst'], ij: ['imm_j', 'inst'],
      m1: ['mux32', 'ii', 'is', 's'], m2: ['mux32', 'm1', 'ib', 'b'], m3: ['mux32', 'm2', 'iu', 'u'], m4: ['mux32', 'm3', 'ij', 'j'],
    },
    o: { imm: 'm4' },
  },
  brc: { g: { m1: ['mux', 'lt', 'ltu', 'f1'], m2: ['mux', 'eq', 'm1', 'f2'], t: ['xor', 'm2', 'f0'] }, o: { taken: 't' } },
  cpu1: cpu(CPU1, 'zero'),
  cpu2: cpu(CPU2, 'd.3'),
  cpu3: cpu(CPU3, 'd.3'),
  cpu4: cpu(CPU4, 'd.3'),
  hello: cpu(CPU4, 'd.3'),
  ldu: {
    g: {
      lo: ['low2', 'addr'],
      s8: ['shr8', 'rdata'], m0: ['mux32', 'rdata', 's8', 'lo.1'], s16: ['shr16', 'm0'], m1: ['mux32', 'm0', 's16', 'lo'],
      bs: ['sext8', 'm1'], bz: ['zext8', 'm1'], hs: ['sext16', 'm1'], hz: ['zext16', 'm1'],
      by: ['mux32', 'bs', 'bz', 'f2'], hf: ['mux32', 'hs', 'hz', 'f2'], bh: ['mux32', 'by', 'hf', 'f0'], v: ['mux32', 'bh', 'm1', 'f1'],
    },
    o: { out: 'v' },
  },
  // mask bit i = f1 OR (a1 matches bit 1 of i AND (f0 OR a0 matches bit 0 of i)), NAND form.
  stu: {
    g: {
      lo: ['low2', 'addr'],
      s8: ['shl8', 'data'], m0: ['mux32', 'data', 's8', 'lo.1'], s16: ['shl16', 'm0'], m1: ['mux32', 'm0', 's16', 'lo'],
      nf0: ['not', 'f0'], nf1: ['not', 'f1'], na0: ['not', 'lo.1'], na1: ['not', 'lo'],
      ev: ['nand', 'nf0', 'lo.1'], od: ['nand', 'nf0', 'na0'],
      u0: ['nand', 'na1', 'ev'], u1: ['nand', 'na1', 'od'], u2: ['nand', 'lo', 'ev'], u3: ['nand', 'lo', 'od'],
      e0: ['nand', 'nf1', 'u0'], e1: ['nand', 'nf1', 'u1'], e2: ['nand', 'nf1', 'u2'], e3: ['nand', 'nf1', 'u3'],
      mk: ['join4', 'e3', 'e2', 'e1', 'e0'],
    },
    o: { wdata: 'm1', mask: 'mk' },
  },
  cpu5: cpuMask(CPU5),
  cnt: {
    g: {
      d0: ['nor', 'reset', 'f0'],
      x: ['xor', 'f1', 'f0'],
      nr: ['not', 'reset'],
      d1: ['and', 'x', 'nr'],
      f0: ['dff', 'd0', 'clk'],
      f1: ['dff', 'd1', 'clk'],
    },
    o: { q1: 'f1', q0: 'f0' },
  },
};
STAGES.forEach((s) => {
  s.solution = SOLUTIONS[s.id];
  if (s.prog) s.words = assemble(s.prog);
  // Program stages take their limits from the reference CPU.
  if (s.gold == null) {
    s.gold = Object.values(s.solution.g).reduce((n, [type]) => n + PARTS[type].cost, 0);
    s.silver = Math.ceil(s.gold * 1.12);
  }
});

export const PLANNED_COUNT = WORLDS.reduce((n, w) => n + (w.planned?.length || 0), 0);

// Parts available in a stage: its own `parts` list if it has one (bus stages keep
// the palette short), otherwise NAND plus every reward from earlier stages.
export function partsFor(stage) {
  return stage.parts || ['nand', ...STAGES.slice(0, stage.idx).flatMap((s) => s.reward || [])];
}

export const BADGES = [
  { id: 'first', icon: 'Q01', name: 'FIRST PASS', desc: 'Pass any drawing.' },
  { id: 'gold', icon: 'Q02', name: 'REDUCER', desc: 'Reach grade A by cutting the NAND count.' },
  { id: 'purist', icon: 'Q03', name: 'NAND ONLY', desc: 'Pass XOR or later using NAND alone.' },
  { id: 'fast', icon: 'Q04', name: 'RAPID', desc: 'Pass a drawing within 45 s.' },
  { id: 'nohint', icon: 'Q05', name: 'UNAIDED', desc: 'Pass 5 drawings without hints.' },
  { id: 'over', icon: 'Q06', name: 'OVERBUILT', desc: 'Pass with twice the grade B limit or more.' },
  { id: 'w1', icon: 'Q07', name: 'SECTION 1', desc: 'Pass every drawing in section 1.' },
  { id: 'w2', icon: 'Q08', name: 'SECTION 2', desc: 'Pass every drawing in section 2.' },
  { id: 'w3', icon: 'Q09', name: 'SECTION 3', desc: 'Pass every drawing in section 3.' },
  { id: 'w4', icon: 'Q10', name: 'SECTION 4', desc: 'Pass every drawing in section 4.' },
  { id: 'w5', icon: 'Q11', name: 'SECTION 5', desc: 'Pass every drawing in section 5.' },
  { id: 'w6', icon: 'Q12', name: 'SECTION 6', desc: 'Pass every drawing in section 6.' },
  { id: 'w7', icon: 'Q13', name: 'GOAL 1: HELLO', desc: 'Print HELLO from your own processor.' },
  { id: 'w8', icon: 'Q14', name: 'GOAL 2: RV32I', desc: 'Run a program on your own RV32I processor.' },
  { id: 'allgold', icon: 'Q15', name: 'ALL GRADE A', desc: 'Reach grade A on every drawing.' },
];

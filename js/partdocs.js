// Part reference: what each part in js/sim.js does, one line, and one short line per
// terminal, keyed by the terminal's name. Widths are not repeated here: the reference
// reads them from PARTS (iw / ow). Shown in the specification panel (PARTS ON THIS
// SHEET) and in the part panel over the sheet when a palette chip is hovered or focused
// or a placed part is selected (js/main.js). Japanese is in js/i18n.ja.js under parts.<key>;
// tools/verify.mjs checks that every part and terminal has both.

const shl = (k) => ({
  desc: `Fixed shift left by ${k}: bits shifted out are lost, zeros come in at the bottom. Wiring only.`,
  pins: { a: 'value', out: `a << ${k}` },
});

export const PART_DOCS = {
  nand: { desc: 'out is 0 only when a and b are both 1.', pins: { a: 'input', b: 'input', out: 'NOT (a AND b)' } },
  not: { desc: 'Inverts its input.', pins: { in: 'input', out: 'NOT in' } },
  and: { desc: 'out is 1 only when a and b are both 1.', pins: { a: 'input', b: 'input', out: 'a AND b' } },
  or: { desc: 'out is 1 when a or b is 1.', pins: { a: 'input', b: 'input', out: 'a OR b' } },
  nor: { desc: 'out is 1 only when a and b are both 0.', pins: { a: 'input', b: 'input', out: 'NOT (a OR b)' } },
  xor: { desc: 'out is 1 when a and b differ.', pins: { a: 'input', b: 'input', out: 'a XOR b' } },
  xnor: { desc: 'out is 1 when a and b are equal.', pins: { a: 'input', b: 'input', out: 'NOT (a XOR b)' } },
  mux: {
    desc: 'A switch: out follows a while sel is 0, b while sel is 1.',
    pins: { a: 'passed when sel = 0', b: 'passed when sel = 1', sel: 'select', out: 'a or b' },
  },
  dmux: {
    desc: 'Sends in to a when sel is 0, to b when sel is 1. The other output is 0.',
    pins: { in: 'data', sel: 'select', a: 'in when sel = 0, else 0', b: 'in when sel = 1, else 0' },
  },
  half: {
    desc: 'Adds two bits.',
    pins: { a: 'bit to add', b: 'bit to add', sum: 'low digit: a XOR b', carry: 'high digit: a AND b' },
  },
  full: {
    desc: 'Adds three bits.',
    pins: { a: 'bit to add', b: 'bit to add', c: 'carry in from the digit below', sum: 'low digit of a + b + c', carry: 'high digit: 1 when two or more inputs are 1' },
  },
  sr: {
    desc: 'Holds one bit. Starts at 0. r wins when s and r are both 1.',
    pins: { s: 'set: 1 makes q 1', r: 'reset: 1 makes q 0', q: 'the stored bit; holds while s and r are 0' },
  },
  dlatch: {
    desc: 'Transparent while en is 1, holds while en is 0. Starts at 0.',
    pins: { d: 'data', en: 'enable', q: 'follows d while en = 1, else holds' },
  },
  dff: {
    desc: 'Takes d at the instant clk rises from 0 to 1, holds at all other times. Starts at 0.',
    pins: { d: 'data, sampled on the rising edge', clk: 'clock', q: 'the stored bit' },
  },
  reg: {
    desc: 'A flip-flop that takes d on a rising clk edge only when load is 1. Starts at 0.',
    pins: { d: 'data', load: '1: store d on the rising edge; 0: keep q', clk: 'clock', q: 'the stored bit' },
  },
  k0: { desc: 'Constant 0.', pins: { out: '0' } },
  k1: { desc: 'Constant 1.', pins: { out: '1' } },
  z32: { desc: 'Constant 00000000.', pins: { out: '00000000' } },
  k4: { desc: 'Constant 00000004, the size of one instruction.', pins: { out: '00000004' } },
  kbase: { desc: 'Constant 80000000, where RAM starts and programs are loaded.', pins: { out: '80000000' } },
  not32: { desc: 'NOT on each of 32 lines.', pins: { a: 'input', out: 'NOT a, bit by bit' } },
  and32: { desc: 'AND on each of 32 line pairs.', pins: { a: 'input', b: 'input', out: 'a AND b, bit by bit' } },
  or32: { desc: 'OR on each of 32 line pairs.', pins: { a: 'input', b: 'input', out: 'a OR b, bit by bit' } },
  xor32: { desc: 'XOR on each of 32 line pairs.', pins: { a: 'input', b: 'input', out: 'a XOR b, bit by bit' } },
  mux32: {
    desc: '32 MUX side by side under one select line.',
    pins: { a: 'passed when sel = 0', b: 'passed when sel = 1', sel: 'select', out: 'a or b' },
  },
  add32: {
    desc: 'A 32-bit adder: the full-adder chain, 32 long.',
    pins: { a: 'addend', b: 'addend', cin: 'carry into bit 0: 1 adds one more', sum: 'a + b + cin, low 32 bits', cout: 'carry out of bit 31' },
  },
  rep32: { desc: 'Copies one line onto all 32 lines of a bus. Wiring only.', pins: { in: 'bit', out: 'FFFFFFFF when in = 1, else 00000000' } },
  zext32: { desc: 'Widens one line to a 32-bit number. Wiring only.', pins: { in: 'bit', out: '00000001 when in = 1, else 00000000' } },
  msb32: { desc: 'Taps bit 31, the sign bit. Wiring only.', pins: { a: 'value', out: 'bit 31 of a' } },
  any32: { desc: 'out is 1 when any bit of a is 1.', pins: { a: 'value', out: '0 only when a = 00000000' } },
  ...Object.fromEntries([1, 2, 4, 8, 16].map((k) => ['shl' + k, shl(k)])),
  reg32: {
    desc: 'A 32-bit register: takes d on a rising clk edge when load is 1. Starts at 00000000.',
    pins: { d: 'data', load: '1: store d on the rising edge; 0: keep q', clk: 'clock', q: 'the stored value' },
  },
  addsub: {
    desc: 'One adder that adds or subtracts.',
    pins: { a: 'first operand', b: 'second operand', sub: '0: a + b; 1: a - b', out: 'the result, low 32 bits', cout: 'carry out; when subtracting, 1 means no borrow (a >= b unsigned)' },
  },
  cmp: {
    desc: 'Compares a and b three ways at once.',
    pins: { a: 'first operand', b: 'second operand', eq: '1 when a = b', ltu: '1 when a < b as unsigned numbers', lt: '1 when a < b as signed numbers (bit 31 is the sign)' },
  },
  sll32: {
    desc: 'Shifts a left by bits 4:0 of b; zeros come in.',
    pins: { a: 'value', b: 'shift amount; only bits 4:0 are used', out: 'a << b' },
  },
  srl32: {
    desc: 'Shifts a right by bits 4:0 of b; zeros come in at the top.',
    pins: { a: 'value', b: 'shift amount; only bits 4:0 are used', out: 'a >> b, logical' },
  },
  sra32: {
    desc: 'Shifts a right by bits 4:0 of b; copies of bit 31 come in at the top.',
    pins: { a: 'value', b: 'shift amount; only bits 4:0 are used', out: 'a >> b, arithmetic' },
  },
  alu: {
    desc: 'The RV32I arithmetic unit. All eight results are computed; f2 f1 f0 keeps one.',
    pins: {
      a: 'first operand',
      b: 'second operand; shifts use only bits 4:0',
      f2: 'funct3 bit 2 (instruction bit 14)',
      f1: 'funct3 bit 1 (instruction bit 13)',
      f0: 'funct3 bit 0 (instruction bit 12)',
      alt: '1: subtract for 000, shift right arithmetic for 101; ignored for the others',
      out: '000 a + b (a - b if alt), 001 a << b, 010 1 if a < b signed, 011 1 if a < b unsigned, 100 a XOR b, 101 a >> b (arithmetic if alt), 110 a OR b, 111 a AND b',
    },
  },
  regfile: {
    desc: 'The 32 registers x0 to x31: two read ports and one write port. x0 always reads 0. All start at 0. A CPU test reads the registers straight out of this part.',
    pins: {
      wd: 'data to write',
      we: 'write enable: 1 writes wd to register rd on the rising clk edge',
      rd: 'register to write, 0 to 31; a write to x0 is ignored',
      rs1: 'register shown on r1',
      rs2: 'register shown on r2',
      clk: 'clock',
      r1: 'value of register rs1, at once: reads need no clock',
      r2: 'value of register rs2, at once',
    },
  },
  opdec: {
    desc: 'Decodes the major opcode, instruction bits 6:0. One output is 1 for each opcode below; all are 0 for any other.',
    pins: {
      inst: 'the instruction',
      op: '1 for OP, register-register arithmetic (opcode 0110011)',
      opimm: '1 for OP-IMM, arithmetic with an immediate (0010011)',
      load: '1 for loads LB LH LW LBU LHU (0000011)',
      store: '1 for stores SB SH SW (0100011)',
      branch: '1 for BEQ BNE BLT BGE BLTU BGEU (1100011)',
      jal: '1 for JAL (1101111)',
      jalr: '1 for JALR (1100111)',
      lui: '1 for LUI (0110111)',
      auipc: '1 for AUIPC (0010111)',
    },
  },
  f_rd: { desc: 'Taps the rd field, instruction bits 11:7. Wiring only.', pins: { inst: 'the instruction', rd: 'destination register number' } },
  f_rs1: { desc: 'Taps the rs1 field, instruction bits 19:15. Wiring only.', pins: { inst: 'the instruction', rs1: 'first source register number' } },
  f_rs2: { desc: 'Taps the rs2 field, instruction bits 24:20. Wiring only.', pins: { inst: 'the instruction', rs2: 'second source register number' } },
  f_f3: {
    desc: 'Taps funct3, instruction bits 14:12, as three lines. Wiring only.',
    pins: { inst: 'the instruction', f2: 'bit 14', f1: 'bit 13', f0: 'bit 12' },
  },
  f_b30: {
    desc: 'Taps instruction bit 30. In OP it marks SUB and SRA; in OP-IMM it is bit 10 of the immediate, except that it marks SRAI. Wiring only.',
    pins: { inst: 'the instruction', out: 'bit 30' },
  },
  imm_i: {
    desc: 'The I-format immediate: bits 31:20, sign-extended. OP-IMM, loads and JALR. Wiring only.',
    pins: { inst: 'the instruction', imm: 'the immediate' },
  },
  imm_s: {
    desc: 'The S-format immediate: bits 31:25 then 11:7, sign-extended. Stores. Wiring only.',
    pins: { inst: 'the instruction', imm: 'the immediate' },
  },
  imm_b: {
    desc: 'The B-format immediate: bits 31, 7, 30:25, 11:8 and a 0 below, sign-extended. Branches. Wiring only.',
    pins: { inst: 'the instruction', imm: 'the immediate, always even' },
  },
  imm_u: {
    desc: 'The U-format immediate: bits 31:12 with 12 zeros below. LUI and AUIPC. Wiring only.',
    pins: { inst: 'the instruction', imm: 'the immediate' },
  },
  imm_j: {
    desc: 'The J-format immediate: bits 31, 19:12, 20, 30:21 and a 0 below, sign-extended. JAL. Wiring only.',
    pins: { inst: 'the instruction', imm: 'the immediate, always even' },
  },
  immgen: {
    desc: 'Picks the immediate of the instruction format. With no select line at 1 it gives I. When several are 1, j wins, then u, then b, then s.',
    pins: {
      inst: 'the instruction',
      s: '1: S format (stores)',
      b: '1: B format (branches)',
      u: '1: U format (LUI, AUIPC)',
      j: '1: J format (JAL)',
      imm: 'the immediate, sign-extended to 32 bits',
    },
  },
  brcond: {
    desc: 'Decides whether a branch is taken, from the comparator and funct3.',
    pins: {
      eq: 'CMP32 eq',
      ltu: 'CMP32 ltu',
      lt: 'CMP32 lt',
      f2: 'funct3 bit 2: 0 compares eq, 1 compares lt or ltu',
      f1: 'funct3 bit 1: with f2 = 1, 0 picks lt, 1 picks ltu',
      f0: 'funct3 bit 0: 1 inverts the result',
      taken: '1 when the branch goes',
    },
  },
  pc: {
    desc: 'The program counter: a 32-bit register that steps itself on each rising clk edge. Starts at 00000000.',
    pins: {
      target: 'next address when jump = 1',
      jump: '1: go to target instead of pc + 4',
      reset: '1: go to 80000000; wins over jump',
      clk: 'clock',
      pc: 'address of the current instruction',
    },
  },
  shr8: { desc: 'Fixed shift right by 8, zeros in at the top. Wiring only.', pins: { a: 'value', out: 'a >> 8' } },
  shr16: { desc: 'Fixed shift right by 16, zeros in at the top. Wiring only.', pins: { a: 'value', out: 'a >> 16' } },
  low2: { desc: 'Taps bits 1 and 0 of an address. Wiring only.', pins: { a: 'address', a1: 'bit 1', a0: 'bit 0' } },
  sext8: { desc: 'Keeps bits 7:0 and fills bits 31:8 with copies of bit 7. Wiring only.', pins: { a: 'value', out: 'low byte, sign-extended' } },
  zext8: { desc: 'Keeps bits 7:0 and clears bits 31:8. Wiring only.', pins: { a: 'value', out: 'low byte, zero-extended' } },
  sext16: { desc: 'Keeps bits 15:0 and fills bits 31:16 with copies of bit 15. Wiring only.', pins: { a: 'value', out: 'low half-word, sign-extended' } },
  zext16: { desc: 'Keeps bits 15:0 and clears bits 31:16. Wiring only.', pins: { a: 'value', out: 'low half-word, zero-extended' } },
  join4: {
    desc: 'Gathers four lines into a 4-bit bus. Wiring only.',
    pins: { b3: 'bit 3, the highest', b2: 'bit 2', b1: 'bit 1', b0: 'bit 0, the lowest', out: 'b3 b2 b1 b0' },
  },
  loadunit: {
    desc: 'The value a load returns: the LOAD UNIT drawing as one part.',
    pins: {
      rdata: 'the word memory returns for the address',
      addr: 'the load address; bits 1 and 0 pick the byte or half-word',
      f2: 'funct3 bit 2: 1 zero-extends (LBU, LHU), 0 sign-extends',
      f1: 'funct3 bit 1: 1 keeps the whole word (LW)',
      f0: 'funct3 bit 0: 1 half-word (LH, LHU), 0 byte (LB, LBU)',
      out: 'rdata moved down by 8 x addr bits 1:0, then cut and extended as funct3 says',
    },
  },
  storeunit: {
    desc: 'Lines store data up with its byte lane and makes the byte mask: the STORE UNIT drawing as one part.',
    pins: {
      data: 'the value to store (the second register)',
      addr: 'the store address; bits 1 and 0 pick the lane',
      f1: 'funct3 bit 1: 1 for SW',
      f0: 'funct3 bit 0: 1 for SH, 0 for SB',
      wdata: 'data shifted left by 8 x addr bits 1:0',
      mask: 'one bit per byte the store writes, bit 0 = lowest byte',
    },
  },
};

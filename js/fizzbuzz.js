// The demo program of the last drawing: FizzBuzz from 1 to 100 on the UART,
// RV32I only. With no divide, a mod-3 and a mod-5 counter count down, and the
// number is kept as ASCII digits in memory, incremented with carry by LBU / SB.
// Strings end in a zero byte and go out through PUTS, called with JAL, back by JALR.
//
// Data at 80000400: 'FIZZ' 0, 'BUZZ' 0, then the digits '000' 0 (80000410-13).
// Registers: x1 return address, x2 data, x5 uart, x8 first digit printed,
// x9 ':' (one past '9'), x10 string for PUTS, x11 numbers left, x12 / x13 steps
// to the next multiple of 3 / 5, x14 set when FIZZ went out, x15 digit carried into.
// Ends in `jal x0, done`, the halt loop the harness stops at.

export const FIZZBUZZ = [
  ['lui', 2, 0x80000], ['addi', 2, 2, 0x400, '; x2 = 80000400, the data'],
  ['lui', 5, 0x10000, '; x5 = 10000000, the uart'],
  ['lui', 28, 0x5a5a5], ['addi', 28, 28, -0x6ba, "; 'FIZZ'"], ['sw', 28, 2, 0], ['sw', 0, 2, 4, '; and its zero byte'],
  ['lui', 28, 0x5a5a5], ['addi', 28, 28, 0x542, "; 'BUZZ'"], ['sw', 28, 2, 8], ['sw', 0, 2, 12],
  ['lui', 28, 0x00303], ['addi', 28, 28, 0x030, "; '000' and a zero byte"], ['sw', 28, 2, 16],
  ['addi', 8, 2, 18, '; print from the ones digit'],
  ['addi', 9, 0, 58, "; x9 = ':', one past '9'"],
  ['addi', 11, 0, 100, '; 100 numbers'],
  ['addi', 12, 0, 3], ['addi', 13, 0, 5],
  'next',
  ['addi', 15, 2, 18, '; add one to the ones digit'],
  'carry',
  ['lbu', 28, 15, 0],
  ['addi', 28, 28, 1],
  ['bne', 28, 9, 'digit', "; past '9'?"],
  ['addi', 28, 0, 48, "; then '0'"],
  ['sb', 28, 15, 0],
  ['addi', 15, 15, -1, '; and carry into the digit on the left'],
  ['jal', 0, 'carry'],
  'digit',
  ['sb', 28, 15, 0, '; one byte: its neighbours stay'],
  ['bgeu', 15, 8, 'count'],
  ['addi', 8, 15, 0, '; a new leading digit'],
  'count',
  ['addi', 14, 0, 0],
  ['addi', 12, 12, -1],
  ['bne', 12, 0, 'not3'],
  ['addi', 12, 0, 3],
  ['addi', 10, 2, 0],
  ['jal', 1, 'puts', '; FIZZ'],
  ['addi', 14, 0, 1],
  'not3',
  ['addi', 13, 13, -1],
  ['bne', 13, 0, 'not5'],
  ['addi', 13, 0, 5],
  ['addi', 10, 2, 8],
  ['jal', 1, 'puts', '; BUZZ'],
  ['jal', 0, 'eol'],
  'not5',
  ['bne', 14, 0, 'eol'],
  ['addi', 10, 8, 0],
  ['jal', 1, 'puts', '; the number'],
  'eol',
  ['addi', 28, 0, 10],
  ['sb', 28, 5, 0, "; '\\n'"],
  ['addi', 11, 11, -1],
  ['bne', 11, 0, 'next'],
  'done',
  ['jal', 0, 'done', '; stop'],
  'puts',
  ['lbu', 29, 10, 0, '; next character'],
  ['beq', 29, 0, 'ret', '; zero ends the string'],
  ['sb', 29, 5, 0],
  ['addi', 10, 10, 1],
  ['jal', 0, 'puts'],
  'ret',
  ['jalr', 0, 1, 0, '; return'],
];

// What the program prints, written the obvious way.
export function fizzbuzzText(n = 100) {
  let s = '';
  for (let i = 1; i <= n; i++) s += (i % 15 === 0 ? 'FIZZBUZZ' : i % 3 === 0 ? 'FIZZ' : i % 5 === 0 ? 'BUZZ' : String(i)) + '\n';
  return s;
}

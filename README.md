# NAND2RISCV

A browser course that builds a RISC-V computer step by step, starting from a single NAND gate.
Goal 1 is a self-built processor that prints HELLO to a UART (section 7); goal 2, the end of the course, is the
complete RV32I processor with byte and half-word access (section 8). Both are built.
Each stage asks for one circuit; clearing it unlocks that circuit as a part for later stages.

Static site, no build step. Serve the directory, e.g. `python3 -m http.server 8795`, and open
`http://localhost:8795/`. For Claude Code previews, `.claude/launch.json` has a `nand2riscv` entry that serves it
on port 8795 (another port when that one is taken) with caching off.

## Look

Monochrome CAD drawing: black sheet, white lines, monospace English capitals (Japanese prose under LANG JA, see
Language). No colour, emoji or decorative animation.

On the drawing sheet the rule beside each side panel is a resize handle: drag it, or focus it and use the
arrow keys (16 px); double-click resets that panel. Widths are clamped (panel >= 200 px, sheet >= 320 px),
saved as `panes` (`{ left, right, wide }` in px, `wide` being the test panel of a CPU drawing; a missing
field keeps the stylesheet default), and ignored where the panels stack (<= 760 px; up to 1180 px only the
test panel resizes).

## Language

`LANG EN` / `LANG JA` (index header next to SOUND, and the drawing sheet's header) switches the prose a player
reads: each stage's specification, notes and hints, qualification descriptions, the explanatory lines of the
confirm dialogs and the verification report, the controls list, and mismatch reasons that are whole sentences.
The chrome stays English: product, section and stage titles, headers, buttons, part, pin and register names,
mnemonics, hex, the program listing, the status bar. Switching re-renders in place (sheet, test state and a
running VERIFY are kept). The choice is saved as `lang` (`'en'` default; older saves load as `'en'`).
Japanese strings live in `js/i18n.ja.js`, keyed by stage id or string key; `js/i18n.js` is the lookup, and a
missing string falls back to the English. Japanese text is marked `lang="ja"` and set without capitals or
letter-spacing (`body [lang='ja']` in `css/style.css`). `tools/verify.mjs` fails when a stage lacks a Japanese
goal, notes or any hint, or a qualification its description.

## Status

Complete: sections 1–8 (logic gates, routing, arithmetic, memory, 32-bit datapath, RV32I CPU, HELLO,
RV32I), 36 stages, 15 qualifications. No planned sections remain.
Section 6 is IMMEDIATE GENERATOR, BRANCH CONDITION, then four CPU drawings: ARITHMETIC, LOAD AND STORE,
BRANCH, JUMP AND UPPER. Section 7 runs a program that prints HELLO (GOAL 1).
Section 8 (GOAL 2) is LOAD UNIT, STORE UNIT, CPU / RV32I. CPU / RV32I is the last drawing of the course.

`node tools/verify.mjs` checks every stage: the reference solution passes, its NAND count equals `gold`, an empty
sheet fails, every part is in the stage's palette, every wire joins equal widths, and a program stage's previous
reference CPU fails the new program (HELLO excepted: it reuses the CPU before it). It also checks the Japanese text,
runs the FizzBuzz demo on the `cpu5` reference circuit in lockstep with `refStep` (3,879 instructions, about 2.5 s)
and compares its UART output with the 100 lines generated in JS, prints the elapsed time (about 3 s in all,
Node 24 on an Apple laptop) and exits non-zero on a failure.

## Goals

- GOAL 1 (section 7, done): a self-built RV32I processor prints HELLO to a UART.
- GOAL 2 (section 8, done): the complete RV32I processor: load unit, store unit, CPU with byte and half-word
  access; its program upper-cases a string in memory one byte at a time and prints `HELLO RV32I`. Once it passes,
  the same circuit runs FizzBuzz (see Demo).

RV32I here leaves out ECALL, EBREAK and FENCE: with no traps, no operating system and one hart with no cache, they
have nothing to do on this machine.

Not in scope: booting Linux on the player's CPU (sections 8–9 once ran the first 334K kernel instructions), the CSRs
(Zicsr), the A extension (LR / SC and AMOs) and the M extension (multiply and divide) were explored and dropped;
traps, interrupts and privilege modes are therefore not built either.

`js/rv32.js` is the specification source for program stages: assembler, disassembler and the reference
interpreter `refStep`, which every drawn CPU runs in lockstep with.

## Game rules

- Grade: C for a correct circuit, B for NAND count ≤ `silver`, A for NAND count ≤ `gold`
  (stored as `stars` 1–3). A part counts as its `cost` in NANDs (`js/sim.js`).
- VERIFY sweeps the test rows, then reports. During the sweep the button reads `STOP`: it (or ESC, when no
  dialog is open) cancels the sweep, as does `< INDEX`. Nothing is scored, the sheet (and a SHOW ANSWER grade
  cap) is kept and unlocked, and the panel returns to VERIFY with `VERIFY STOPPED. NOTHING SCORED.`
- Points: 100 for a first pass, 50 per grade step gained, 75 per qualification. Operator classes are in `js/store.js`.
- SHOW ANSWER loads the stage's reference netlist (`SOLUTIONS` in `js/levels.js`). A sheet passed that way is
  capped at grade C until it is cleared and redrawn.
- Progress and in-progress circuits are kept in `localStorage` under `nand2riscv.v2`
  (when it is empty, the first non-empty of `nand2linux.v1`, `nand2riscv.v1`, `nandsmith.v1` is read as a
  fallback; old keys are never written or removed). The key is `.v2` because a stale `nand2riscv.v1` save from
  before the course was briefly named NAND2LINUX must not shadow a newer `nand2linux.v1` save. Stage ids that no
  longer exist (`linux1`, `csrf`, `csrop`, `cpu6`, `resv`, `amo`, `cpu8`, `muls`, `mul8`, `mul`, `divs`, `div8`,
  `div`, `cpu7`) and qualifications that no longer exist (`w9`) are ignored, and a saved sheet that holds a part type
  that no longer exists (`CSRFILE`, `RESV`, `MUL32`, ...) loads without it and its wires.

## Layout

- `js/sim.js` — part definitions (combinational and stateful), circuit evaluation, truth tables and clocked tests
- `js/levels.js` — sections, drawings (stages) and qualifications; all text is English
- `js/i18n.js`, `js/i18n.ja.js` — EN / JA lookup and the Japanese prose
- `js/rv32.js` — assembler, disassembler, reference interpreter, program harness
- `js/fizzbuzz.js` — the demo program of the last drawing and its expected output
- `tools/verify.mjs` — checks every stage's reference solution, limits, palette and bus widths, and the demo
- `js/editor.js` — SVG circuit editor (schematic gate symbols, orthogonal wires)
- `js/main.js` — drawing index, drawing sheet and verification report, progression
- `js/panes.js` — resizable side panels on the drawing sheet
- `js/store.js`, `js/fx.js` — persistence, sound

## Clocked stages

Section 4 stages have no truth table. Each defines a behavioural `model` and a `seq` of input vectors;
the circuit is powered on once and stepped through the sequence, and each row is compared with the model
(`null` from the model means "don't care", shown as `X`). Stateful parts (`SR`, `DLATCH`, `DFF`, `REG`)
commit their state only after the circuit has settled, so all of them sample the same instant.

## Buses

Terminals are 1 bit wide unless a part declares `iw` / `ow`, or a stage declares pin widths in `w`.
A wire only connects terminals of equal width. Section 5 hands out 32-bit parts (`grant` on the section):
32 copies of the 1-bit gates, `ADD32`, `REG32`, and zero-cost wiring parts (constants, `MSB32`, `REP32`,
`ZEXT32`, fixed shifts). Bus stages list test vectors in `vec` instead of a full truth table, and may set
`zoom` for a larger sheet.

## Program stages

A CPU drawing has pins `inst`, `rdata`, `reset`, `clk` → `pc`, `addr`, `wdata`, `memw`, and from section 8 also
`wmask` (4 bits, bit 0 = lowest byte of the word).
`memw` says whether a step writes and `wmask` which bytes. A `wmask` of `0000` with `memw` set writes the whole
word: sheets from before section 8 never drive `wmask`, so an inherited sheet keeps running its word stores, and
stages without the pin (sections 6–7) behave exactly as before. A write matches the reference when `addr` and the
effective mask agree and `wdata` agrees on the bytes written; the other bytes are don't-care. `addr` is the full
byte address; memory ignores its low two bits.
Memory lives outside the sheet, in the harness (`runProgram` in `js/rv32.js`).
The stage's `prog` is assembled by `assemble`, loaded at `0x8000_0000`, and run in lockstep with `refStep`.
After every instruction the harness compares PC, the 32 registers (read from the single `REGFILE` part on
the sheet) and any memory write. A store the
drawn CPU makes to `0x1000_0000` that covers byte 0 (a word store, or `SB`) is
collected as serial output (low byte) and shown in the SERIAL CONSOLE panel; a stage with `uart` only
passes when that output equals it. The console shows the output as of the selected or swept row, so the
characters appear one at a time during VERIFY.
The PROGRAM LISTING panel above the trace shows `prog` as source (`listing` in `js/rv32.js`): address, machine
word, labels on their own line, branch and jump targets by label, and comments. A comment is a trailing string
starting with `;` on an instruction, e.g. `['addi', 6, 0, 72, "; x6 = 'H'"]`; the assembler ignores it. The line
on the sheet is highlighted, clicking a line selects the first trace step at that address, and lines the
reference run never reaches are dimmed.
`inherit` carries the saved sheet from the previous CPU drawing. Limits (`gold` / `silver`) of program
stages are derived from the reference CPU's NAND count.

## Section 8

- LOAD UNIT (`LOADUNIT`, 768): rdata, addr, f2 f1 f0 → the LB / LH / LW / LBU / LHU value. Two MUX32 on
  `SHR8` / `SHR16` move the byte down, `SEXT8` / `ZEXT8` / `SEXT16` / `ZEXT16` widen it, four MUX32 select.
- STORE UNIT (`STOREUNIT`, 270): data, addr, f1 f0 → wdata (shifted into its lane) and a 4-bit mask (`JOIN4`).
- CPU / RV32I (`cpu5`, inherits HELLO; GOAL 2, the last drawing): the HELLO sheet plus both units. The program
  stores two words and reads them back with LB / LBU / LH / LHU at several offsets (both signs), writes single
  lanes with SB and halves with SH, then upper-cases a 12-byte string in place with LBU / SB and prints it:
  `HELLO RV32I` (165 steps).
- Section grant (wiring, cost 0): `LOW2`, `SHR8`, `SHR16`, the four extenders, `JOIN4`.

## Demo

The last drawing (`cpu5`, `demo` in `js/levels.js`) has a `RUN FIZZBUZZ` control under VERIFY. VERIFY animates every
step and stops at 300, so its program stays short; the demo runs a longer one at full speed on the circuit on the sheet:
FizzBuzz from 1 to 100 (`js/fizzbuzz.js`), RV32I only. With no divide it keeps a mod-3 and a mod-5 down-counter and
the number as ASCII digits in memory, incremented with carry by `LBU` / `SB`; `FIZZ`, `BUZZ` and the digits are
zero-terminated strings printed by a `PUTS` subroutine called with `JAL` and left with `JALR`. 57 words, 3,879
instructions, ending in the usual `jal x0, done` halt loop.

- Available once `cpu5` is passed in the save; before that the control is disabled with a note.
- Runs in time slices (`demoTick` in `js/main.js`, about 12 ms of simulation each) on `startProgram` from
  `js/rv32.js`, which steps the drawn CPU and `refStep` together. A run that would finish in under 6 s is paced to
  about 6 s so the output visibly streams; the sheet, PC, current instruction, step count and a progress bar
  follow it.
- The first difference from the reference stops it and is reported like a VERIFY failure (step, PC, what
  differed); the output is also compared with the reference's at the end. A clean run ends with
  `DEMO COMPLETE / N INSTRUCTIONS / T S`.
- `STOP`, VERIFY, any edit of the sheet, a trace row, `PROGRAM: TEST`, switching language or leaving the stage
  ends the run. `PROGRAM: TEST / DEMO` above the listing picks which program the listing and console show: the
  stage's test program with its execution trace, or FizzBuzz, where the trace is hidden and the console takes its
  height. VERIFY and reopening the stage return to the test program.
- No points, grade, qualification or save change.

## Known gaps

- Misaligned half-word and word access is not tested; `LW` ignores the low two address bits.
- `JALR` does not clear bit 0 of the target.
- No traps and no SYSTEM or MISC-MEM instructions: `ECALL`, `EBREAK` and `FENCE` are not assembled and do
  nothing in `refStep`.
- The sheet zooms (wheel, pinch, ZOOM +/- buttons, + / - / 0 keys, double-click) and pans by dragging,
  but there is no bus splitter or joiner. Instruction fields are tapped with
  fixed wiring parts (`RD`, `RS1`, `RS2`, `FUNCT3`, `BIT30`, `IMM-x`, `OPDEC`, `LOW2`, `JOIN4`).
- Circuits built from raw gates with feedback are settled by ordered relaxation, not real gate delays,
  so some hand-built latch designs that are valid in hardware may fail to settle the same way.
- The software sections need a different stage kind (code editor plus emulator), not the circuit editor.

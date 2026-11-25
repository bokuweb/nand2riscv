// SVG circuit editor: place parts, drag wires between ports, toggle inputs.
// The whole sheet is re-rendered on every change; circuits are small.
//
// The sheet's coordinate space follows the element's aspect ratio (see fit()),
// and everything snaps to an 8-unit grid so wires run straight.

import { PARTS, evaluate, newMem, nandCount } from './sim.js';
import { sfx } from './fx.js';

const GRID = 8;
const PIN_W = 56;
const PIN_H = 40;
const BUS_PIN_W = 96;
export const hex = (v, width) => (v >>> 0).toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0');
const EDGE = 32; // sheet edge to pin
const FRAME = 24; // sheet edge to inner drawing frame
const snap = (v) => Math.round(v / GRID) * GRID;
const pad4 = (v) => String(Math.max(0, Math.round(v))).padStart(4, '0');

// Orthogonal routing, schematic style. Wires that run backwards detour around.
const curve = (a, c) => {
  if (c.x >= a.x + 24) return `M${a.x},${a.y}H${snap((a.x + c.x) / 2)}V${c.y}H${c.x}`;
  const my = snap((a.y + c.y) / 2) + (Math.abs(a.y - c.y) < 64 ? 56 : 0);
  return `M${a.x},${a.y}H${a.x + 16}V${my}H${c.x - 16}V${c.y}H${c.x}`;
};

// Schematic symbols for the two-terminal-wide gates, drawn in an 88x48 box
// with leads running to the terminals on the box edge.
const BODY = {
  and: 'M18,4H44A20,20 0 0 1 44,44H18Z',
  or: 'M16,4Q30,24 16,44Q46,44 64,24Q46,4 16,4Z',
  not: 'M18,6V42L60,24Z',
};
const SHAPE = { nand: 'and', and: 'and', or: 'or', nor: 'or', xor: 'or', xnor: 'or', not: 'not' };

function symbol(type) {
  const shape = SHAPE[type];
  const inverted = type === 'nand' || type === 'nor' || type === 'xnor' || type === 'not';
  const tip = shape === 'not' ? 60 : 64;
  const inX = shape === 'or' ? 22 : 18;
  const ys = shape === 'not' ? [24] : [16, 32];
  let s = `<path class="lead" d="${ys.map((y) => `M0,${y}H${inX}`).join('')}M${inverted ? tip + 8 : tip},24H88"/>`;
  s += `<path class="body" d="${BODY[shape]}"/>`;
  if (type === 'xor' || type === 'xnor') s += '<path class="lead" d="M9,4Q23,24 9,44"/>';
  if (inverted) s += `<circle class="body" cx="${tip + 4}" cy="24" r="4"/>`;
  return s;
}

export class Editor {
  constructor(svg, { onChange }) {
    this.svg = svg;
    this.onChange = onChange;
    this.onStatus = null;
    this.locked = false;
    this.W = 960;
    this.H = 544;
    this.pins = [];
    this.parts = [];
    this.wires = [];
    this.inputs = {};
    this.undoStack = [];
    this.mem = newMem();
    this.pointer = { x: 0, y: 0 };
    this.view = { x: 0, y: 0, k: 1 }; // pan offset and zoom factor over the sheet
    svg.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.move(e));
    svg.addEventListener('pointerup', (e) => this.up(e));
    svg.addEventListener(
      'wheel',
      (e) => {
        if (!this.stage) return;
        e.preventDefault();
        // Normalise to pixels: Firefox mice report lines (about 3 per notch), rarely pages.
        const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1;
        const dy = Math.max(-240, Math.min(240, e.deltaY * unit));
        // Exponential in the delta, so many small trackpad events add up to the same
        // zoom as one mouse notch (~100px -> 1.2x). Pinch arrives as ctrl+wheel with
        // small deltas, so it gets a stronger rate.
        this.zoomBy(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
      },
      { passive: false },
    );
    svg.addEventListener('pointercancel', () => {
      this.drag = null;
      this.render();
    });
    new ResizeObserver(() => {
      if (this.stage && this.fit()) this.render();
    }).observe(svg);
  }

  // Match the coordinate space to the element's shape. Returns true if it changed.
  fit() {
    const r = this.svg.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return false;
    const aspect = r.width / r.height;
    // Large drawings ask for a bigger sheet (`zoom`), drawn at a smaller scale.
    const z = this.stage?.zoom || 1;
    let w = 544 * z * aspect;
    let h = 544 * z;
    if (w < 736 * z) {
      w = 736 * z;
      h = w / aspect;
    }
    w = Math.min(1600 * z, snap(w));
    h = Math.min(1200 * z, snap(h));
    if (w === this.W && h === this.H && this.svg.hasAttribute('viewBox')) return false;
    this.W = w;
    this.H = h;
    this.applyView();
    this.layoutPins();
    this.parts.forEach((n) => this.clamp(n));
    return true;
  }

  applyView() {
    const v = this.view;
    const w = this.W / v.k;
    const h = this.H / v.k;
    v.x = Math.min(this.W - w, Math.max(0, v.x));
    v.y = Math.min(this.H - h, Math.max(0, v.y));
    this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${w} ${h}`);
  }

  // Zoom about a client point, or the centre of the visible area when none is given.
  zoomBy(factor, clientX, clientY) {
    const v = this.view;
    const k = Math.min(8, Math.max(1, v.k * factor));
    if (k === v.k) return;
    const p = clientX === undefined ? { x: v.x + this.W / v.k / 2, y: v.y + this.H / v.k / 2 } : this.toSvg(clientX, clientY);
    // Keep that point where it is on screen.
    v.x = p.x - ((p.x - v.x) * v.k) / k;
    v.y = p.y - ((p.y - v.y) * v.k) / k;
    v.k = k;
    this.applyView();
    this.status();
  }

  resetView() {
    this.view = { x: 0, y: 0, k: 1 };
    this.applyView();
    this.status();
  }

  layoutPins() {
    const col = (type, x) => {
      const pins = this.pins.filter((p) => p.type === type);
      pins.forEach((p, i) => {
        p.x = x + (type === 'out' ? this.pinW - this.size(p).w : 0);
        p.y = snap((this.H * (i + 1)) / (pins.length + 1)) - PIN_H / 2;
      });
    };
    col('in', EDGE);
    col('out', this.W - EDGE - this.pinW);
  }

  load(stage, saved) {
    this.stage = stage;
    const pin = (type) => (name) => ({ id: `${type}:${name}`, type, name, x: 0, y: 0 });
    this.pins = [...stage.ins.map(pin('in')), ...stage.outs.map(pin('out'))];
    // Part types that no longer exist (an old save may hold CSRFILE, RESV or MUL32) are dropped,
    // and with them their wires (the ids filter below).
    this.parts = (saved?.nodes || []).filter((n) => PARTS[n.type]).map((n) => ({ ...n }));
    const ids = new Set([...this.pins, ...this.parts].map((n) => n.id));
    this.seq = 1;
    for (const n of this.parts) this.seq = Math.max(this.seq, +n.id.slice(1) + 1 || 1);
    this.wires = (saved?.wires || [])
      .filter((w) => ids.has(w.from[0]) && ids.has(w.to[0]))
      .map((w) => ({ id: 'w' + this.seq++, from: [...w.from], to: [...w.to] }));
    this.inputs = Object.fromEntries(stage.ins.map((n) => ['in:' + n, 0]));
    // Widest pin sets the margin; bus input pins cycle through their test values.
    this.pinW = stage.w ? BUS_PIN_W : PIN_W;
    this.cycles = {};
    stage.ins.forEach((n, i) => {
      if (stage.w?.[n] > 1) this.cycles['in:' + n] = [...new Set((stage.vec || stage.seq || []).map((row) => row[i]))];
    });
    this.note = '';
    this.undoStack = [];
    this.sel = null;
    this.drag = null;
    this.locked = false;
    this.mem = newMem();
    this.cursor = null; // row of a clocked test the sheet is showing, if any
    this.expect = null;
    this.view = { x: 0, y: 0, k: 1 };
    this.svg.removeAttribute('viewBox');
    this.fit();
    this.layoutPins();
    this.parts.forEach((n) => this.clamp(n));
    this.changed(false);
  }

  node(id) {
    return this.pins.find((n) => n.id === id) || this.parts.find((n) => n.id === id);
  }

  def(n) {
    if (n.type === 'in') return { ins: [], outs: [''] };
    if (n.type === 'out') return { ins: [''], outs: [] };
    return PARTS[n.type];
  }

  size(n) {
    if (n.type === 'in' || n.type === 'out') return { w: this.stage.w?.[n.name] > 1 ? BUS_PIN_W : PIN_W, h: PIN_H };
    const d = PARTS[n.type];
    if (d.sym) return { w: 88, h: 48 };
    return { w: 120, h: 16 * (Math.max(d.ins.length, d.outs.length, 2) + 1) };
  }

  // Terminals sit on a 16-unit pitch, centred on the part's side.
  portY(h, count, i) {
    return (h - 16 * (count + 1)) / 2 + 16 * (i + 1);
  }

  // Bit width of a terminal.
  portW(n, dir, i) {
    if (n.type === 'in' || n.type === 'out') return this.stage.w?.[n.name] || 1;
    return PARTS[n.type][dir === 'in' ? 'iw' : 'ow']?.[i] || 1;
  }

  portPos(n, dir, i) {
    const { w, h } = this.size(n);
    const count = this.def(n)[dir === 'in' ? 'ins' : 'outs'].length;
    return { x: n.x + (dir === 'in' ? 0 : w), y: n.y + this.portY(h, count, i) };
  }

  circuit() {
    return { nodes: [...this.pins, ...this.parts], wires: this.wires };
  }

  serialize() {
    return {
      nodes: this.parts.map(({ id, type, x, y }) => ({ id, type, x, y })),
      wires: this.wires.map(({ from, to }) => ({ from, to })),
    };
  }

  pushUndo() {
    this.undoStack.push(JSON.stringify({ parts: this.parts, wires: this.wires }));
    if (this.undoStack.length > 100) this.undoStack.shift();
  }

  undo() {
    const s = this.undoStack.pop();
    if (!s || this.locked) return;
    Object.assign(this, JSON.parse(s));
    this.sel = null;
    this.changed();
  }

  clear() {
    if (this.locked || !this.parts.length) return;
    this.pushUndo();
    this.parts = [];
    this.wires = [];
    this.sel = null;
    this.mem = newMem();
    sfx.del();
    this.changed();
  }

  addPart(type, x, y) {
    if (this.locked) return;
    this.pushUndo();
    const k = this.parts.length % 6;
    const n = { id: 'n' + this.seq++, type, x: x ?? 304 + k * 32, y: y ?? 80 + k * 48 };
    this.clamp(n);
    this.parts.push(n);
    this.sel = n.id;
    sfx.place();
    this.changed();
  }

  // Replace the sheet with a netlist ({ g, o }, see levels.js), laid out in
  // columns by logic depth. Feedback wires do not add depth.
  loadSolution(sol) {
    if (this.locked) return;
    this.pushUndo();
    const names = Object.keys(sol.g);
    const base = (sig) => sig.split('.')[0];
    const depth = {};
    const dep = (k) => {
      if (k in depth) return depth[k];
      depth[k] = 0;
      return (depth[k] = 1 + Math.max(0, ...sol.g[k].slice(1).map((x) => (sol.g[base(x)] ? dep(base(x)) : 0))));
    };
    const maxD = Math.max(...names.map(dep));
    // One column per depth, split in two or more when it is taller than the sheet.
    const byDepth = {};
    names.forEach((k) => (byDepth[dep(k)] ??= []).push(k));
    const cols = [];
    for (let d = 1; d <= maxD; d++) {
      let col = [];
      let tall = 0;
      for (const k of byDepth[d] || []) {
        const h = this.size({ type: sol.g[k][0] }).h + 32;
        if (col.length && tall + h > this.H - 112) {
          cols.push(col);
          col = [];
          tall = 0;
        }
        col.push(k);
        tall += h;
      }
      if (col.length) cols.push(col);
    }
    const colOf = {};
    cols.forEach((col, ci) => col.forEach((k) => (colOf[k] = ci)));
    const room = this.W - 2 * (EDGE + this.pinW + 40) - 120;
    const step = cols.length > 1 ? Math.max(152, Math.min(176, room / (cols.length - 1))) : 0;
    const x0 = (this.W - step * (cols.length - 1) - 104) / 2;
    // Stack each column's parts with an even gap, centred on the sheet.
    const colY = {};
    cols.forEach((col) => {
      const hs = col.map((k) => this.size({ type: sol.g[k][0] }).h);
      const sum = hs.reduce((a, c) => a + c, 0);
      const gap = col.length > 1 ? Math.max(16, Math.min(64, (this.H - 112 - sum) / (col.length - 1))) : 0;
      let y = (this.H - sum - gap * (col.length - 1)) / 2;
      col.forEach((k, i) => {
        colY[k] = y;
        y += hs[i] + gap;
      });
    });
    const ids = {};
    this.parts = names.map((k) => {
      const n = { id: (ids[k] = 'n' + this.seq++), type: sol.g[k][0], x: x0 + colOf[k] * step, y: colY[k] };
      this.clamp(n);
      return n;
    });
    const src = (sig) => (sol.g[base(sig)] ? [ids[base(sig)], +(sig.split('.')[1] || 0)] : ['in:' + sig, 0]);
    this.wires = [];
    const wire = (from, to) => this.wires.push({ id: 'w' + this.seq++, from, to });
    names.forEach((k) => sol.g[k].slice(1).forEach((sig, i) => wire(src(sig), [ids[k], i])));
    Object.entries(sol.o).forEach(([pin, sig]) => wire(src(sig), ['out:' + pin, 0]));
    this.sel = null;
    this.mem = newMem();
    sfx.place();
    this.changed();
  }

  deleteSelected() {
    if (this.locked || !this.sel) return;
    this.pushUndo();
    const id = this.sel;
    this.parts = this.parts.filter((n) => n.id !== id);
    this.wires = this.wires.filter((w) => w.id !== id && w.from[0] !== id && w.to[0] !== id);
    this.sel = null;
    sfx.del();
    this.changed();
  }

  setInputs(values) {
    this.stage.ins.forEach((n, i) => (this.inputs['in:' + n] = values[i]));
    this.changed(false);
  }

  // Power the circuit on and apply a list of input vectors in order, leaving
  // the sheet at the last one. `expect` is the expected output there.
  replay(steps, expect) {
    this.mem = newMem();
    steps.forEach((values, k) => {
      this.stage.ins.forEach((n, i) => (this.inputs['in:' + n] = values[i]));
      if (k < steps.length - 1) evaluate(this.circuit(), this.inputs, this.mem);
    });
    this.cursor = steps.length - 1;
    this.expect = expect;
    this.changed(false);
  }

  // Show a state computed elsewhere (a program run paused at instruction `cursor`).
  show(inputs, mem, cursor) {
    this.inputs = { ...inputs };
    this.mem = mem;
    this.cursor = cursor;
    this.expect = null;
    this.changed(false);
  }

  clamp(n) {
    const { w, h } = this.size(n);
    const lo = EDGE + this.pinW + 16;
    n.x = snap(Math.min(this.W - lo - w, Math.max(lo, n.x)));
    n.y = snap(Math.min(this.H - FRAME - 8 - h, Math.max(FRAME + 8, n.y)));
  }

  // `structural` is false when only input values changed.
  changed(structural = true) {
    this.sim = evaluate(this.circuit(), this.inputs, this.mem);
    this.render();
    this.onChange?.(structural);
  }

  toSvg(clientX, clientY) {
    const p = this.svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    return p.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  status() {
    const sel = this.parts.find((n) => n.id === this.sel);
    const wire = this.wires.find((w) => w.id === this.sel);
    let what = '-';
    if (sel) {
      const outs = PARTS[sel.type].outs.map((_, i) => hex(this.sim.vals[sel.id + ':' + i] || 0, this.portW(sel, 'out', i)));
      what = `${PARTS[sel.type].label} = ${outs.join(' ')}`;
    } else if (wire) {
      const src = this.node(wire.from[0]);
      what = `WIRE = ${hex(this.sim.vals[wire.from[0] + ':' + wire.from[1]] || 0, this.portW(src, 'out', wire.from[1]))}`;
    }
    this.onStatus?.(
      (this.note ? `!! ${this.note}   |   ` : '') +
      `X ${pad4(this.pointer.x)}  Y ${pad4(this.pointer.y)}   |   PARTS ${this.parts.length}  WIRES ${this.wires.length}   |   SEL ${what}   |   GRID ${GRID}   |   SHEET ${this.W}x${this.H}   |   ZOOM ${this.view.k.toFixed(1)}`,
    );
  }

  down(e) {
    if (this.locked) return;
    this.note = '';
    const p = this.toSvg(e.clientX, e.clientY);
    const port = e.target.closest('[data-port]');
    const nodeEl = e.target.closest('[data-node]');
    const wireEl = e.target.closest('[data-wire]');
    this.svg.setPointerCapture(e.pointerId);
    if (port) {
      const [id, dir, i] = port.dataset.port.split('|');
      // Grabbing a connected input picks the wire back up from its source.
      const existing = dir === 'in' && this.wires.find((w) => w.to[0] === id && w.to[1] === +i);
      if (existing) {
        this.pushUndo();
        this.wires = this.wires.filter((w) => w !== existing);
        this.drag = { kind: 'wire', from: { id: existing.from[0], dir: 'out', i: existing.from[1] }, p, saved: true };
        this.changed();
      } else {
        this.drag = { kind: 'wire', from: { id, dir, i: +i }, p };
        this.render();
      }
    } else if (nodeEl) {
      const n = this.node(nodeEl.dataset.node);
      if (n.type === 'in') this.drag = { kind: 'pin', id: n.id };
      else if (n.type !== 'out') {
        this.sel = n.id;
        this.drag = { kind: 'move', id: n.id, ox: p.x - n.x, oy: p.y - n.y, moved: false };
        this.render();
      }
    } else {
      this.sel = wireEl ? wireEl.dataset.wire : null;
      // Dragging the empty sheet pans it.
      if (!wireEl) this.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y, moved: false };
      else this.lastClick = null;
      this.render();
    }
  }

  move(e) {
    const p = this.toSvg(e.clientX, e.clientY);
    this.pointer = p;
    const d = this.drag;
    if (!d) return this.status();
    if (d.kind === 'pan') {
      if (Math.abs(e.clientX - d.sx) > 4 || Math.abs(e.clientY - d.sy) > 4) d.moved = true;
      const scale = this.W / this.view.k / this.svg.getBoundingClientRect().width;
      this.view.x = d.vx - (e.clientX - d.sx) * scale;
      this.view.y = d.vy - (e.clientY - d.sy) * scale;
      this.applyView();
      return;
    }
    if (d.kind === 'wire') {
      d.p = p;
      this.render();
    } else if (d.kind === 'move') {
      const n = this.node(d.id);
      const before = `${n.x},${n.y}`;
      const next = { ...n, x: p.x - d.ox, y: p.y - d.oy };
      this.clamp(next);
      if (`${next.x},${next.y}` === before) return this.status();
      if (!d.moved) this.pushUndo();
      d.moved = true;
      n.x = next.x;
      n.y = next.y;
      this.render();
    }
  }

  up(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    // Anything but a still click on the empty sheet breaks a double-click pair.
    if (d.kind !== 'pan' || d.moved) this.lastClick = null;
    if (d.kind === 'pan') {
      // render() rebuilds the sheet on every pointerdown, so the browser never sees a
      // dblclick; pair up still clicks on the empty sheet ourselves.
      if (d.moved) return;
      const c = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      const last = this.lastClick;
      if (last && c.t - last.t < 350 && Math.abs(c.x - last.x) <= 6 && Math.abs(c.y - last.y) <= 6) {
        this.lastClick = null; // a third click starts a new pair
        this.zoomBy(2, c.x, c.y);
      } else this.lastClick = c;
    } else if (d.kind === 'pin') {
      const cycle = this.cycles[d.id];
      if (cycle) this.inputs[d.id] = cycle[(cycle.indexOf(this.inputs[d.id]) + 1) % cycle.length] ?? 0;
      else this.inputs[d.id] ^= 1;
      this.cursor = null;
      this.expect = null;
      sfx.toggle();
      this.changed(false);
    } else if (d.kind === 'move') {
      if (d.moved) this.changed();
    } else if (d.kind === 'wire') {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-port]');
      if (el) {
        const [id, dir, i] = el.dataset.port.split('|');
        if (dir !== d.from.dir) {
          const a = d.from.dir === 'out' ? d.from : { id, i: +i };
          const c = d.from.dir === 'out' ? { id, i: +i } : d.from;
          const wa = this.portW(this.node(a.id), 'out', a.i);
          const wc = this.portW(this.node(c.id), 'in', c.i);
          if (wa !== wc) {
            this.note = `WIDTH MISMATCH: ${wa}-BIT OUTPUT TO ${wc}-BIT INPUT`;
            sfx.del();
          } else {
            if (!d.saved) this.pushUndo();
            this.wires = this.wires.filter((w) => !(w.to[0] === c.id && w.to[1] === c.i));
            this.wires.push({ id: 'w' + this.seq++, from: [a.id, a.i], to: [c.id, c.i] });
            sfx.connect();
          }
        }
      }
      this.changed();
    }
  }

  // Drawing border with zone references and a title block, as on a paper sheet.
  sheet() {
    const { W, H, stage: st } = this;
    const o = 8;
    const f = FRAME;
    const cols = Math.max(4, Math.round((W - 2 * f) / 128));
    const rows = Math.max(3, Math.round((H - 2 * f) / 128));
    let ticks = '';
    let labels = '';
    for (let i = 0; i < cols; i++) {
      const x0 = f + ((W - 2 * f) * i) / cols;
      const xc = x0 + (W - 2 * f) / cols / 2;
      if (i) ticks += `M${x0},${o}V${f}M${x0},${H - f}V${H - o}`;
      labels += `<text class="zone" x="${xc}" y="${f - 5}">${i + 1}</text><text class="zone" x="${xc}" y="${H - o - 5}">${i + 1}</text>`;
    }
    for (let i = 0; i < rows; i++) {
      const y0 = f + ((H - 2 * f) * i) / rows;
      const yc = y0 + (H - 2 * f) / rows / 2 + 3;
      const ch = String.fromCharCode(65 + i);
      if (i) ticks += `M${o},${y0}H${f}M${W - f},${y0}H${W - o}`;
      labels += `<text class="zone" x="${(o + f) / 2}" y="${yc}">${ch}</text><text class="zone" x="${W - (o + f) / 2}" y="${yc}">${ch}</text>`;
    }
    const bx = W - f - 336;
    const by = H - f - 40;
    return `<defs><pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><rect class="dot" width="1" height="1"/></pattern></defs>
      <rect x="${f}" y="${f}" width="${W - 2 * f}" height="${H - 2 * f}" fill="url(#grid)"/>
      <g class="sheet"><rect x="${o + 0.5}" y="${o + 0.5}" width="${W - 2 * o - 1}" height="${H - 2 * o - 1}"/>
      <rect x="${f + 0.5}" y="${f + 0.5}" width="${W - 2 * f - 1}" height="${H - 2 * f - 1}"/>
      <path d="${ticks}"/>${labels}
      <rect class="block" x="${bx + 0.5}" y="${by + 0.5}" width="336" height="40"/>
      <path d="M${bx},${by + 20.5}H${bx + 336}M${bx + 112.5},${by}V${by + 40}M${bx + 224.5},${by + 20}V${by + 40}"/>
      <text x="${bx + 8}" y="${by + 14}">NAND2RISCV</text><text x="${bx + 120}" y="${by + 14}">TITLE ${st.title}</text>
      <text x="${bx + 8}" y="${by + 34}">DWG ${st.num}</text><text x="${bx + 120}" y="${by + 34}">SHEET ${st.idx + 1}</text>
      <text x="${bx + 232}" y="${by + 34}">NAND ${nandCount(this.circuit())}</text></g>`;
  }

  render() {
    const { vals, drv, outs } = this.sim;
    const st = this.stage;
    const exp = st.fn ? st.fn(st.ins.map((n) => this.inputs['in:' + n])) : this.expect;
    let s = this.sheet();

    for (const w of this.wires) {
      const a = this.node(w.from[0]);
      const c = this.node(w.to[0]);
      if (!a || !c) continue;
      const path = curve(this.portPos(a, 'out', w.from[1]), this.portPos(c, 'in', w.to[1]));
      const cls =
        (vals[w.from[0] + ':' + w.from[1]] ? ' on' : '') + (this.sel === w.id ? ' sel' : '') + (this.portW(a, 'out', w.from[1]) > 1 ? ' bus' : '');
      s += `<path class="wire${cls}" d="${path}"/><path class="wire-hit" data-wire="${w.id}" d="${path}"/>`;
    }

    for (const n of this.pins) {
      const isIn = n.type === 'in';
      const v = isIn ? this.inputs[n.id] : outs[n.id];
      const want = isIn || !exp ? null : exp[st.outs.indexOf(n.name)];
      const judge = want == null ? '' : v === want ? ' ok' : ' ng';
      const pw = this.size(n).w;
      const bits = st.w?.[n.name] || 1;
      s += `<g class="pin ${n.type}${v ? ' on' : ''}${judge}${bits > 1 ? ' bus' : ''}" data-node="${n.id}" transform="translate(${n.x},${n.y})">
        <rect width="${pw}" height="${PIN_H}"/>
        <text class="pval" x="${pw / 2}" y="26">${bits > 1 ? hex(v, bits) : v}</text>
        <text class="pname" x="${pw / 2}" y="-6">${n.name}${bits > 1 ? ' /' + bits : ''}</text></g>`;
    }

    for (const n of this.parts) {
      const d = PARTS[n.type];
      const { w, h } = this.size(n);
      s += `<g class="part${this.sel === n.id ? ' sel' : ''}" data-node="${n.id}" transform="translate(${n.x},${n.y})">
        <rect class="grab" x="-4" y="-4" width="${w + 8}" height="${h + 8}"/>`;
      if (d.sym) s += symbol(n.type) + `<text class="ptag" x="${w / 2}" y="${h + 12}">${d.label}</text>`;
      else {
        s += `<rect class="body" width="${w}" height="${h}"/><text class="plabel" x="${w / 2}" y="${h / 2 + 4}">${d.label}</text>`;
        d.ins.forEach((nm, i) => (s += `<text class="portlbl" x="8" y="${this.portY(h, d.ins.length, i) + 3}">${nm}</text>`));
        d.outs.forEach((nm, i) => (s += `<text class="portlbl end" x="${w - 8}" y="${this.portY(h, d.outs.length, i) + 3}">${nm}</text>`));
      }
      s += '</g>';
    }

    for (const n of [...this.pins, ...this.parts]) {
      const d = this.def(n);
      const port = (dir, i, on) => {
        const p = this.portPos(n, dir, i);
        const r = this.portW(n, dir, i) > 1 ? 5 : 3;
        s += `<rect class="port${on ? ' on' : ''}" x="${p.x - r}" y="${p.y - r}" width="${2 * r}" height="${2 * r}"/><circle class="port-hit" data-port="${n.id}|${dir}|${i}" cx="${p.x}" cy="${p.y}" r="11"/>`;
      };
      d.ins.forEach((_, i) => port('in', i, vals[drv[n.id + ':' + i]]));
      d.outs.forEach((_, i) => port('out', i, vals[n.id + ':' + i]));
    }

    const d = this.drag;
    if (d?.kind === 'wire') {
      const a = this.portPos(this.node(d.from.id), d.from.dir, d.from.i);
      s += `<path class="wire ghost" d="${d.from.dir === 'out' ? curve(a, d.p) : curve(d.p, a)}"/>`;
    }
    this.svg.innerHTML = s;
    this.status();
  }
}

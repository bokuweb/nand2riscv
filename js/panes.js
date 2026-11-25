// Resizable side panels on the drawing sheet. Each boundary has a handle; the widths are
// --pane-left / --pane-right on .stage-cols, so css/style.css keeps the defaults and the
// narrow layouts (which do not use the variables) ignore them. Saved as state.panes, in px:
// `left` (specification), `right` (test panel), `wide` (test panel on a CPU drawing, which
// defaults wider). A missing field means the stylesheet default.

import { state, save } from './store.js';
import { tr } from './i18n.js';

const MIN = 200; // a side panel
const CENTRE = 320; // the sheet between them
const STEP = 16; // one arrow key

const $ = (s) => document.querySelector(s);
const cols = () => $('.stage-cols');
const pane = (side) => $(side === 'left' ? '.brief' : '.check');
const handle = (side) => $(`.pane-handle[data-side="${side}"]`);
// A handle is hidden (display: none) where the panels stack.
const shown = (side) => handle(side).offsetParent !== null;
const key = (side) => (side === 'left' ? 'left' : cols().classList.contains('wide') ? 'wide' : 'right');
const saved = (side) => {
  const v = state.panes?.[key(side)];
  return Number.isFinite(v) ? v : null;
};
const clamp = (v, hi) => Math.round(Math.max(MIN, Math.min(hi, v)));
const width = (side) => pane(side).getBoundingClientRect().width;
// The widest `side` may be with the other panel at its current width.
const maxFor = (side) => {
  const other = side === 'left' ? 'right' : 'left';
  return cols().clientWidth - CENTRE - (shown(other) ? width(other) : 0);
};

function setAria(side, px) {
  const h = handle(side);
  h.setAttribute('aria-valuenow', Math.round(px));
  h.setAttribute('aria-valuemax', Math.max(MIN, Math.round(maxFor(side))));
}

function setVar(side, px) {
  cols().style.setProperty(`--pane-${side}`, px + 'px');
  setAria(side, px);
}

function store(side, px) {
  state.panes = { ...state.panes, [key(side)]: px };
  save();
}

// Lay the panels out from the saved widths, clamped to the window as it is now. The saved
// values are kept, so a window that grows back gets them again.
export function applyPanes() {
  const el = cols();
  el.style.removeProperty('--pane-left');
  el.style.removeProperty('--pane-right');
  if (!el.clientWidth || !shown('right')) return;
  // Right first, against the left default; then the left against the result.
  for (const side of ['right', 'left']) {
    if (!shown(side)) continue;
    const v = saved(side);
    if (v == null) setAria(side, width(side));
    else setVar(side, clamp(v, maxFor(side)));
  }
  setAria('right', width('right')); // its maximum depends on the left panel just set
}

// Handle labels in the current language.
export function labelPanes() {
  for (const side of ['left', 'right']) {
    const h = handle(side);
    h.title = tr('ui.pane.hint', 'DRAG TO RESIZE. DOUBLE-CLICK RESETS.');
    h.setAttribute(
      'aria-label',
      side === 'left' ? tr('ui.pane.left', 'SPECIFICATION PANEL WIDTH') : tr('ui.pane.right', 'TEST PANEL WIDTH'),
    );
  }
}

// Dragging a boundary to the right widens the left panel and narrows the right one.
const signOf = (side) => (side === 'left' ? 1 : -1);

function bind(side) {
  const h = handle(side);
  h.setAttribute('aria-valuemin', MIN);
  h.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection, and keep focus where it was
    h.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const w0 = width(side);
    const hi = maxFor(side);
    let px = Math.round(w0);
    document.documentElement.classList.add('resizing');
    h.classList.add('drag');
    const move = (ev) => {
      px = clamp(w0 + signOf(side) * (ev.clientX - x0), hi);
      setVar(side, px);
    };
    // Saved once, at the end; a click without movement leaves the default alone.
    const end = () => {
      h.removeEventListener('pointermove', move);
      h.removeEventListener('pointerup', end);
      h.removeEventListener('pointercancel', end);
      document.documentElement.classList.remove('resizing');
      h.classList.remove('drag');
      if (px !== Math.round(w0)) store(side, px);
    };
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', end);
    h.addEventListener('pointercancel', end);
  });
  h.addEventListener('dblclick', () => {
    if (state.panes) {
      const { [key(side)]: _, ...rest } = state.panes;
      if (Object.keys(rest).length) state.panes = rest;
      else delete state.panes;
      save();
    }
    applyPanes();
  });
  h.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const px = clamp(width(side) + signOf(side) * dir * STEP, maxFor(side));
    setVar(side, px);
    store(side, px);
  });
}

export function initPanes() {
  bind('left');
  bind('right');
  labelPanes();
  addEventListener('resize', applyPanes);
}

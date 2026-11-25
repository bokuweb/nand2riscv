// Sound effects (WebAudio, no assets). Short plain tones only.

import { state } from './store.js';

let ctx;

function tone(freq, dur = 0.06, vol = 0.05, delay = 0) {
  if (state.muted) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    // Audio is optional.
  }
}

export const sfx = {
  toggle: () => tone(520, 0.04),
  place: () => tone(260, 0.05),
  connect: () => tone(780, 0.05),
  del: () => tone(140, 0.07),
  ready: () => tone(1040, 0.1),
  row: () => tone(660, 0.03, 0.04),
  pass: () => {
    tone(780, 0.09);
    tone(1040, 0.16, 0.05, 0.1);
  },
};

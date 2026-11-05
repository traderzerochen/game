// 事件音效。所有函数签名 (ctx, dest, noiseBuf, t, opts)
import { tone, noiseBurst } from './synth.js';
import { PENTA, pluck } from './ambient.js';

const P = (i) => PENTA[Math.max(0, Math.min(PENTA.length - 1, i))];

function thunder(ctx, d, nb, t, big = 1) {
  noiseBurst(ctx, d, nb, { t, dur: 0.9, gain: 0.32 * big, type: 'lowpass', freq: 1400, freqEnd: 120, attack: 0.01 });
  noiseBurst(ctx, d, nb, { t: t + 0.1, dur: 1.8, gain: 0.2 * big, type: 'lowpass', freq: 300, freqEnd: 60, attack: 0.15 });
  tone(ctx, d, { freq: 48, t, dur: 1.6, gain: 0.3 * big, attack: 0.02, slideTo: 30, slideAt: 0.1 });
}
function thud(ctx, d, nb, t) {
  tone(ctx, d, { freq: 90, t, dur: 0.5, gain: 0.3, attack: 0.005, slideTo: 45, slideAt: 0.05 });
  noiseBurst(ctx, d, nb, { t, dur: 0.25, gain: 0.12, type: 'lowpass', freq: 400 });
}
function bell(ctx, d, t, f = 196, gain = 0.2, dur = 5) {
  tone(ctx, d, { freq: f, t, dur, gain, attack: 0.003, partials: [[1, 1], [2, 0.5], [2.76, 0.3], [4.07, 0.15], [5.4, 0.08]] });
}
function arpeggio(ctx, d, nb, t, idxs, step = 0.14, gain = 0.15) {
  idxs.forEach((k, i) => pluck(ctx, d, nb, { freq: P(k), t: t + i * step, gain, dur: 2.2 }));
}
function motif(ctx, d, nb, t, idxs, step = 0.22, gain = 0.14) { arpeggio(ctx, d, nb, t, idxs, step, gain); }

export const SFX = {
  'breakthrough:success': (c, d, nb, t) => { bell(c, d, t, 174.6, 0.22, 6); bell(c, d, t + 0.02, 349.2, 0.08, 4); },
  'breakthrough:fail': (c, d, nb, t) => thud(c, d, nb, t),
  'tribulation:start': (c, d, nb, t) => {
    noiseBurst(c, d, nb, { t, dur: 3.5, gain: 0.22, type: 'lowpass', freq: 220, freqEnd: 90, attack: 1.2 });
    tone(c, d, { freq: 42, t, dur: 3.5, gain: 0.18, attack: 1.0 });
  },
  thunder: (c, d, nb, t, o = {}) => thunder(c, d, nb, t, o.big || 1),
  'tribulation:success': (c, d, nb, t) => arpeggio(c, d, nb, t, [0, 2, 4, 5, 7, 9], 0.16, 0.16),
  'tribulation:fail': (c, d, nb, t) => { thud(c, d, nb, t); motif(c, d, nb, t + 0.1, [4, 2, 0], 0.35, 0.1); },
  'battle:win': (c, d, nb, t) => motif(c, d, nb, t, [2, 4, 5, 7]),
  'battle:lose': (c, d, nb, t) => motif(c, d, nb, t, [5, 3, 2, 0], 0.3, 0.12),
  'alchemy:success': (c, d, nb, t) => {
    tone(c, d, { freq: 1568, t, dur: 2.4, gain: 0.1, partials: [[1, 1], [2.01, 0.4], [3, 0.2]] });
    tone(c, d, { freq: 2093, t: t + 0.12, dur: 2.0, gain: 0.07, partials: [[1, 1], [2.01, 0.3]] });
  },
  'alchemy:fail': (c, d, nb, t) => { thud(c, d, nb, t); noiseBurst(c, d, nb, { t, dur: 0.6, gain: 0.15, type: 'lowpass', freq: 900, freqEnd: 150 }); },
  item: (c, d, nb, t) => pluck(c, d, nb, { freq: P(5 + Math.floor(Math.random() * 4)), t, gain: 0.1, dur: 1.4 }),
  ending: (c, d, nb, t) => {
    let k = 4;
    for (let i = 0; i < 24; i++) {
      k = Math.max(0, Math.min(9, k + Math.round((Math.random() - 0.5) * 4)));
      pluck(c, d, nb, { freq: P(k), t: t + i * 0.7 + Math.random() * 0.1, gain: 0.14, dur: 3.5, glide: Math.random() < 0.15 ? 1.0595 : 0 });
    }
    bell(c, d, t + 17, 130.8, 0.14, 7);
  },
  sword: (c, d, nb, t) => {
    tone(c, d, { freq: 2400, t, dur: 2.2, gain: 0.07, attack: 0.002, partials: [[1, 1], [1.47, 0.5], [2.09, 0.35], [3.13, 0.2], [4.6, 0.1]] });
    tone(c, d, { freq: 1760, t: t + 0.01, dur: 1.6, gain: 0.05, attack: 0.002, partials: [[1, 1], [2.31, 0.4]] });
    noiseBurst(c, d, nb, { t, dur: 0.12, gain: 0.06, type: 'highpass', freq: 5000 });
  },
  click: (c, d, nb, t) => {
    tone(c, d, { freq: 420, t, dur: 0.14, gain: 0.18, attack: 0.002, slideTo: 300, slideAt: 0, partials: [[1, 1], [2.4, 0.3]] });
    noiseBurst(c, d, nb, { t, dur: 0.03, gain: 0.05, type: 'bandpass', freq: 1200, q: 2 });
  },
};

// 氛围：古琴拨弦随机五声旋律 + 风声
import { makeNoise, tone, noiseBurst } from './synth.js';

const BASE = 130.81; // C3
const SCALE = [0, 2, 4, 7, 9]; // C D E G A
export const PENTA = [];
for (let o = 0; o < 2; o++) for (const s of SCALE) PENTA.push(BASE * 2 * Math.pow(2, (s + o * 12) / 12)); // C4..A5

export function pluck(ctx, dest, noiseBuf, { freq, t = ctx.currentTime, gain = 0.18, dur = 3.2, glide = 0 }) {
  tone(ctx, dest, { freq, t, dur, gain, attack: 0.004, partials: [[1, 1], [2, 0.35], [3, 0.16]], slideTo: glide ? freq * glide : 0, slideAt: 0.15 });
  noiseBurst(ctx, dest, noiseBuf, { t, dur: 0.05, gain: gain * 0.5, type: 'bandpass', freq: freq * 3, q: 1.2 });
}

export function startAmbient(ctx, master, reverb) {
  const noiseBuf = makeNoise(ctx, 2, 'white');
  const bus = ctx.createGain();
  bus.gain.value = 0.8;
  const dry = ctx.createGain(); dry.gain.value = 0.45;
  bus.connect(dry); dry.connect(master);
  bus.connect(reverb); // 混响总输出由外部连接

  // 风声
  const wind = ctx.createBufferSource();
  wind.buffer = makeNoise(ctx, 6, 'pink'); wind.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.9;
  const wg = ctx.createGain(); wg.gain.value = 0.05;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 260;
  lfo.connect(lfoG); lfoG.connect(bp.frequency);
  const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11;
  const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.03;
  lfo2.connect(lfo2G); lfo2G.connect(wg.gain);
  wind.connect(bp); bp.connect(wg); wg.connect(master); wg.connect(reverb);
  wind.start(); lfo.start(); lfo2.start();

  // 旋律
  let timer = 0, idx = 5, stopped = false;
  const next = () => {
    if (stopped) return;
    const t = ctx.currentTime + 0.05;
    idx = Math.max(0, Math.min(PENTA.length - 1, idx + Math.round((Math.random() - 0.5) * 5)));
    const n = Math.random() < 0.25 ? 2 : 1; // 偶尔双音
    for (let i = 0; i < n; i++) {
      const k = Math.max(0, Math.min(PENTA.length - 1, idx + (i ? (Math.random() < 0.5 ? -2 : 2) : 0)));
      const glide = Math.random() < 0.2 ? (Math.random() < 0.5 ? 1.0595 : 0.9439) : 0; // 吟猱
      pluck(ctx, bus, noiseBuf, { freq: PENTA[k], t: t + i * 0.12, gain: 0.16, glide });
    }
    timer = setTimeout(next, 2200 + Math.random() * 3800);
  };
  timer = setTimeout(next, 600);

  return () => {
    stopped = true; clearTimeout(timer);
    for (const s of [wind, lfo, lfo2]) { try { s.stop(); } catch { /* ignore */ } }
    for (const n of [wind, bp, wg, lfo, lfoG, lfo2, lfo2G, bus, dry]) { try { n.disconnect(); } catch { /* ignore */ } }
  };
}

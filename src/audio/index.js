// 音频入口：WebAudio 实时合成，无任何音频文件
import { makeNoise, makeImpulse } from './synth.js';
import { startAmbient } from './ambient.js';
import { SFX } from './sfx.js';

const noop = () => {};
const NULL_AUDIO = { unlock: noop, setVolume: noop, setMuted: noop, play: noop, dispose: noop };

export function createAudio({ bus, getSettings } = {}) {
  const AC = typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext);
  if (!AC) return { ...NULL_AUDIO };

  let ctx = null, master = null, sfxBus = null, reverb = null, revGain = null, noiseBuf = null;
  let stopAmbient = null, disposed = false;
  const timers = new Set();
  const offs = [];
  const settings = () => { try { return getSettings?.() || {}; } catch { return {}; } };
  const vol = () => { const v = settings().volume; return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.6; };
  const level = () => (settings().muted ? 0 : vol());
  let curVol = null, curMuted = null;

  function applyGain() {
    if (!master) return;
    const target = curMuted === null ? level() : (curMuted ? 0 : curVol ?? vol());
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  }

  function later(ms, fn) {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id);
  }

  function play(name, opts = {}) {
    if (!ctx || disposed || !SFX[name]) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      SFX[name](ctx, sfxBus, noiseBuf, ctx.currentTime + 0.01, opts);
    } catch (e) { /* 音频失败不影响游戏 */ }
  }

  function unlock() {
    if (disposed) return;
    try {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      reverb = ctx.createConvolver();
      reverb.buffer = makeImpulse(ctx);
      revGain = ctx.createGain(); revGain.gain.value = 0.5;
      reverb.connect(revGain); revGain.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9;
      sfxBus.connect(master); sfxBus.connect(reverb);
      noiseBuf = makeNoise(ctx, 2, 'white');
      applyGain();
      stopAmbient = startAmbient(ctx, master, reverb);
    } catch (e) { ctx = null; }
  }

  function setVolume(v) { curVol = Math.max(0, Math.min(1, Number(v) || 0)); applyGain(); }
  function setMuted(b) { curMuted = !!b; applyGain(); }

  if (bus?.on) {
    const sub = (n, f) => { const off = bus.on(n, f); if (typeof off === 'function') offs.push(off); };
    sub('breakthrough', (p) => play(p?.success ? 'breakthrough:success' : 'breakthrough:fail'));
    sub('alchemy:done', (p) => play(p?.success ? 'alchemy:success' : 'alchemy:fail'));
    let lastItem = 0;
    sub('item:gained', () => { const n = Date.now(); if (n - lastItem > 300) { lastItem = n; play('item'); } });
    sub('ending', () => play('ending'));
  }

  function dispose() {
    disposed = true;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const off of offs) { try { off(); } catch { /* ignore */ } }
    try { stopAmbient?.(); } catch { /* ignore */ }
    try { ctx?.close(); } catch { /* ignore */ }
    ctx = null;
  }

  return { unlock, setVolume, setMuted, play, dispose };
}

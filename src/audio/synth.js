// 底层合成工具：噪声缓冲、混响冲激、一次性节点自动断开
export function makeNoise(ctx, seconds, type = 'white') {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (type === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

export function makeImpulse(ctx, seconds = 2.8, decay = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// 播放结束后断开所有节点
export function disposeOnEnd(src, nodes) {
  src.onended = () => {
    for (const n of nodes) { try { n.disconnect(); } catch { /* ignore */ } }
  };
}

// 衰减正弦（可带泛音）。partials: [[倍频, 增益], ...]
export function tone(ctx, dest, { freq, t = ctx.currentTime, dur = 1.5, gain = 0.2, attack = 0.005, partials = [[1, 1]], type = 'sine', slideTo = 0, slideAt = 0.3, detune = 0 }) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(gain, t + attack);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(dest);
  const nodes = [out];
  let last = null;
  for (const [m, g] of partials) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq * m, t);
    if (slideTo) {
      o.frequency.setValueAtTime(freq * m, t + dur * slideAt);
      o.frequency.exponentialRampToValueAtTime(slideTo * m, t + dur * Math.min(0.9, slideAt + 0.35));
    }
    if (detune) o.detune.value = detune;
    const pg = ctx.createGain();
    pg.gain.value = g / (1 + (m - 1) * 0.15);
    o.connect(pg); pg.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
    nodes.push(o, pg);
    last = o;
  }
  if (last) disposeOnEnd(last, nodes);
  return out;
}

// 噪声爆发（滤波）
export function noiseBurst(ctx, dest, noiseBuf, { t = ctx.currentTime, dur = 0.5, gain = 0.3, type = 'lowpass', freq = 800, freqEnd = 0, q = 0.7, attack = 0.005 }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  disposeOnEnd(s, [s, f, g]);
}

// 毛笔笔触 —— 变宽 + 飞白（ART_GUIDE §4）
import { PALETTE, withAlpha } from './palette.js';
import { seededRandom, noise1 } from './noise.js';

/**
 * 沿折线画一道毛笔笔触。
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<[number,number]>} pts  控制点
 * @param {{width?:number, ink?:string, dry?:number, seed?:number, taper?:number, alpha?:number}} opts
 *   dry：飞白程度 0–1；taper：起收笔尖细程度 0–1
 */
export function brushStroke(ctx, pts, { width = 6, ink = PALETTE.ink0, dry = 0.25, seed = 1, taper = 0.8, alpha = 1 } = {}) {
  if (!pts || pts.length < 2) return;
  const path = resample(pts, Math.max(1.5, width / 3));
  const n = path.length;
  const rand = seededRandom(seed);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 主笔：多段变宽
  for (let i = 1; i < n; i++) {
    const t = i / (n - 1);
    const press = pressure(t, taper) * (0.85 + 0.3 * noise1(seed, i * 0.15));
    ctx.strokeStyle = withAlphaAny(ink, alpha * (0.85 + 0.15 * noise1(seed + 7, i * 0.2)));
    ctx.lineWidth = Math.max(0.5, width * press);
    ctx.beginPath();
    ctx.moveTo(path[i - 1][0], path[i - 1][1]);
    ctx.lineTo(path[i][0], path[i][1]);
    ctx.stroke();
  }
  // 飞白：用宣纸色细线在笔触内部“擦”出缝隙
  if (dry > 0) {
    const bristles = Math.round(2 + dry * 6);
    ctx.strokeStyle = withAlphaAny(PALETTE.paper, 0.35 + dry * 0.4);
    for (let b = 0; b < bristles; b++) {
      const off = (rand() - 0.5) * width * 0.7;
      const start = Math.floor(n * (0.3 + rand() * 0.4));
      ctx.lineWidth = Math.max(0.4, width * 0.06 * (0.5 + rand()));
      ctx.beginPath();
      for (let i = start; i < n; i++) {
        const [x, y] = path[i];
        const [nx, ny] = normalAt(path, i);
        const p = i === start ? 'moveTo' : 'lineTo';
        ctx[p](x + nx * off, y + ny * off);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 起笔重、行笔稳、收笔尖 */
function pressure(t, taper) {
  const head = Math.min(1, t / 0.12);
  const tail = Math.min(1, (1 - t) / 0.35);
  return (1 - taper) + taper * Math.min(head, Math.sqrt(Math.max(0, tail)));
}

function resample(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const d = Math.hypot(x1 - x0, y1 - y0);
    const k = Math.max(1, Math.round(d / step));
    for (let j = 1; j <= k; j++) out.push([x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k]);
  }
  return out;
}

function normalAt(path, i) {
  const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}

function withAlphaAny(c, a) {
  if (c.startsWith('#')) return withAlpha(c, a);
  return c;
}

/** 墨点晕染：径向渐变圆，可叠加出墨晕 */
export function inkBlot(ctx, x, y, r, { ink = PALETTE.ink0, alpha = 0.5 } = {}) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlphaAny(ink, alpha));
  g.addColorStop(0.6, withAlphaAny(ink, alpha * 0.4));
  g.addColorStop(1, withAlphaAny(ink, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * SVG 版手绘抖动路径：把点列转为带种子抖动的平滑 path d 字符串（图标用）。
 */
export function jitterPath(pts, { seed = 1, amp = 0.8, closed = false } = {}) {
  const rand = seededRandom(seed);
  const p = pts.map(([x, y]) => [x + (rand() - 0.5) * 2 * amp, y + (rand() - 0.5) * 2 * amp]);
  if (p.length < 2) return '';
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i];
    d += ` Q${f(x0)} ${f(y0)} ${f((x0 + x1) / 2)} ${f((y0 + y1) / 2)}`;
  }
  const last = p[p.length - 1];
  d += ` L${f(last[0])} ${f(last[1])}`;
  if (closed) d += ' Z';
  return d;
}

const f = (v) => Math.round(v * 10) / 10;

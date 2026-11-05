// 场景元素生成器：云海、松、石、飞瀑、竹、殿阁、冰棱、水面（ART_GUIDE §4）
// 每类元素一个参数化函数，变体由 seed 派生。
import { PALETTE, withAlpha } from './palette.js';
import { seededRandom, noise1 } from './noise.js';
import { brushStroke, inkBlot } from './brush.js';

/** 云带：多个横向椭圆晕染叠成一条，水平周期为 width */
export function drawCloudBand(ctx, { seed = 1, width, y, thick = 40, alpha = 0.8, color = '#f8f3e8', count = 14 }) {
  const rand = seededRandom(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rand() * width;
    const rx = thick * (1.5 + rand() * 2.5);
    const ry = thick * (0.35 + rand() * 0.4);
    const cy = y + (rand() - 0.5) * thick * 0.8;
    for (const dx of [0, -width, width]) {
      if (x + dx + rx < 0 || x + dx - rx > width) continue;
      const g = ctx.createRadialGradient(x + dx, cy, 0, x + dx, cy, rx);
      g.addColorStop(0, withAlpha(color, alpha));
      g.addColorStop(0.6, withAlpha(color, alpha * 0.5));
      g.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + dx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** 松：弯曲主干 + 若干层水平松针团 */
export function drawPine(ctx, x, y, size, { seed = 1, ink = PALETTE.ink1, lean = null } = {}) {
  const rand = seededRandom(seed);
  const L = lean ?? (rand() - 0.5) * 0.8;
  const pts = [];
  const segs = 6;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push([x + Math.sin(t * 2.2 + seed) * size * 0.08 + L * t * size * 0.5, y - t * size]);
  }
  brushStroke(ctx, pts, { width: size * 0.06, ink, dry: 0.5, seed, taper: 0.5 });
  // 枝与松针团
  const tiers = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < tiers; i++) {
    const t = 0.35 + (i / tiers) * 0.65;
    const [bx, by] = pts[Math.round(t * segs)];
    const dir = i % 2 ? 1 : -1;
    const len = size * (0.45 - t * 0.25) * (0.7 + rand() * 0.6);
    const ex = bx + dir * len, ey = by - len * 0.15;
    brushStroke(ctx, [[bx, by], [(bx + ex) / 2, by - len * 0.05], [ex, ey]], { width: size * 0.025, ink, dry: 0.3, seed: seed + i });
    needleCluster(ctx, ex, ey, len * 0.55, ink, seed + i * 7);
    needleCluster(ctx, (bx + ex) / 2, by - len * 0.1, len * 0.4, ink, seed + i * 13);
  }
  needleCluster(ctx, pts[segs][0], pts[segs][1], size * 0.18, ink, seed + 99);
}

function needleCluster(ctx, cx, cy, r, ink, seed) {
  const rand = seededRandom(seed);
  ctx.save();
  ctx.fillStyle = withAlpha(ink, 0.85);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.32, (rand() - 0.5) * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(ink, 0.9);
  ctx.lineWidth = Math.max(0.6, r * 0.04);
  const n = 10 + Math.floor(r / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const rr = r * (0.9 + rand() * 0.35);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

/** 石：不规则多边形 + 皴笔 + 留白高光 */
export function drawRock(ctx, x, y, size, { seed = 1, ink = PALETTE.ink1, flat = 0.6 } = {}) {
  const rand = seededRandom(seed);
  const n = 7 + Math.floor(rand() * 4);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI; // 上半圆
    const r = size * (0.6 + rand() * 0.5);
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * flat]);
  }
  ctx.save();
  const g = ctx.createLinearGradient(x - size, y - size * flat, x + size, y);
  g.addColorStop(0, withAlpha(ink, 0.25));
  g.addColorStop(0.6, withAlpha(ink, 0.7));
  g.addColorStop(1, withAlpha(ink, 0.9));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], y);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(pts[pts.length - 1][0], y);
  ctx.closePath();
  ctx.fill();
  brushStroke(ctx, pts, { width: Math.max(1.5, size * 0.05), ink, dry: 0.6, seed, taper: 0.4 });
  // 皴笔
  for (let i = 0; i < 4 + size / 12; i++) {
    const px = x + (rand() - 0.5) * size * 1.2;
    const py = y - rand() * size * flat * 0.8;
    brushStroke(ctx, [[px, py], [px + size * 0.12, py + size * 0.15]], { width: Math.max(1, size * 0.025), ink, dry: 0.4, seed: seed + i, alpha: 0.6 });
  }
  ctx.restore();
}

/** 竹：分节竿 + 竹叶 */
export function drawBamboo(ctx, x, y, h, { seed = 1, ink = PALETTE.ink1 } = {}) {
  const rand = seededRandom(seed);
  const w = Math.max(2, h * 0.022);
  const segs = 5 + Math.floor(rand() * 3);
  const bend = (rand() - 0.5) * h * 0.08;
  let px = x, py = y;
  for (let i = 0; i < segs; i++) {
    const t1 = (i + 1) / segs;
    const nx = x + bend * t1 * t1, ny = y - h * t1;
    brushStroke(ctx, [[px, py - 2], [nx, ny + 2]], { width: w, ink, dry: 0.25, seed: seed + i, taper: 0.15 });
    ctx.fillStyle = ink;
    ctx.fillRect(nx - w * 0.8, ny - 1, w * 1.6, 2);
    if (i > segs / 2 && rand() < 0.7) {
      const dir = rand() < 0.5 ? -1 : 1;
      for (let k = 0; k < 3; k++) leaf(ctx, nx, ny, h * (0.09 + rand() * 0.05), dir * (0.4 + k * 0.35 + rand() * 0.2), ink, seed + i * 10 + k);
    }
    px = nx; py = ny;
  }
}

function leaf(ctx, x, y, len, ang, ink, seed) {
  const ex = x + Math.cos(ang) * len * Math.sign(Math.cos(ang) || 1), ey = y + Math.abs(Math.sin(ang)) * len * 0.6;
  brushStroke(ctx, [[x, y], [(x + ex) / 2, (y + ey) / 2 - len * 0.05], [ex, ey]], { width: len * 0.16, ink, dry: 0.1, seed, taper: 0.95 });
}

/** 飞瀑：静态岩壁间的留白水带；动画由 drawWaterfallFlow 每帧叠加 */
export function drawWaterfallFlow(ctx, x, y, w, h, t, { alpha = 0.7, seed = 3 } = {}) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, withAlpha('#f8f5ee', alpha));
  g.addColorStop(1, withAlpha('#f8f5ee', alpha * 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.strokeStyle = withAlpha(PALETTE.ink3, 0.45);
  ctx.lineWidth = 1;
  const n = Math.max(3, Math.round(w / 5));
  for (let i = 0; i < n; i++) {
    const lx = x - w / 2 + ((i + 0.5) / n) * w;
    const off = ((t * 90 + noise1(seed, i) * h) % h);
    const len = h * (0.12 + noise1(seed + 1, i) * 0.2);
    ctx.beginPath();
    ctx.moveTo(lx, y + off);
    ctx.lineTo(lx, Math.min(y + h, y + off + len));
    ctx.stroke();
  }
  // 潭口水雾
  inkBlot(ctx, x, y + h, w * 1.4, { ink: '#fbf8f1', alpha: alpha * 0.8 });
  ctx.restore();
}

/** 殿阁：重檐歇山顶剪影（钟鸣殿、远处道观） */
export function drawPavilion(ctx, x, y, size, { seed = 1, ink = PALETTE.ink1, tiers = 2, bell = false } = {}) {
  const rand = seededRandom(seed);
  ctx.save();
  ctx.fillStyle = ink;
  let cy = y;
  const baseW = size;
  ctx.fillRect(x - baseW * 0.55, cy - size * 0.08, baseW * 1.1, size * 0.08); // 台基
  cy -= size * 0.08;
  for (let i = 0; i < tiers; i++) {
    const s = 1 - i * 0.28;
    const bodyH = size * 0.28 * s;
    const bw = baseW * 0.7 * s;
    ctx.fillStyle = withAlpha(ink, 0.85);
    ctx.fillRect(x - bw / 2, cy - bodyH, bw, bodyH);
    // 柱间留白（门窗）
    ctx.fillStyle = withAlpha(PALETTE.paper, 0.35);
    const cols = 3;
    for (let c = 0; c < cols; c++) ctx.fillRect(x - bw / 2 + bw * (0.12 + c * 0.3), cy - bodyH * 0.8, bw * 0.16, bodyH * 0.7);
    cy -= bodyH;
    // 屋檐：上翘曲线
    const rw = bw * 1.45, rh = size * 0.16 * s;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x - rw / 2 - rw * 0.06, cy - rh * 0.35);
    ctx.quadraticCurveTo(x - rw * 0.3, cy + rh * 0.05, x - rw * 0.2, cy - rh * 0.6);
    ctx.lineTo(x, cy - rh * 1.1);
    ctx.lineTo(x + rw * 0.2, cy - rh * 0.6);
    ctx.quadraticCurveTo(x + rw * 0.3, cy + rh * 0.05, x + rw / 2 + rw * 0.06, cy - rh * 0.35);
    ctx.lineTo(x + rw * 0.35, cy);
    ctx.lineTo(x - rw * 0.35, cy);
    ctx.closePath();
    ctx.fill();
    cy -= rh * 0.9;
  }
  if (bell) {
    ctx.fillStyle = withAlpha(PALETTE.ochre, 0.9);
    const by = y - size * 0.2;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.07, by);
    ctx.quadraticCurveTo(x - size * 0.07, by - size * 0.14, x, by - size * 0.15);
    ctx.quadraticCurveTo(x + size * 0.07, by - size * 0.14, x + size * 0.07, by);
    ctx.closePath();
    ctx.fill();
  }
  // 宝顶
  ctx.fillStyle = ink;
  ctx.fillRect(x - 1.5, cy - size * 0.08 - rand() * 2, 3, size * 0.08);
  ctx.restore();
}

/** 冰棱 / 钟乳：自上而下的尖锥，用于洞窟顶 */
export function drawStalactites(ctx, { seed = 1, width, y = 0, maxLen = 80, ink = PALETTE.ink1, count = 24 }) {
  const rand = seededRandom(seed);
  ctx.save();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(0, y);
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * width;
    const len = maxLen * (0.15 + Math.pow(rand(), 2) * 0.85);
    const w = width / count;
    ctx.lineTo(x - w * 0.35, y + len * 0.15);
    ctx.lineTo(x, y + len);
    ctx.lineTo(x + w * 0.35, y + len * 0.15);
  }
  ctx.lineTo(width, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 水面：横向淡墨波纹 + 倒影留白 */
export function drawWater(ctx, { seed = 1, width, y, h, ink = PALETTE.azurite, alpha = 0.25 }) {
  const rand = seededRandom(seed);
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, withAlpha(ink, alpha * 0.4));
  g.addColorStop(1, withAlpha(ink, alpha));
  ctx.fillStyle = g;
  ctx.fillRect(0, y, width, h);
  ctx.strokeStyle = withAlpha(PALETTE.ink2, 0.35);
  for (let i = 0; i < 30; i++) {
    const yy = y + Math.pow(rand(), 0.7) * h;
    const x = rand() * width;
    const len = 20 + rand() * 80 * (yy - y) / h;
    ctx.lineWidth = 0.6 + rand();
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + len, yy + (rand() - 0.5) * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** 枯枝 / 藤：随机分叉折线（赤岩峡枯树、雾栖谷藤蔓） */
export function drawDeadTree(ctx, x, y, size, { seed = 1, ink = PALETTE.ink1, depth = 4 } = {}) {
  const rand = seededRandom(seed);
  const branch = (bx, by, ang, len, w, d) => {
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    brushStroke(ctx, [[bx, by], [(bx + ex) / 2 + (rand() - 0.5) * len * 0.2, (by + ey) / 2], [ex, ey]], { width: w, ink, dry: 0.5, seed: seed + d * 17 + Math.round(len), taper: 0.6 });
    if (d <= 0) return;
    const k = 2 + (rand() < 0.3 ? 1 : 0);
    for (let i = 0; i < k; i++) branch(ex, ey, ang + (rand() - 0.5) * 1.3, len * (0.55 + rand() * 0.2), w * 0.6, d - 1);
  };
  branch(x, y, -Math.PI / 2 + (rand() - 0.5) * 0.3, size * 0.4, size * 0.05, depth);
}

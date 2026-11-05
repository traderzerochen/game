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
  const n = 6 + Math.floor(rand() * 3);
  const pts = [];
  const lean = (rand() - 0.5) * 0.5;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const a = Math.PI + u * Math.PI; // 上半圆
    const r = size * (0.78 + rand() * 0.3) * (1 - 0.15 * Math.abs(u - 0.5));
    pts.push([x + Math.cos(a) * r + lean * size * Math.sin(u * Math.PI), y + Math.sin(a) * r * flat]);
  }
  pts[0][1] = y; pts[n - 1][1] = y;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  };
  ctx.save();
  // 体积：受光面（左上）留白，背光面（右下）积墨
  const g = ctx.createLinearGradient(x - size * 0.8, y - size * flat, x + size * 0.6, y);
  g.addColorStop(0, withAlpha(ink, 0.12));
  g.addColorStop(0.5, withAlpha(ink, 0.55));
  g.addColorStop(1, withAlpha(ink, 0.92));
  ctx.fillStyle = g;
  path();
  ctx.closePath();
  ctx.fill();
  // 轮廓：只勾上沿
  ctx.strokeStyle = withAlpha(ink, 0.95);
  ctx.lineWidth = Math.max(1.2, size * 0.035);
  ctx.lineJoin = 'round';
  path();
  ctx.stroke();
  // 皴笔：沿山石走向的短笔
  for (let i = 0; i < 3 + size / 14; i++) {
    const k = 1 + Math.floor(rand() * (n - 2));
    const [px, py] = pts[k];
    const tx = px + (x - px) * (0.2 + rand() * 0.5), ty = py + (y - py) * (0.3 + rand() * 0.5);
    brushStroke(ctx, [[px + (rand() - 0.5) * 6, py + 3], [tx, ty]], { width: Math.max(1, size * 0.03), ink, dry: 0.5, seed: seed + i, alpha: 0.55 });
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
  const g = ctx.createLinearGradient(0, y, 0, y + maxLen);
  g.addColorStop(0, withAlpha(ink, 0.95));
  g.addColorStop(1, withAlpha(ink, 0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, y);
  let x = 0;
  while (x < width) {
    const w = (width / count) * (0.5 + rand() * 1.2);
    const len = maxLen * (0.08 + Math.pow(rand(), 2.2) * 0.92);
    const tip = x + w * (0.35 + rand() * 0.3);
    ctx.lineTo(x + w * 0.1, y + len * 0.12);
    ctx.quadraticCurveTo(tip - w * 0.15, y + len * 0.6, tip, y + len);
    ctx.quadraticCurveTo(tip + w * 0.12, y + len * 0.5, x + w * 0.9, y + len * 0.1);
    x += w;
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

/** 丹炉（三足鼎）：鼎身、双耳、炉盖；heat 0–1 控制炉身透出的火色，t 让炉盖轻颤 */
export function drawFurnace(ctx, x, y, size, { t = 0, heat = 0, ink = PALETTE.ink1, seed = 9 } = {}) {
  const s = size;
  const jig = heat > 0.6 ? Math.sin(t * 40) * s * 0.008 * heat : 0;
  ctx.save();
  // 足
  ctx.fillStyle = ink;
  for (const dx of [-0.32, 0, 0.32]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * s - s * 0.04, y - s * 0.22);
    ctx.lineTo(x + dx * s + s * 0.04, y - s * 0.22);
    ctx.lineTo(x + dx * s * 1.15 + s * 0.02, y);
    ctx.lineTo(x + dx * s * 1.15 - s * 0.03, y);
    ctx.closePath();
    ctx.fill();
  }
  // 鼎身
  const g = ctx.createRadialGradient(x, y - s * 0.4, s * 0.05, x, y - s * 0.4, s * 0.5);
  g.addColorStop(0, heat > 0 ? withAlpha(PALETTE.cinnabar, 0.25 + 0.6 * heat) : withAlpha(PALETTE.ink2, 0.9));
  g.addColorStop(1, ink);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.42, y - s * 0.62);
  ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.2, x, y - s * 0.18);
  ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.2, x + s * 0.42, y - s * 0.62);
  ctx.closePath();
  ctx.fill();
  brushStroke(ctx, [[x - s * 0.44, y - s * 0.62], [x + s * 0.44, y - s * 0.62]], { width: s * 0.05, ink, seed, dry: 0.2, taper: 0.2 });
  // 纹饰（云雷纹带）
  ctx.strokeStyle = withAlpha(PALETTE.gamboge, 0.55);
  ctx.lineWidth = Math.max(1, s * 0.012);
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const px = x - s * 0.34 + (i / 8) * s * 0.68, py = y - s * 0.5;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py + (i % 2 ? -s * 0.03 : 0));
  }
  ctx.stroke();
  // 双耳
  ctx.strokeStyle = ink;
  ctx.lineWidth = s * 0.035;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * s * 0.3, y - s * 0.62);
    ctx.lineTo(x + sx * s * 0.3, y - s * 0.76);
    ctx.lineTo(x + sx * s * 0.2, y - s * 0.76);
    ctx.lineTo(x + sx * s * 0.2, y - s * 0.64);
    ctx.stroke();
  }
  // 炉盖与宝珠
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.66 + jig, s * 0.36, s * 0.07, 0, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - s * 0.75 + jig, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

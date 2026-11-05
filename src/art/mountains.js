// 远山层生成器 —— fbm 山脊 + 墨色晕染 + 底部渐隐（ART_GUIDE §4、§5）
import { PALETTE, withAlpha } from './palette.js';
import { fbm, noise1, seededRandom } from './noise.js';

/**
 * 计算一条水平周期为 width 的山脊线（首尾相接，便于横向平铺）。
 * @returns {Float32Array} 每个采样点的 y
 */
export function ridgeLine({ seed = 1, width, samples = 200, y, height, peaks = 3, sharp = 1.4, octaves = 5 }) {
  const out = new Float32Array(samples + 1);
  const P = peaks; // 噪声周期
  for (let k = 0; k <= samples; k++) {
    const u = (k / samples) * P;
    const a = fbm(seed, u, undefined, { octaves });
    const b = fbm(seed, u - P, undefined, { octaves }); // w=1 时等于 k=0 处取值 → 首尾相接
    const w = k / samples;
    let v = a * (1 - w) + b * w;
    v = Math.pow(Math.max(0, Math.min(1, (v - 0.25) / 0.6)), sharp);
    out[k] = y - v * height;
  }
  return out;
}

/**
 * 在 ctx 上绘制一层远山。
 * opts: {seed, width, y(山脚基线), height(最大起伏), ink, blur(px), alpha, peaks, sharp, texture(0–1 皴笔密度), fade(底部渐隐比例)}
 */
export function drawMountainLayer(ctx, opts) {
  const {
    seed = 1, width = ctx.canvas.width, y, height, ink = PALETTE.ink3, blur = 0, alpha = 1,
    peaks = 3, sharp = 1.4, texture = 0.3, fade = 0.9, total = ctx.canvas.height,
  } = opts;
  const samples = Math.max(60, Math.round(width / 6));
  const ridge = ridgeLine({ seed, width, samples, y, height, peaks, sharp });
  const top = Math.min(...ridge);
  const bottom = Math.min(total, y + (total - y) * fade + height * 0.2);
  ctx.save();
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  // 山体：墨色由山脊向下变淡（“上浓下淡”）
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, withAlpha(ink, alpha));
  g.addColorStop(0.35, withAlpha(ink, alpha * 0.75));
  g.addColorStop(1, withAlpha(ink, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let k = 0; k <= samples; k++) ctx.lineTo((k / samples) * width, ridge[k]);
  ctx.lineTo(width, bottom);
  ctx.closePath();
  ctx.fill();
  // 山脊勾勒：沿脊线的浓墨细线（断续，模拟笔断意连）
  ctx.strokeStyle = withAlpha(ink, Math.min(1, alpha * 1.1));
  ctx.lineCap = 'round';
  for (let k = 1; k <= samples; k++) {
    const n = noise1(seed + 31, k * 0.08);
    if (n < 0.35) continue;
    ctx.lineWidth = 0.6 + n * 1.6;
    ctx.beginPath();
    ctx.moveTo(((k - 1) / samples) * width, ridge[k - 1]);
    ctx.lineTo((k / samples) * width, ridge[k]);
    ctx.stroke();
  }
  // 皴笔：自山脊向下的短斜笔，密度由 texture 控制
  if (texture > 0) {
    const rand = seededRandom(seed + 77);
    const n = Math.round(samples * texture * 0.8);
    for (let i = 0; i < n; i++) {
      const k = Math.floor(rand() * samples);
      const x = (k / samples) * width;
      const y0 = ridge[k] + rand() * 6;
      const len = 8 + rand() * height * 0.35;
      ctx.strokeStyle = withAlpha(ink, alpha * (0.15 + rand() * 0.25));
      ctx.lineWidth = 0.6 + rand() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(x + (rand() - 0.5) * 8, y0 + len * 0.5, x + (rand() - 0.6) * 10, y0 + len);
      ctx.stroke();
    }
  }
  ctx.restore();
  return ridge;
}

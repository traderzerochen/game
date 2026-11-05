// 角色与敌人剪影 —— 水墨剪影生成器（ART_GUIDE §4）
//
// 设计：每个原型是一个「参数 → 形状列表」的小函数，比例、姿态、飘动由少量参数与种子抖动驱动；
// 形状列表（墨块 / 毛笔笔触 / 细线 / 点睛 / 墨晕）再交给两个渲染器：Canvas（drawSilhouette）与 SVG（silhouetteSVG），
// 两者输出同一造型。
//
// 模型坐标：原点在脚底中心，向上为负，身高约 100 单位；正面朝 +x（facing=1 朝右，-1 朝左）。
// SVG 版 viewBox 0 0 128 160，脚底中心位于 (64,150)，模型放大 1.15 倍。
import { PALETTE, elementColor, mix } from './palette.js';
import { seededRandom, hashSeed, noise1 } from './noise.js';

const TAU = Math.PI * 2;
const PAPER = PALETTE.paper;
const VB_W = 128, VB_H = 160, VB_GX = 64, VB_GY = 150, VB_S = 1.15;

export const ARCHETYPES = ['humanoid', 'wolf', 'spider', 'puppet', 'toad', 'snake', 'golem', 'bird', 'beast', 'vine', 'wraith', 'jiao'];
export const HUMANOID_VARIANTS = ['male', 'female', 'sword', 'alchemist', 'talisman', 'wanderer', 'meditate'];
/** 每个原型可用的 variant（首项为默认） */
export const VARIANTS = Object.freeze({
  humanoid: HUMANOID_VARIANTS,
  spider: ['spider', 'scorpion'],
  bird: ['crow', 'bat'],
  beast: ['qilin', 'turtle'],
  puppet: ['wood', 'sword'],
  wraith: ['demon', 'mist'],
});
export const POSES = ['idle', 'attack', 'cast', 'hurt'];

// ---------------------------------------------------------------- 几何基元

const cr = (a, b, c, d, t, t2, t3) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);

/** Catmull-Rom 加密：控制点 → 平滑折线 */
function spline(pts, closed = false) {
  const n = pts.length;
  if (n < 3) return pts.map((p) => [p[0], p[1]]);
  const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const steps = Math.max(2, Math.min(10, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2.5)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([cr(p0[0], p1[0], p2[0], p3[0], t, t2, t3), cr(p0[1], p1[1], p2[1], p3[1], t, t2, t3)]);
    }
  }
  if (!closed) out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}

/**
 * 毛笔笔触几何：中心线 → 变宽带状多边形。
 * 压力曲线：起笔在 head 比例内压下，收笔在 tail 比例内提起；taper 控制两端尖细程度。
 */
function ribbon(pts, w, { w1 = w, head = 0.12, tail = 0.35, taper = 0.85, seed = 1, wobble = 0.25 } = {}) {
  const c = spline(pts, false);
  const n = c.length;
  const acc = [0];
  for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
  const total = acc[n - 1] || 1;
  const L = [], R = [], hw = [], nm = [];
  for (let i = 0; i < n; i++) {
    const t = acc[i] / total;
    const hd = head > 0 ? Math.min(1, t / head) : 1;
    const tl = tail > 0 ? Math.sqrt(Math.max(0, Math.min(1, (1 - t) / tail))) : 1;
    const p = 1 - taper + taper * Math.min(hd, tl);
    const h = ((w + (w1 - w) * t) * p * (1 - wobble / 2 + wobble * noise1(seed, acc[i] * 0.12))) / 2;
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    L.push([c[i][0] - dy * h, c[i][1] + dx * h]);
    R.push([c[i][0] + dy * h, c[i][1] - dx * h]);
    hw.push(h);
    nm.push([-dy, dx]);
  }
  return { poly: L.concat(R.slice().reverse()), c, hw, nm, L };
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rotAbout = (p, a, o = [0, 0]) => {
  const x = p[0] - o[0], y = p[1] - o[1], c = Math.cos(a), s = Math.sin(a);
  return [o[0] + x * c - y * s, o[1] + x * s + y * c];
};
const circlePts = (cx, cy, r, n = 12) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r]);

// ---------------------------------------------------------------- 画稿：收集形状

class Sketch {
  constructor(seed, o) {
    this.seed = hashSeed(seed);
    this.r = seededRandom(this.seed);
    this.ink = o.ink;
    this.acc = o.accent;
    this.t = o.t;
    this.list = [];
    this.k = 0;
  }
  /** 种子抖动：base ± amt */
  v(base, amt) { return base + (this.r() * 2 - 1) * amt; }
  /** 飘动：随时间 t 的正弦 */
  fl(ph, sp = 1.7) { return Math.sin(this.t * sp + ph); }
  /** 带抖动的椭圆控制点（墨块轮廓） */
  oval(cx, cy, rx, ry, rot = 0, n = 10, jit = 0.06) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, k = 1 + (this.r() * 2 - 1) * jit;
      pts.push(rotAbout([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k], rot, [cx, cy]));
    }
    return pts;
  }
  /** 平滑墨块；grad=[上端浓度, 下端浓度] 做竖向晕染 */
  blob(pts, o = {}) { this.list.push({ k: 'fill', pts: spline(pts, true), c: o.c || this.ink, a: o.a ?? 1, grad: o.grad, nb: o.nb }); }
  /** 折线墨块（棱角，如岩石、木块） */
  poly(pts, o = {}) { this.list.push({ k: 'fill', pts: pts.map((p) => [p[0], p[1]]), c: o.c || this.ink, a: o.a ?? 1, grad: o.grad, nb: o.nb }); }
  /** 毛笔笔触：变宽 + 飞白（宣纸色细丝） */
  brush(pts, w, o = {}) {
    const seed = (this.seed + ++this.k * 7919) >>> 0;
    const g = ribbon(pts, w, { ...o, seed });
    this.list.push({ k: 'fill', pts: g.poly, c: o.c || this.ink, a: o.a ?? 1, nb: o.nb });
    const dry = o.dry ?? 0.3;
    if (dry > 0 && w >= 3.2) {
      const rr = seededRandom(seed);
      const n = g.c.length, cnt = Math.round(1 + dry * 4);
      for (let b = 0; b < cnt; b++) {
        const off = (rr() - 0.5) * 1.3;
        const s = Math.floor(n * (0.2 + rr() * 0.45)), e = n - 1 - Math.floor(n * 0.08 * rr());
        const line = [];
        for (let i = s; i <= e; i++) line.push([g.c[i][0] + g.nm[i][0] * g.hw[i] * off, g.c[i][1] + g.nm[i][1] * g.hw[i] * off]);
        if (line.length > 1) this.list.push({ k: 'line', pts: line, c: PAPER, a: 0.22 + dry * 0.4, w: Math.max(0.3, w * 0.06 * (0.6 + rr())), nb: true });
      }
    }
    if (o.edge) this.list.push({ k: 'line', pts: g.L.slice(2, -2), c: PAPER, a: o.edge, w: 0.6, nb: true });
    return g;
  }
  /** 等宽细线（衣纹留白、傀儡丝、舌信） */
  line(pts, w, o = {}) { this.list.push({ k: 'line', pts: o.raw ? pts.map((p) => [p[0], p[1]]) : spline(pts, !!o.closed), c: o.c || this.ink, a: o.a ?? 1, w, closed: !!o.closed, nb: o.nb ?? (o.c === PAPER) }); }
  /** 点睛：点缀色圆点，glow 时带柔光晕 */
  dot(x, y, r, o = {}) { this.list.push({ k: 'dot', x, y, r, c: o.c || this.acc, a: o.a ?? 1, glow: !!o.glow }); }
  ell(x, y, rx, ry, o = {}) { this.list.push({ k: 'ell', x, y, rx, ry, rot: o.rot || 0, c: o.c || this.ink, a: o.a ?? 1 }); }
  /** 墨晕（径向渐隐），用于地面墨影、寒雾、火息 */
  wash(x, y, rx, ry, o = {}) { this.list.push({ k: 'wash', x, y, rx, ry, c: o.c || PALETTE.ink0, a: o.a ?? 0.2, nb: true }); }
}

/** 在折线相邻点之间插入左右交替偏移的中点 → 毛发、草叶般的参差边缘 */
function furry(S, pts, amp) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    out.push(a);
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const k = (i % 2 ? 1 : -0.6) * amp * (0.6 + S.r() * 0.8);
    out.push([(a[0] + b[0]) / 2 + (dy / l) * k, (a[1] + b[1]) / 2 - (dx / l) * k]);
  }
  return out;
}

// ---------------------------------------------------------------- 原型

const POSE_LEAN = { attack: 0.07, hurt: -0.12 };

function humanoid(S, o) {
  const v = HUMANOID_VARIANTS.includes(o.variant) ? o.variant : 'male';
  if (v === 'meditate') return meditate(S, o);
  const fem = v === 'female';
  const pose = o.pose;
  // —— 比例参数（全部在分支前取出，保证同一 seed 的造型在各姿态下一致）
  const H = S.v(100, 3), hr = S.v(7.4, 0.4);
  const shW = S.v(fem ? 9.6 : 11.2, 0.7), waW = S.v(fem ? 6.4 : 8, 0.6);
  const hemW = S.v(fem ? 19 : 17, 1.5) + (v === 'alchemist' ? 2.5 : 0);
  const wind = S.v(1, 0.25), torso = S.v(22, 1.5), ph = S.r() * TAU;
  const f1 = S.fl(ph), f2 = S.fl(ph + 1.3, 2.1), f3 = S.fl(ph + 2.4, 2.6);
  const br = Math.sin(S.t * 1.6 + ph) * 0.5;
  const headY = -H + hr, neckY = headY + hr + 1.2, shY = neckY + 3.5 + br * 0.3, waY = shY + torso;

  S.wash(0, 0.5, 30, 3.6);
  let hand;
  if (pose === 'attack') hand = [shW + 21, shY + 3];
  else if (pose === 'cast' || (v === 'talisman' && pose !== 'hurt')) hand = [shW + 8, shY - 11];
  else if (pose === 'hurt') hand = [shW + 9, shY - 4];
  else if (v === 'wanderer') hand = [shW + 5, waY - 8];
  else hand = [shW + 2.5, waY - 2 + br];

  // 背剑（在身后）
  if (v === 'sword' && pose !== 'attack') {
    const b = [-12, waY + 12], tp = [5, shY - 15];
    S.brush([b, lerp(b, tp, 0.5), tp], 3, { head: 0.02, tail: 0.05, taper: 0.3, dry: 0.2 });
    const len = Math.hypot(tp[0] - b[0], tp[1] - b[1]), d = [(tp[0] - b[0]) / len, (tp[1] - b[1]) / len];
    const g = lerp(b, tp, 0.74);
    S.line([[g[0] - d[1] * 3.6, g[1] + d[0] * 3.6], [g[0] + d[1] * 3.6, g[1] - d[0] * 3.6]], 1.7, { raw: true });
    S.brush([tp, [tp[0] - 4 - 3 * wind, tp[1] + 4 + f2], [tp[0] - 8 - 5 * wind, tp[1] + 10 + f3 * 1.5]], 1.6, { c: S.acc, a: 0.9, dry: 0 });
    S.dot(tp[0], tp[1], 1.2, { glow: true });
  }
  // 女修长发、披帛（在身后）
  if (fem) {
    S.blob([[0, headY - hr + 1], [-hr - 0.5, headY - 1], [-hr - 1.5, headY + hr + 5], [-hr - 3 - 3 * wind, waY - 6 + f1],
      [-hr - 8 - 6 * wind + 2 * f2, waY + 4 + f2], [-hr + 1, waY - 9], [-2, headY + hr]], { a: 0.95 });
    S.brush([[-shW + 1, shY + 3], [-shW - 6 - 4 * wind, shY + 15 + f1], [-shW - 14 - 8 * wind, waY + 5 + 2 * f2], [-shW - 21 - 11 * wind, waY + 18 + 3 * f3]],
      2.6, { a: 0.85, head: 0.1, tail: 0.6, dry: 0.2 });
  }
  // 后袖
  S.blob([[-shW + 3, shY], [-shW - 3, shY + 8], [-shW - 7 - 6 * wind + f1, waY + 5], [-shW - 11 - 8 * wind + 1.5 * f2, waY + 14],
    [-shW - 3 - 3 * wind, waY + 10], [-shW + 4, shY + 14]], { a: 0.82 });
  // 长袍：前襟贴身，后摆被风吹开
  const robe = [[3, neckY], [shW, shY + 2], [shW - 0.5, shY + 10], [waW, waY], [waW + 2.5, waY + 12], [hemW * 0.72 - 2 * wind, -1.5],
    [hemW * 0.3, 0], [-hemW * 0.3, 0.4], [-hemW - 6 * wind + 2 * f1, -2], [-hemW - 12 * wind + 3 * f2, -9 + f1],
    [-waW - 3, waY + 14], [-waW, waY], [-shW + 0.5, shY + 10], [-shW, shY + 2], [-3, neckY]];
  S.blob(robe, { grad: [1, 0.72] });
  S.brush([robe[1], robe[2], robe[3], robe[4], robe[5]], 2.2, { dry: 0.5, head: 0.2, tail: 0.5, a: 0.9 });
  S.brush([robe[11], robe[10], robe[9], robe[8]], 2.4, { dry: 0.5, a: 0.9 });
  // 衣纹留白、交领、腰带
  S.line([[2, waY + 8], [-1, waY + 26], [-4 - 3 * wind, -4]], 0.7, { c: PAPER, a: 0.32 });
  S.line([[-4, waY + 9], [-9, waY + 25], [-14 - 6 * wind, -6]], 0.7, { c: PAPER, a: 0.28 });
  S.line([[-2.5, neckY + 0.5], [2, shY + 7], [5, shY + 12]], 0.9, { c: PAPER, a: 0.55 });
  S.line([[-waW - 0.3, waY], [waW + 0.3, waY + 0.6]], 1.8, { c: S.acc, a: 0.85, raw: true });
  S.brush([[-waW, waY + 1], [-waW - 7 - 4 * wind, waY + 8 + f2], [-waW - 13 - 8 * wind, waY + 17 + 2 * f3]], 2, { c: S.acc, a: 0.75, dry: 0, head: 0.05, tail: 0.7 });
  S.ell(hemW * 0.55, -0.9, 4, 1.6);
  // 丹修：后腰葫芦
  if (v === 'alchemist') {
    const gx = -waW - 2.5, gy = waY + 9;
    S.line([[-waW + 1, waY + 1], [gx, gy - 6]], 0.8, { c: S.acc, raw: true });
    S.ell(gx, gy + 1, 4.2, 4.8, { c: PALETTE.ochre });
    S.ell(gx, gy - 5.2, 2.7, 2.9, { c: PALETTE.ochre });
    S.line([[gx - 2.6, gy - 2.6], [gx + 2.6, gy - 2.6]], 0.9, { c: PALETTE.cinnabar, raw: true });
    S.line([[gx - 1.6, gy - 0.5], [gx - 2.2, gy + 3]], 0.7, { c: PAPER, a: 0.6 });
  }
  // 颈、头
  S.ell(0, neckY - 1, 2.6, 3);
  if (!fem && v !== 'wanderer') S.blob([[-1, headY - hr + 1], [-hr - 1, headY], [-hr, headY + hr + 4], [-3, headY + hr]]);
  S.ell(0.8, headY, hr * 0.92, hr);
  const top = headY - hr;
  if (v === 'wanderer') {
    // 斗笠 + 系带
    S.blob([[-hr - 12, headY - 0.5], [-4, top - 5.5], [0.8, top - 8], [5.5, top - 5.5], [hr + 13, headY - 1], [1, headY - 3]]);
    S.brush([[-hr - 12, headY - 0.5], [0, headY - 2.6], [hr + 13, headY - 1]], 2, { dry: 0.6, head: 0.1, tail: 0.3 });
    S.line([[0.8, top - 7.5], [-8, headY - 1.5]], 0.6, { c: PAPER, a: 0.3, raw: true });
    S.line([[0.8, top - 7.5], [9, headY - 1.8]], 0.6, { c: PAPER, a: 0.3, raw: true });
    S.brush([[-2, headY + hr - 1], [-8 - 4 * wind, headY + hr + 4 + f1], [-15 - 6 * wind, headY + hr + 2 + f2 * 2]], 1.3, { dry: 0, tail: 0.7 });
  } else if (fem) {
    S.ell(-2, top - 1.2, 3.3, 3);
    S.ell(3, top - 1.8, 2.7, 2.6);
    S.line([[-1, top - 2], [7, top - 6]], 0.8, { c: PALETTE.gamboge, raw: true });
    S.dot(7.3, top - 6.2, 1.1, { glow: true });
    S.line([[7.3, top - 5.5], [7.8 + f2 * 0.6, top - 1.5]], 0.5, { c: PALETTE.gamboge, a: 0.8, raw: true });
  } else {
    const by = top - 1.2;
    S.ell(-0.5, by, 3.4, 3.1);
    S.poly([[-3, by - 1.2], [-2.4, by - 4.6], [2.2, by - 4.6], [2.8, by - 1.2]]);
    S.line([[-5.5, by - 2.4], [5.5, by - 3.2]], 0.9, { c: S.acc, a: 0.9, raw: true });
    S.brush([[-2.5, by - 2], [-10 - 3 * wind, by + 1 + f1 * 1.5], [-18 - 6 * wind, by - 0.5 + f2 * 2.5], [-25 - 8 * wind, by + 4 + f3 * 3]], 1.7, { head: 0.05, tail: 0.75, dry: 0 });
    S.brush([[-2.5, by - 1], [-9 - 3 * wind, by + 4 + f2], [-15 - 5 * wind, by + 4 + f3 * 2]], 1.2, { head: 0.05, tail: 0.75, dry: 0, a: 0.8 });
  }
  // 散修竹杖（在前臂之后）
  if (v === 'wanderer' && pose !== 'attack' && pose !== 'cast') {
    S.brush([[hand[0] + 1, shY - 10], [hand[0] + 1.5, waY], [hand[0] + 2.5, 0]], 2.2, { head: 0.02, tail: 0.1, taper: 0.4, dry: 0.4, c: PALETTE.ink1 });
  }
  // 前袖：上缘从肩到手，袖口下垂并被风带向身后
  const s0 = [shW - 2, shY + 2], hang = pose === 'attack' ? 9 : 12;
  const mid = [(s0[0] + hand[0]) / 2, (s0[1] + hand[1]) / 2 - 2.5];
  const cuff = [[hand[0] + 1.2, hand[1] + 2], [hand[0] - 3 - 3 * wind + f2, hand[1] + hang], [hand[0] - 9 - 4 * wind + f3, hand[1] + hang - 1]];
  S.blob([[s0[0] - 1, s0[1] - 2.5], mid, [hand[0] + 0.5, hand[1] - 2.2], ...cuff, [shW - 6, shY + 15]]);
  S.brush(cuff, 2, { dry: 0.5, head: 0.1, tail: 0.5 });
  S.ell(hand[0] + 1.8, hand[1], 2, 1.8);
  // 持物 / 出手
  if (pose === 'attack') {
    if (v === 'sword' || v === 'male' || v === 'wanderer') {
      const tip = [hand[0] + 28, hand[1] - 5];
      S.line([[hand[0] + 10, hand[1] - 18], [hand[0] + 30, hand[1] - 6], [hand[0] + 25, hand[1] + 12]], 1.4, { c: S.acc, a: 0.35, nb: true });
      S.brush([[hand[0] + 1, hand[1] + 0.5], tip], 2.3, { head: 0.02, tail: 0.25, taper: 0.6, dry: 0 });
      S.line([[hand[0] + 3, hand[1]], tip], 0.7, { c: S.acc, a: 0.9, raw: true });
      S.line([[hand[0] + 2, hand[1] - 3], [hand[0] + 2, hand[1] + 3.5]], 1.6, { raw: true });
      S.dot(tip[0], tip[1], 1.2, { glow: true });
    } else {
      S.dot(hand[0] + 5, hand[1], 3, { glow: true, a: 0.9 });
    }
  }
  if (v === 'talisman' && pose !== 'hurt') {
    const p = [hand[0] + 3, hand[1] - 7];
    const rect = [[-2.6, -5], [2.6, -5], [2.6, 5], [-2.6, 5]].map((q) => rotAbout([p[0] + q[0], p[1] + q[1]], 0.25, p));
    S.dot(p[0], p[1], 2.5, { glow: true, a: 0.5 });
    S.poly(rect, { c: PALETTE.gamboge });
    S.line([[p[0] - 0.8, p[1] - 3.5], [p[0] + 1, p[1] - 1.5], [p[0] - 0.9, p[1] + 0.5], [p[0] + 1, p[1] + 3]], 0.7, { c: PALETTE.cinnabar });
  } else if (pose === 'cast') {
    S.dot(hand[0] + 2.5, hand[1] - 2.5, 2, { glow: true });
  }
  return POSE_LEAN[pose] || 0;
}

/** 盘坐打坐（正面），主界面玩家用 */
function meditate(S) {
  const hr = S.v(7.4, 0.4), wind = S.v(1, 0.2), ph = S.r() * TAU;
  const br = Math.sin(S.t * 1.2 + ph) * 0.6, f1 = S.fl(ph, 1.3), f2 = S.fl(ph + 1.3, 1.9);
  const shY = -44 + br * 0.4, headY = shY - 4.2 - hr;
  S.wash(0, 0.5, 34, 4);
  // 披帛（身后，左右飘）
  for (const s of [-1, 1]) {
    const g = s > 0 ? f1 : f2;
    S.brush([[s * 10, shY + 4], [s * 19, shY + 9 + g], [s * 27, shY + 3 + g * 1.5], [s * (33 + 2 * wind), shY + 9 + g * 2]], 1.8, { a: 0.75, dry: 0, head: 0.1, tail: 0.7 });
  }
  for (const s of [-1, 1]) S.blob([[s * 10, shY + 1], [s * 18, shY + 12], [s * 22.5, -14], [s * 15, -11], [s * 7, -17], [s * 9.5, shY + 12]], { a: 0.85 });
  // 盘起的双膝
  S.blob([[-25, -0.5], [-27, -7], [-17, -14.5], [0, -13], [17, -14.5], [27, -7], [25, -0.5], [0, 1.2]], { grad: [0.95, 0.8] });
  S.brush([[-26, -3], [-27, -7], [-17, -14.2], [-4, -12.8]], 2, { dry: 0.6, a: 0.9, head: 0.1, tail: 0.5 });
  S.brush([[26, -3], [27, -7], [17, -14.2], [4, -12.8]], 2, { dry: 0.6, a: 0.9, head: 0.1, tail: 0.5 });
  // 身躯
  S.blob([[0, shY - 4.5], [-10.5, shY], [-12.5, shY + 14], [-15, -13], [15, -13], [12.5, shY + 14], [10.5, shY]], { grad: [1, 0.85] });
  S.line([[-20, -6], [-11, -9.5], [-3, -8.5]], 0.7, { c: PAPER, a: 0.35 });
  S.line([[20, -6], [11, -9.5], [3, -8.5]], 0.7, { c: PAPER, a: 0.35 });
  S.line([[-4.5, -15.5], [0, -13.2], [4.5, -15.5]], 0.8, { c: PAPER, a: 0.5 });
  S.line([[-3.2, shY - 3.5], [1.5, shY + 7]], 0.9, { c: PAPER, a: 0.55, raw: true });
  S.line([[3.2, shY - 3.5], [-0.3, shY + 5]], 0.9, { c: PAPER, a: 0.55, raw: true });
  S.line([[-12, shY + 15], [12, shY + 15]], 1.8, { c: S.acc, a: 0.85, raw: true });
  // 头、发髻、发带
  S.ell(0, shY - 3, 2.6, 3);
  S.ell(0, headY, hr * 0.92, hr);
  const by = headY - hr - 1.2;
  S.ell(0, by, 3.4, 3.1);
  S.poly([[-2.8, by - 1.2], [-2.2, by - 4.6], [2.2, by - 4.6], [2.8, by - 1.2]]);
  S.line([[-5.5, by - 2.6], [5.5, by - 2.6]], 0.9, { c: S.acc, a: 0.9, raw: true });
  for (const s of [-1, 1]) {
    const g = s > 0 ? f2 : f1;
    S.brush([[s * 1.5, by - 1], [s * (8 + 2 * wind), by + 2 + g * 1.5], [s * (15 + 3 * wind), by + 1 + g * 2], [s * (21 + 4 * wind), by + 5 + g * 2.5]], 1.6, { head: 0.05, tail: 0.7, dry: 0 });
  }
  return 0;
}

function wolf(S, o) {
  const bx = S.v(1, 0.06), by = S.v(1, 0.06), ph = S.r() * TAU, wind = S.v(1, 0.2);
  const P = (x, y) => [x * bx, y * by];
  const atk = o.pose === 'attack';
  const f1 = S.fl(ph, 2), br = Math.sin(S.t * 2.2 + ph) * 0.6, hd = atk ? 3 : 0;
  S.wash(0, 0.5, 34, 3.6);
  const leg = (pts, w, a) => S.brush(pts.map((p) => P(...p)), w, { w1: w * 0.45, head: 0.08, tail: 0.3, taper: 0.5, dry: 0.3, a, edge: a === 1 ? 0.3 : 0 });
  leg([[13, -26], [12, -13], [14, -2], [18, -0.5]], 6, 0.7);
  leg([[-28, -30], [-24, -18], [-31, -9], [-30, -1], [-26, -0.5]], 7.5, 0.7);
  // 尾：蓬松下垂，尾梢随风
  S.brush([P(-29, -38), P(-39, -36 + f1), P(-47 - 2 * wind, -30 + f1 * 1.5), P(-51 - 3 * wind, -21 + f1 * 2)], 9, { head: 0.3, tail: 0.5, dry: 0.6 });
  // 躯干：背脊与腹下毛发参差
  const torso = [[24, -32], [19, -22], [6, -20.5], [-12, -22.5], [-24, -23], [-32, -33], [-29, -42 + br], [-16, -41 + br], [-2, -42 + br], [12, -46.5 + br], [20, -48]].map((p) => P(...p));
  S.blob(furry(S, torso, 1.4), { grad: [1, 0.85] });
  S.brush([P(-30, -40), P(-14, -42.5 + br), P(4, -43 + br), P(16, -48.5)], 3, { dry: 0.9, head: 0.2, tail: 0.4 });
  for (const [x, y] of [[14, -40], [8, -41], [2, -40], [-20, -36]]) S.line([P(x, y), P(x - 3, y + 7)], 0.6, { c: PAPER, a: 0.3, raw: true });
  // 头与吻
  const head = [[17, -49], [24, -58 + hd], [34, -59 + hd], [42, -56 + hd], [49, -52.5 + hd], [50.5, -50.5 + hd], atk ? [46, -49.5 + hd] : [47, -47.5 + hd], [38, -45 + hd], [30, -40], [23, -35]].map((p) => P(...p));
  S.blob(head);
  S.poly([P(23.5, -57 + hd), P(25, -69 + hd), P(30, -57.5 + hd)]);
  S.poly([P(28.5, -57.5 + hd), P(32, -68 + hd), P(34.5, -57 + hd)]);
  if (atk) {
    S.brush([P(36, -44 + hd), P(43, -42 + hd), P(48.5, -44 + hd)], 3.2, { head: 0.1, tail: 0.5, dry: 0 });
    S.line([P(44, -48.6 + hd), P(45, -46.6 + hd)], 0.7, { c: PAPER, raw: true });
    S.line([P(41, -45.2 + hd), P(41.6, -47 + hd)], 0.7, { c: PAPER, raw: true });
  }
  S.line([P(35, -55.5 + hd), P(41, -55.3 + hd)], 0.6, { c: PAPER, a: 0.35, raw: true });
  S.dot(...P(39.5, -53.6 + hd), 1.5, { glow: true });
  leg([[20, -26], [22, -13], [23, -2], [27, -0.5]], 6.5, 1);
  leg([[-22, -30], [-16, -18], [-24, -9], [-22, -1], [-18, -0.5]], 8, 1);
  return POSE_LEAN[o.pose] || 0;
}

function spider(S, o) {
  if (o.variant === 'scorpion') return scorpion(S, o);
  const lx = S.v(1, 0.08), ab = S.v(1, 0.08), ph = S.r() * TAU;
  const tw = Math.sin(S.t * 5 + ph) * 1.5;
  S.wash(0, 0.5, 38, 3.6);
  const DX = [32, 15, -13, -30], KH = [2, 5, 5, 1];
  const legs = (far) => {
    for (let i = 0; i < 4; i++) {
      const base = far ? [5 - i * 4.5, -19] : [8 - i * 4.5, -18];
      const dx = DX[i] * lx * (far ? 0.78 : 1);
      const kh = -36 - KH[i] - (far ? 4 : 0) + (i % 2 ? tw : -tw);
      const knee = [base[0] + dx * 0.42, kh], mid = [base[0] + dx * 0.85, kh * 0.45], foot = [base[0] + dx, 0];
      S.brush([base, knee, mid, foot], 3.4, { w1: 1.4, head: 0.05, tail: 0.25, taper: 0.5, dry: 0.2, a: far ? 0.55 : 1 });
    }
  };
  legs(true);
  S.blob(S.oval(-15, -22, 18 * ab, 13.5 * ab, -0.15, 12, 0.05), { grad: [1, 0.85] });
  S.blob(S.oval(8, -17, 10, 7.5, 0.1, 10, 0.05));
  // 岩甲纹、背斑
  for (let k = 0; k < 3; k++) S.line([[-27 + k * 7, -29 + k * 1.5], [-22 + k * 7, -33 + k * 0.5], [-17 + k * 7, -30 + k * 1.5]], 0.7, { c: PAPER, a: 0.32 });
  S.line([[-22, -24], [-16, -20.5], [-10, -24]], 1.4, { c: S.acc, a: 0.75 });
  S.line([[-1.5, -23], [-0.5, -18], [-1.5, -13]], 0.6, { c: PAPER, a: 0.4 });
  legs(false);
  // 螯牙、眼簇
  S.brush([[15, -14], [18, -11], [17, -7.5]], 2.2, { head: 0.05, tail: 0.5, dry: 0 });
  S.brush([[12, -13], [14, -10], [13, -7]], 1.8, { head: 0.05, tail: 0.5, dry: 0, a: 0.7 });
  S.dot(15.6, -20, 1.4, { glow: true });
  S.dot(17.4, -17.6, 1, { glow: true });
  S.dot(13.6, -21.4, 0.9);
  return POSE_LEAN[o.pose] || 0;
}

function scorpion(S, o) {
  const ph = S.r() * TAU, cs = S.v(1, 0.08);
  const sw = Math.sin(S.t * 2.4 + ph) * 2, atk = o.pose === 'attack';
  S.wash(0, 0.5, 40, 3.6);
  // 步足
  for (const far of [true, false]) for (let i = 0; i < 4; i++) {
    const bx = 8 - i * 6 - (far ? 2 : 0), dx = [18, 9, -5, -15][i] * (far ? 0.8 : 1);
    S.brush([[bx, -10], [bx + dx * 0.5, -19 - (far ? 2 : 0)], [bx + dx, 0]], 2.6, { w1: 1.2, head: 0.05, tail: 0.3, taper: 0.5, dry: 0, a: far ? 0.55 : 1 });
  }
  // 尾节：沿弧线排列、由粗到细
  const C = [[-8, -13], [-20, -18], [-28, -30], [-26, -44 + sw * 0.5], [-16, -52 + sw], [-6, -50 + sw]];
  const tg = S.brush(C, 11, { w1: 5, head: 0.02, tail: 0.15, taper: 0.4, dry: 0.3 });
  for (let i = 1; i < 6; i++) {
    const idx = Math.round((i / 6) * (tg.c.length - 1)), c = tg.c[idx], n = tg.nm[idx], h = tg.hw[idx] * 0.9;
    S.line([[c[0] + n[0] * h, c[1] + n[1] * h], [c[0] - n[0] * h, c[1] - n[1] * h]], 0.8, { c: PAPER, a: 0.45, raw: true });
  }
  const st = C[5];
  S.brush([st, [st[0] + 6, st[1] + 3 + (atk ? 3 : 0)], [st[0] + 7, st[1] + 9 + (atk ? 4 : 0)]], 3.4, { head: 0.05, tail: 0.7, dry: 0 });
  S.dot(st[0] + 7, st[1] + 9 + (atk ? 4 : 0), 1.3, { glow: true });
  // 头胸甲
  S.blob(S.oval(5, -12, 15 * cs, 7.5, 0.05, 12, 0.05), { grad: [1, 0.85] });
  for (let k = 0; k < 3; k++) S.line([[-6 + k * 6, -18], [-5 + k * 6, -7]], 0.6, { c: PAPER, a: 0.35 });
  // 钳
  for (const far of [true, false]) {
    const a = far ? 0.6 : 1, dy = far ? -3 : 0, reach = atk ? 6 : 0;
    S.brush([[17, -13 + dy], [24 + reach * 0.5, -20 + dy], [29 + reach, -21 + dy]], 3, { head: 0.05, tail: 0.1, taper: 0.3, dry: 0, a });
    S.blob([[28 + reach, -24 + dy], [36 + reach, -27 + dy], [40 + reach, -23 + dy], [35 + reach, -22 + dy], [39 + reach, -18 + dy], [33 + reach, -17 + dy], [28 + reach, -18 + dy]], { a });
  }
  S.dot(14, -16.5, 1.2, { glow: true });
  S.dot(11.5, -17.2, 0.9);
  return POSE_LEAN[o.pose] || 0;
}

function puppet(S, o) {
  const sword = o.variant === 'sword';
  const ph = S.r() * TAU, tall = S.v(1, 0.05), tw = S.v(0, 0.08);
  const sw = Math.sin(S.t * 2.5 + ph) * 3, atk = o.pose === 'attack';
  const Y = (y) => y * tall;
  S.wash(0, 0.5, 26, 3.4);
  const J = {};
  for (const s of [-1, 1]) {
    J[s] = { sh: [s * 11, Y(-72)], el: [s * 15, Y(-56) + s * sw * 0.5], wr: [s * 16 + sw, Y(-42)], hip: [s * 5.5, Y(-44)], kn: [s * 7, Y(-23)], an: [s * 6.5, -2] };
  }
  if (atk) { J[1].el = [21, Y(-70)]; J[1].wr = [33, Y(-75)]; }
  // 傀儡丝与提线木架
  const bar = -128;
  for (const p of [J[-1].wr, J[1].wr, [0, Y(-93)]]) S.line([p, [p[0] * 0.45, bar]], 0.5, { c: PALETTE.ink2, a: 0.55, raw: true, nb: true });
  S.line([[-16, bar], [16, bar]], 1.8, { c: PALETTE.ink1, raw: true, nb: true });
  S.line([[0, bar - 4], [0, bar + 4]], 1.8, { c: PALETTE.ink1, raw: true, nb: true });
  const seg = (a, b, w, al) => S.brush([a, b], w, { w1: w * 0.85, head: 0, tail: 0, taper: 0, dry: 0.35, a: al });
  const joint = (p, al = 1) => { S.ell(p[0], p[1], 3, 3, { a: al }); S.line(circlePts(p[0], p[1], 3.1, 10), 0.6, { c: PAPER, a: 0.45, closed: true }); };
  const limbs = (s, al) => {
    const j = J[s];
    seg(j.hip, j.kn, 5.6, al); seg(j.kn, j.an, 5, al);
    seg(j.sh, j.el, 5.2, al); seg(j.el, j.wr, 4.6, al);
    S.ell(j.an[0] + 2, -1.2, 4, 1.8, { a: al });
    joint(j.kn, al); joint(j.el, al);
  };
  limbs(-1, 0.75);
  // 躯干、胯：木块拼接，留白木纹
  S.poly([[-10.5, Y(-75)], [10.5, Y(-75)], [8.5, Y(-47)], [-8.5, Y(-47)]], { grad: [1, 0.85] });
  S.poly([[-9, Y(-45.5)], [9, Y(-45.5)], [8, Y(-39)], [-8, Y(-39)]]);
  S.line([[-4, Y(-73)], [-5, Y(-62)], [-3.5, Y(-50)]], 0.6, { c: PAPER, a: 0.3 });
  S.line([[4, Y(-73)], [5.5, Y(-60)], [4, Y(-49)]], 0.6, { c: PAPER, a: 0.25 });
  // 头
  if (sword) {
    S.ell(0, Y(-85), 7.5, 8.5, { rot: tw });
    S.ell(0, Y(-95), 3, 2.8);
    S.line([[-7, Y(-86)], [7, Y(-86)]], 1.1, { c: PAPER, a: 0.5, raw: true });
  } else {
    S.blob([[-8, Y(-78)], [-9, Y(-87)], [-4, Y(-93)], [3, Y(-92)], [9, Y(-88)], [8, Y(-78)]].map((p) => rotAbout(p, tw, [0, Y(-80)])));
    S.brush([[-3, Y(-91)], [-6, Y(-100)], [-12, Y(-106)]], 2.2, { head: 0.05, tail: 0.6, dry: 0 });
    S.brush([[3, Y(-91)], [5, Y(-101)], [10, Y(-104)], [13, Y(-110)]], 2, { head: 0.05, tail: 0.6, dry: 0 });
    S.brush([[-6, Y(-100)], [-3, Y(-106)]], 1.2, { head: 0.05, tail: 0.6, dry: 0 });
    const leaf = mix(PALETTE.ink1, PALETTE.malachite, 0.45);
    S.ell(-12.5, Y(-107), 2.6, 1.3, { rot: -0.6, c: leaf });
    S.ell(13.5, Y(-111), 2.6, 1.3, { rot: 0.7, c: leaf });
    S.ell(-2.5, Y(-107), 2.2, 1.1, { rot: -1.2, c: leaf });
  }
  S.dot(-3, Y(-85.5), 1.2, { glow: true });
  S.dot(3, Y(-85.5), 1.2, { glow: true });
  // 胸前符箓
  if (!sword) {
    S.poly([[-3.5, Y(-70)], [3.5, Y(-70)], [3.5, Y(-56)], [-3.5, Y(-56)]], { c: PALETTE.gamboge, a: 0.95 });
    S.line([[-1, Y(-68)], [1.2, Y(-65)], [-1.2, Y(-62)], [1, Y(-58)]], 0.7, { c: PALETTE.cinnabar });
  }
  limbs(1, 1);
  joint(J[-1].sh, 1); joint(J[1].sh, 1); joint(J[-1].hip, 1); joint(J[1].hip, 1);
  // 手：枯枝爪 / 长刃
  const w = J[1].wr;
  if (sword) {
    const tip = atk ? [w[0] + 22, w[1] + 2] : [w[0] + 14, w[1] + 20];
    S.brush([w, tip], 2.6, { head: 0.02, tail: 0.3, taper: 0.6, dry: 0, c: PALETTE.ink1 });
    S.line([lerp(w, tip, 0.15), tip], 0.7, { c: S.acc, a: 0.85, raw: true });
    S.dot(tip[0], tip[1], 1, { glow: true });
  } else {
    for (const [dx, dy] of [[5, 4], [6, 0], [4, 6.5]]) S.brush([w, [w[0] + dx, w[1] + dy]], 1.6, { head: 0.05, tail: 0.6, dry: 0 });
  }
  return POSE_LEAN[o.pose] || 0;
}

function toad(S, o) {
  const wx = S.v(1, 0.07), hy = S.v(1, 0.07), ph = S.r() * TAU;
  const br = 1 + Math.sin(S.t * 2 + ph) * 0.04, atk = o.pose === 'attack';
  const P = (x, y) => [x * wx, y * hy];
  S.wash(0, 0.5, 36, 3.6);
  S.ell(...P(5, -38.5), 6, 5, { a: 0.75 });
  S.ell(...P(-18, -14), 12, 10, { rot: -0.3, a: 0.9 });
  const body = [[-30, -1], [-34, -12], [-28, -26], [-14, -36], [4, -38.5], [18, -36], [28, -28], [34, -19], [33 * br, -10 * br], [26, -4], [10, -1]].map((p) => P(...p));
  S.blob(body, { grad: [1, 0.85] });
  S.brush([P(-33, -12), P(-28, -26), P(-14, -36), P(4, -38.5)], 2.4, { dry: 0.7, head: 0.1, tail: 0.4 });
  S.ell(...P(16, -39), 6.5, 5.5);
  S.line(circlePts(...P(-18, -14), 10.5, 12).slice(6, 11), 0.7, { c: PAPER, a: 0.3 });
  // 疣点与霜晶
  const rr = seededRandom(S.seed + 17);
  for (let i = 0; i < 9; i++) {
    const x = -24 + rr() * 40, y = -30 + rr() * 16, r = 0.8 + rr() * 1.4;
    if (i % 3 === 0) S.dot(...P(x, y), r * 0.8, { a: 0.7 });
    else S.ell(...P(x, y), r, r * 0.8, { c: PAPER, a: 0.3 });
  }
  // 口线、前足、后足
  S.line([P(34, -18), P(24, atk ? -16 : -20.5), P(12, -20)], 0.9, { c: PAPER, a: 0.55 });
  if (atk) {
    S.wash(...P(46, -20), 14, 8, { c: S.acc, a: 0.45 });
    for (let i = 0; i < 4; i++) S.dot(...P(40 + i * 3.5, -22 + (i % 2) * 4), 0.8, { a: 0.7 });
  }
  S.brush([P(22, -14), P(28, -6), P(30, -1)], 6, { w1: 3, head: 0.1, tail: 0.3, taper: 0.5, dry: 0.3, edge: 0.3 });
  for (const d of [-0.5, 0, 0.5]) S.line([P(30, -1), P(30 + Math.cos(d) * 5, -1 + Math.sin(d) * 2)], 1, { raw: true });
  S.brush([P(-12, -4), P(0, -1.5), P(8, -0.8)], 4, { head: 0.1, tail: 0.5, dry: 0.2 });
  S.dot(...P(16.5, -40.5), 2, { glow: true });
  S.ell(...P(15.8, -41.2), 0.6, 0.6, { c: PAPER, a: 0.8 });
  return POSE_LEAN[o.pose] || 0;
}

function snake(S, o) {
  const ph = S.r() * TAU, rise = S.v(1, 0.07), cw = S.v(13, 1);
  const atk = o.pose === 'attack';
  const sway = (i, k) => Math.sin(S.t * 2 + ph + i * 0.7) * k;
  const lunge = atk ? 6 : 0;
  S.wash(0, 0.5, 36, 3.6);
  // 盘身（下层，稍淡以显层次）
  S.brush([[22, -6], [14, -1.5], [-4, -0.5], [-22, -2.5], [-30, -7], [-22, -12], [-6, -12.5], [-2, -9], [-14, -6], [-34, -3], [-44, -1]], cw * 0.9, { head: 0.05, tail: 0.55, taper: 0.9, dry: 0.5, a: 0.85, edge: 0.35 });
  // 抬起的上身：头 → 颈 → 盘口
  const up = [[16 + sway(0, 1.5) + lunge, -60 * rise], [11 + sway(1, 2) + lunge * 0.6, -52 * rise], [4 + sway(2, 2), -43 * rise], [2 + sway(3, 1.5), -33 * rise], [8, -23 * rise], [18, -15], [23, -8], [16, -2]];
  const g = S.brush(up, cw, { head: 0.04, tail: 0.25, taper: 0.7, dry: 0.4, edge: 0.4 });
  // 鳞纹
  for (let i = 4; i < g.c.length - 4; i += 4) {
    const c = g.c[i], n = g.nm[i], h = g.hw[i] * 0.5;
    S.line([[c[0] + n[0] * h - n[1] * 1.2, c[1] + n[1] * h + n[0] * 1.2], [c[0] - n[1] * 0.2, c[1] + n[0] * 0.2], [c[0] - n[0] * h - n[1] * 1.2, c[1] - n[1] * h + n[0] * 1.2]], 0.55, { c: PAPER, a: 0.3, raw: true });
  }
  // 头
  const [hx, hy] = up[0];
  S.blob([[hx - 3, hy], [hx + 1, hy - 6], [hx + 9, hy - 7.5], [hx + 16, hy - 4], [hx + 17, hy - 1], [hx + 10, hy + 2.5], [hx + 2, hy + 3.5]]);
  S.dot(hx + 10, hy - 4, 1.4, { glow: true });
  if (atk || Math.sin(S.t * 3 + ph) > -0.3) {
    const fl = Math.sin(S.t * 14) * 1.2;
    const b = [hx + 17, hy - 0.8], m = [hx + 22, hy - 0.5 + fl];
    S.line([b, m, [hx + 25, hy - 2.5 + fl]], 0.7, { c: PALETTE.cinnabar, raw: true });
    S.line([m, [hx + 25, hy + 1.2 + fl]], 0.7, { c: PALETTE.cinnabar, raw: true });
  }
  return POSE_LEAN[o.pose] || 0;
}

function golem(S, o) {
  const ph = S.r() * TAU, bulk = S.v(1, 0.06);
  const b = Math.sin(S.t * 1.5 + ph) * 1, atk = o.pose === 'attack';
  S.wash(0, 0.5, 34, 4);
  const rock = (cx, cy, w, h, a = 1) => {
    const n = 7 + Math.floor(S.r() * 3), pts = [];
    for (let i = 0; i < n; i++) {
      const ang = ((i + (S.r() - 0.5) * 0.5) / n) * TAU, k = 0.82 + S.r() * 0.3;
      pts.push([cx + Math.cos(ang) * (w / 2) * k * bulk, cy + Math.sin(ang) * (h / 2) * k]);
    }
    S.poly(pts, { a });
    S.line(pts, 0.8, { c: PAPER, a: 0.32, raw: true, closed: true });
    return pts;
  };
  const fistX = atk ? 40 : 31, fistY = atk ? -52 : -26;
  rock(-9, -11, 18, 24, 0.8);
  rock(-17, -66 + b, 22, 20, 0.8);
  rock(-24, -47 + b, 16, 18, 0.8);
  rock(-26, -29 + b, 20, 20, 0.8);
  rock(10, -11, 18, 24);
  rock(0, -28, 34, 16);
  rock(2, -52 + b, 50, 42);
  rock(12, -80 + b, 18, 16);
  rock(22, -66 + b, 24, 22);
  rock(atk ? 33 : 29, (atk ? -60 : -47) + b, 17, 19);
  rock(fistX, fistY + b, 24, 22);
  // 裂纹、符文、眼光
  S.line([[-10, -66 + b], [-4, -58 + b], [-8, -50 + b], [-2, -42 + b]], 0.8, { c: PAPER, a: 0.5, raw: true });
  S.line([[14, -40 + b], [10, -36 + b], [13, -32 + b]], 0.7, { c: PAPER, a: 0.45, raw: true });
  S.wash(4, -54 + b, 9, 9, { c: S.acc, a: 0.35 });
  S.line(circlePts(4, -54 + b, 5.5, 14), 1.1, { c: S.acc, a: 0.9, closed: true });
  S.line([[4, -60 + b], [4, -48 + b]], 1.1, { c: S.acc, a: 0.9, raw: true });
  S.line([[0, -55 + b], [8, -53 + b]], 1.1, { c: S.acc, a: 0.9, raw: true });
  S.line([[14.5, -81 + b], [19.5, -81.5 + b]], 1.4, { c: S.acc, raw: true });
  S.dot(18, -81.3 + b, 1.2, { glow: true });
  return POSE_LEAN[o.pose] || 0;
}

/** 鸟翼：局部坐标中的羽缘点，按扇动角 a 绕肩旋转 */
function wing(S, sx, sy, a, sc, alpha) {
  const F = [[-30, -38], [-35, -31], [-35, -23], [-32, -15], [-27, -8], [-19, -3], [-10, 1]];
  const E = [-5, -15], W = [-13, -29];
  const tr = (p) => { const r = rotAbout([p[0] * sc, p[1] * sc], a); return [sx + r[0], sy + r[1]]; };
  const pts = [[0, 0], E, W];
  const notches = [];
  for (let i = 0; i < F.length; i++) {
    pts.push(F[i]);
    if (i < F.length - 1) {
      const m = lerp(F[i], F[i + 1], 0.5), nt = lerp(m, [-12, -14], 0.22);
      pts.push(nt);
      notches.push(nt);
    }
  }
  pts.push([-2, 3]);
  S.blob(pts.map(tr), { a: alpha });
  S.brush([[0, 0], E, W, F[0]].map(tr), 2.4, { dry: 0.6, head: 0.1, tail: 0.5, a: alpha });
  for (let i = 0; i < notches.length; i++) {
    const root = lerp(W, E, i / notches.length * 0.9);
    S.line([tr(root), tr(lerp(root, notches[i], 0.85))], 0.6, { c: PAPER, a: 0.35 * alpha, raw: true });
  }
}

function bird(S, o) {
  if (o.variant === 'bat') return bat(S, o);
  const ph = S.r() * TAU, bs = S.v(1, 0.07), wind = S.v(1, 0.2);
  const flap = Math.sin(S.t * 6 + 1.2 + ph * 0.1), f1 = S.fl(ph, 2.4);
  const cy = -60 + flap * 2;
  const a = -0.2 + 0.55 * flap;
  S.wash(0, 0.5, 16, 2.6, { a: 0.12 });
  wing(S, 4, cy - 5, a * 0.9 + 0.15, 0.85 * bs, 0.6);
  // 尾羽与尾迹（焰羽 / 寒气用点缀色）
  for (const [dx, dy] of [[-32, 8], [-34, 3], [-31, 12]]) S.brush([[-14, cy + 2], [dx * bs, cy + dy + f1 * 1.5]], 3.6, { head: 0.1, tail: 0.6, dry: 0.4 });
  S.line([[-26, cy + 6], [-36 - 3 * wind, cy + 4 + f1 * 2], [-44 - 5 * wind, cy + 9 + f1 * 3]], 0.9, { c: S.acc, a: 0.5, nb: true });
  S.line([[-25, cy + 9], [-33 - 3 * wind, cy + 12 + f1], [-40 - 4 * wind, cy + 10 + f1 * 2.5]], 0.7, { c: S.acc, a: 0.4, nb: true });
  // 身、头、喙
  S.blob([[14, cy - 6], [6, cy - 9], [-8, cy - 6], [-18, cy + 1], [-8, cy + 6], [6, cy + 6], [14, cy + 3]].map(([x, y]) => [x * bs, y]));
  S.ell(17 * bs, cy - 6, 6.5, 6);
  S.poly([[22 * bs, cy - 8.5], [31 * bs, cy - 4.8], [22 * bs, cy - 2.6]]);
  S.brush([[13 * bs, cy - 10], [7 * bs - 2 * wind, cy - 15 + f1]], 1.6, { head: 0.05, tail: 0.6, dry: 0 });
  S.brush([[12 * bs, cy - 9], [4 * bs - 2 * wind, cy - 12 + f1 * 1.2]], 1.3, { head: 0.05, tail: 0.6, dry: 0 });
  S.dot(19.5 * bs, cy - 7.5, 1.3, { glow: true });
  S.line([[2, cy + 5], [3, cy + 12], [6, cy + 14]], 0.9);
  S.line([[-2, cy + 5], [-2, cy + 12], [1, cy + 14.5]], 0.9, { a: 0.7 });
  wing(S, 2, cy - 3, a, bs, 1);
  return POSE_LEAN[o.pose] || 0;
}

function bat(S, o) {
  const ph = S.r() * TAU, span = S.v(1, 0.07);
  const flap = Math.sin(S.t * 7 + 1 + ph * 0.1), cy = -64 + flap * 2;
  S.wash(0, 0.5, 18, 2.6, { a: 0.12 });
  for (const s of [-1, 1]) {
    const W = [s * 20 * span, cy - 8 - 10 * flap];
    const F1 = [s * 46 * span, cy - 4 - 14 * flap], F2 = [s * 40 * span, cy + 9 - 8 * flap], F3 = [s * 26 * span, cy + 13 - 4 * flap];
    const sc = (p, q) => lerp(lerp(p, q, 0.5), [s * 10, cy - 2], 0.18);
    const mem = [[s * 4, cy - 5], W, F1, sc(F1, F2), F2, sc(F2, F3), F3, sc(F3, [s * 5, cy + 7]), [s * 5, cy + 7]];
    S.blob(mem, { a: 0.95 });
    S.brush([[s * 4, cy - 5], W, F1], 2, { head: 0.1, tail: 0.6, dry: 0.5 });
    for (const F of [F1, F2, F3]) S.line([W, F], 0.6, { c: PAPER, a: 0.35, raw: true });
  }
  S.ell(0, cy, 6, 9);
  S.ell(0, cy - 10, 5, 4.5);
  S.poly([[-4.2, cy - 12], [-5.5, cy - 20], [-1, cy - 13.5]]);
  S.poly([[4.2, cy - 12], [5.5, cy - 20], [1, cy - 13.5]]);
  S.dot(-2, cy - 10.5, 1, { glow: true });
  S.dot(2, cy - 10.5, 1, { glow: true });
  S.line([[-1.2, cy - 7.5], [-1, cy - 6]], 0.5, { c: PAPER, raw: true });
  S.line([[1.2, cy - 7.5], [1, cy - 6]], 0.5, { c: PAPER, raw: true });
  S.line([[-2, cy + 8], [-3, cy + 13]], 0.9, { raw: true });
  S.line([[2, cy + 8], [3, cy + 13]], 0.9, { raw: true });
  return POSE_LEAN[o.pose] || 0;
}

function beast(S, o) {
  if (o.variant === 'turtle') return turtle(S, o);
  const L = S.v(1, 0.06), Hh = S.v(1, 0.05), horns = 1 + Math.floor(S.r() * 2), wind = S.v(1, 0.2), ph = S.r() * TAU;
  const P = (x, y) => [x * L + 3, y * Hh];
  const atk = o.pose === 'attack', br = Math.sin(S.t * 1.8 + ph) * 0.8, hd = atk ? 3 : 0;
  S.wash(0, 0.5, 44, 4);
  const leg = (pts, w, a) => S.brush(pts.map((p) => P(...p)), w, { w1: w * 0.6, head: 0.05, tail: 0.2, taper: 0.4, dry: 0.3, a, edge: a === 1 ? 0.3 : 0 });
  leg([[16, -32], [15, -16], [16, -2], [21, -0.5]], 10, 0.7);
  leg([[-32, -38], [-27, -22], [-34, -11], [-33, -1], [-28, -0.5]], 11, 0.7);
  // 尾与尾焰
  const tt = P(-47 - 2 * wind, -67 + S.fl(ph, 2) * 2);
  S.brush([P(-36, -44), P(-46, -50 + S.fl(ph, 2)), P(-50, -60 + S.fl(ph, 2) * 1.5), tt], 5, { head: 0.1, tail: 0.3, dry: 0.3 });
  for (let i = 0; i < 3; i++) S.brush([tt, [tt[0] - 6 - i * 3 - 3 * wind, tt[1] - 4 + i * 4 + S.fl(ph + i, 3) * 1.5]], 3, { head: 0.05, tail: 0.7, dry: 0 });
  // 躯干
  const torso = [[30, -38], [24, -26], [10, -24], [-14, -25], [-28, -27], [-38, -36], [-36, -48 + br], [-24, -54 + br], [-4, -52 + br], [14, -58 + br], [28, -56]].map((p) => P(...p));
  S.blob(torso, { grad: [1, 0.85] });
  S.brush([P(-37, -46), P(-24, -54.5 + br), P(-4, -52.5 + br), P(14, -58.5 + br)], 3, { dry: 0.9, head: 0.2, tail: 0.4 });
  // 鳞纹
  for (let y = -48; y <= -32; y += 6) for (let x = -26 + ((y / 6) % 2 ? 4 : 0); x <= 18; x += 8) {
    S.line([P(x - 3, y), P(x, y + 2.2), P(x + 3, y)], 0.6, { c: PAPER, a: 0.25 });
  }
  // 鬃：发丝随风
  for (let i = 0; i < 7; i++) {
    const r0 = lerp(P(33, -66 + hd), P(12, -52), i / 6), g = S.fl(ph + i * 0.8, 2.3);
    S.brush([r0, [r0[0] - 7 - 2 * wind, r0[1] - 4 + i + g], [r0[0] - 14 - i * 1.5 - 4 * wind, r0[1] - 2 + i * 1.6 + g * 2]], 4, { head: 0.08, tail: 0.6, dry: 0.4 });
  }
  // 头、角
  const head = [[22, -56], [28, -66 + hd], [38, -70 + hd], [48, -66 + hd], [55, -60 + hd], [56, -55 + hd], atk ? [50, -53.5 + hd] : [48, -51 + hd], [40, -48 + hd], [30, -44]].map((p) => P(...p));
  S.blob(head);
  for (let i = 0; i < horns; i++) S.brush([P(36 - i * 4, -69 + hd), P(31 - i * 5, -78 + hd), P(25 - i * 6, -83 + hd + i * 2)], 3.6, { head: 0.02, tail: 0.75, dry: 0 });
  if (atk) {
    S.brush([P(40, -47 + hd), P(48, -46 + hd), P(54, -49 + hd)], 4, { head: 0.1, tail: 0.5, dry: 0 });
    S.wash(...P(64, -52 + hd), 10, 6, { c: S.acc, a: 0.5 });
  }
  S.line([P(42, -66 + hd), P(49, -64 + hd)], 0.7, { c: PAPER, a: 0.4, raw: true });
  S.dot(...P(46.5, -62.5 + hd), 1.8, { glow: true });
  leg([[24, -32], [26, -16], [25, -2], [31, -0.5]], 11, 1);
  leg([[-26, -36], [-20, -20], [-28, -10], [-26, -1], [-20, -0.5]], 12, 1);
  for (const x of [31, -20]) for (const d of [0, 2.5]) S.line([P(x + d, -1), P(x + d + 2.2, 0)], 0.9, { c: PAPER, a: 0.4, raw: true });
  return POSE_LEAN[o.pose] || 0;
}

function turtle(S, o) {
  const L = S.v(1, 0.06), dome = S.v(1, 0.06), ph = S.r() * TAU, wind = S.v(1, 0.2);
  const atk = o.pose === 'attack', nk = atk ? 6 : Math.sin(S.t * 1.4 + ph) * 1.5;
  const P = (x, y) => [x * L, y * dome];
  S.wash(0, 0.5, 42, 4);
  // 背上苔丝（绿毛）随水流飘
  const moss = mix(PALETTE.ink1, PALETTE.malachite, 0.5);
  for (let i = 0; i < 5; i++) {
    const r0 = P(-24 + i * 5, -30 - i * 2), g = S.fl(ph + i, 1.6);
    S.brush([r0, [r0[0] - 10 - 3 * wind, r0[1] + 6 + g * 2], [r0[0] - 20 - 5 * wind, r0[1] + 14 + g * 3]], 2.2, { c: moss, a: 0.7, head: 0.05, tail: 0.7, dry: 0 });
  }
  S.brush([P(-20, -8), P(-30, -3), P(-37, -1)], 7, { head: 0.1, tail: 0.4, dry: 0.2, a: 0.7 });
  S.brush([P(14, -8), P(22, -3), P(28, -1)], 7, { head: 0.1, tail: 0.4, dry: 0.2, a: 0.7 });
  // 颈与头
  S.brush([P(22, -14), P(32 + nk * 0.6, -20), P(40 + nk, -22)], 8, { head: 0.1, tail: 0.1, taper: 0.3, dry: 0.3 });
  const hx = 46 + nk, hy = -22;
  S.blob([P(hx - 6, hy - 4), P(hx + 2, hy - 6.5), P(hx + 9, hy - 2), P(hx + 8, hy + 3), P(hx, hy + 5), P(hx - 6, hy + 4)]);
  S.dot(...P(hx + 2, hy - 2), 1.5, { glow: true });
  // 甲壳 + 六角纹
  const shell = [[-34, -9], [-31, -26], [-15, -39], [8, -40], [24, -31], [31, -14], [27, -8], [-30, -6]].map((p) => P(...p));
  S.blob(shell, { grad: [1, 0.85] });
  S.brush([P(-33, -10), P(-31, -26), P(-15, -39), P(8, -40), P(24, -31), P(30, -14)], 2.6, { dry: 0.7, head: 0.1, tail: 0.3 });
  S.line([P(-31, -10), P(-2, -11.5), P(28, -10)], 0.8, { c: PAPER, a: 0.45 });
  const hexes = [[-12, -26], [4, -27], [-20, -16], [-4, -17], [12, -17], [-5, -34]];
  for (const [x, y] of hexes) S.line(circlePts(...P(x, y), 5, 6), 0.6, { c: PAPER, a: 0.32, raw: true, closed: true });
  S.brush([P(20, -9), P(26, -3), P(32, -0.8)], 8, { head: 0.1, tail: 0.4, dry: 0.2, edge: 0.3 });
  S.brush([P(-24, -9), P(-32, -3), P(-40, -1)], 7.5, { head: 0.1, tail: 0.4, dry: 0.2, edge: 0.3 });
  // 水纹
  S.line([P(-44, 1.5), P(-34, 0.6), P(-24, 1.5)], 0.7, { c: S.acc, a: 0.45, nb: true });
  S.line([P(30, 1.5), P(40, 0.6), P(50, 1.5)], 0.7, { c: S.acc, a: 0.45, nb: true });
  return POSE_LEAN[o.pose] || 0;
}

function vine(S, o) {
  const n = 4 + Math.floor(S.r() * 2), ph = S.r() * TAU;
  const atk = o.pose === 'attack';
  const leafC = mix(PALETTE.ink1, PALETTE.malachite, 0.35);
  const V = [];
  for (let k = 0; k < n; k++) V.push({ base: (k - (n - 1) / 2) * 11 + S.v(0, 2), h: 56 + S.r() * 36, dir: k % 2 ? 1 : -1, ph: S.r() * TAU });
  S.wash(0, 0.5, 34, 3.8);
  // 根须
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) S.brush([[s * 4, -1.5], [s * (14 + i * 8), -0.5 - i], [s * (22 + i * 10), 0.5]], 4 - i, { head: 0.05, tail: 0.7, dry: 0.4 });
  V.forEach((v, k) => {
    const pts = [];
    const bend = atk && k === Math.floor(n / 2) ? 1.6 : 1;
    for (let i = 0; i <= 9; i++) {
      const u = i / 9;
      pts.push([v.base + Math.sin(u * 4.2 + v.ph + S.t * 1.2) * 8 * u * bend + v.dir * u * u * 6, -u * v.h]);
    }
    // 梢头卷须（螺旋）
    const tip = pts[pts.length - 1];
    for (let s = 1; s <= 6; s++) {
      const a = -Math.PI / 2 + v.dir * s * 0.9, r = 6 * (1 - s / 8);
      pts.push([tip[0] + v.dir * 5 + Math.cos(a + Math.PI) * r * v.dir, tip[1] + 4 + Math.sin(a) * r]);
    }
    const g = S.brush(pts, 7.5 - (k % 2), { head: 0.02, tail: 0.45, taper: 0.9, dry: 0.4, a: k % 2 ? 0.85 : 1 });
    // 刺
    for (let i = 6; i < g.c.length * 0.7; i += 7) {
      const c = g.c[i], nn = g.nm[i], sd = (i / 7) % 2 ? 1 : -1, h = g.hw[i];
      const b0 = [c[0] + nn[0] * h * sd, c[1] + nn[1] * h * sd];
      S.poly([[b0[0] - nn[1] * 1.4, b0[1] + nn[0] * 1.4], [b0[0] + nn[0] * 3.5 * sd, b0[1] + nn[1] * 3.5 * sd - 1.5], [b0[0] + nn[1] * 1.4, b0[1] - nn[0] * 1.4]]);
    }
    // 叶
    const li = Math.floor(g.c.length * (0.35 + (k % 3) * 0.1)), lc = g.c[li], ln = g.nm[li], sd = k % 2 ? 1 : -1;
    const lt = [lc[0] + ln[0] * 11 * sd, lc[1] + ln[1] * 11 * sd - 3];
    const m = lerp(lc, lt, 0.5), q = [-(lt[1] - lc[1]) * 0.28, (lt[0] - lc[0]) * 0.28];
    S.blob([lc, [m[0] + q[0], m[1] + q[1]], lt, [m[0] - q[0], m[1] - q[1]]], { c: leafC });
    S.line([lc, lerp(lc, lt, 0.85)], 0.5, { c: PAPER, a: 0.45, raw: true });
  });
  // 花苞与妖目
  const cy = -30 + Math.sin(S.t * 1.5 + ph) * 1;
  S.blob(S.oval(0, cy, 12, 15, 0, 10, 0.05), { grad: [1, 0.9] });
  for (const s of [-1, 1]) S.line([[s * 3, cy - 13], [s * 8, cy - 4], [s * 5, cy + 10]], 0.7, { c: PAPER, a: 0.35 });
  S.wash(0, cy, 7, 9, { c: S.acc, a: 0.4 });
  S.ell(0, cy, atk ? 4.5 : 3.2, atk ? 6.5 : 5.5, { c: S.acc });
  S.ell(0, cy, 1, 4, { c: PALETTE.ink0 });
  S.dot(0, cy - 2, 0.8, { c: PAPER, a: 0.9 });
  return POSE_LEAN[o.pose] || 0;
}

/** 魂影（心魔 demon / 云海祟 mist）：半透明人形上身，下半身化作墨烟拖尾，无足；眼与心口点光 */
function wraith(S, o) {
  const mist = o.variant === 'mist';
  const pose = o.pose;
  // —— 参数：比例 + 烟形（种子决定拖尾的摆向、卷曲与烟缕）
  const hr = S.v(7, 0.4), shW = S.v(mist ? 11 : 12, 0.8), waW = S.v(7, 0.6);
  const sweep = S.v(0, 7), curl = S.v(1, 0.3), ph = S.r() * TAU;
  const wisps = [0, 1, 2, 3].map(() => ({ dx: S.v(0, 8), dy: S.v(0, 6), k: S.v(1, 0.3), p: S.r() * TAU }));
  const A = mist ? 0.6 : 0.78;
  const bob = Math.sin(S.t * 1.5 + ph) * 2;
  const f1 = S.fl(ph, 1.9), f2 = S.fl(ph + 1.7, 2.6), f3 = S.fl(ph + 3.1, 1.3);
  const headY = -91 + bob, neckY = headY + hr + 1, shY = neckY + 3.5, waY = shY + 22;
  S.wash(0, 0.5, 20, 2.6, { a: 0.1 });
  S.wash(-8 + sweep * 0.5, -10, 26, 10, { c: S.acc, a: mist ? 0.12 : 0.16 });
  // 墨烟拖尾：主烟 + 两缕副烟，末梢上卷
  const tail = (dx, dy, k, p, w, a) => {
    const g1 = Math.sin(S.t * 1.6 + p), g2 = Math.sin(S.t * 2.3 + p + 1);
    S.brush([[0, waY - 2], [-3 + dx * 0.3, waY + 12], [-9 + dx * 0.6 + g1 * 2, waY + 26 + dy * 0.3], [-19 + dx + sweep + g2 * 2.5, -14 + dy],
      [-30 + dx + sweep + g1 * 3, -7 + dy * 0.5], [-38 + dx + sweep * 1.2, -12 - 4 * k + g2 * 2], [-40 + dx + sweep * 1.2 + 4 * k, -20 - 6 * k + g1 * 2]],
      w, { w1: w * 0.15, head: 0.02, tail: 0.55, taper: 0.95, dry: 0.8, a, wobble: 0.5 });
  };
  tail(wisps[0].dx, wisps[0].dy, wisps[0].k, wisps[0].p, 14, A * 0.45);
  tail(wisps[1].dx * 0.6, wisps[1].dy, wisps[1].k, wisps[1].p, 10, A * 0.4);
  tail(0, 0, curl, ph, 24, A * 0.85);
  // 烟缕卷纹
  for (const w of wisps.slice(2)) {
    const x = -16 + w.dx + sweep * 0.8, y = -26 + w.dy, g = Math.sin(S.t * 1.8 + w.p);
    S.line([[x + 6, y + 4], [x, y + g], [x - 5, y - 4], [x - 3, y - 8 * w.k], [x + 1, y - 6]], 0.7, { c: mist ? PAPER : PALETTE.ink2, a: 0.45, nb: true });
  }
  // 手位
  let hand, hand2;
  if (pose === 'attack') { hand = [shW + 20, shY + 4]; hand2 = [shW + 12, shY + 12]; }
  else if (pose === 'cast') { hand = [shW + 6, shY - 14]; hand2 = [-shW - 6, shY - 12]; }
  else if (pose === 'hurt') { hand = [shW + 6, shY - 6]; hand2 = [-shW - 8, shY + 2]; }
  else { hand = [shW + 5, shY + 18 + f1]; hand2 = [-shW - 6, shY + 20 + f2]; }
  // 后臂（淡）
  S.brush([[-shW + 3, shY + 2], [(hand2[0] - shW) / 2 - 2, (shY + hand2[1]) / 2 + 2], hand2], mist ? 7 : 5, { w1: 2, head: 0.1, tail: 0.5, a: A * 0.6, dry: 0.5 });
  // 雾祟：兜帽披纱拖向身后
  if (mist) S.brush([[-2, headY - hr - 2], [-hr - 6, headY + 4 + f1], [-hr - 14 + sweep * 0.3, shY + 10 + f2 * 2], [-hr - 22 + sweep * 0.5, shY + 22 + f3 * 3]], 9, { w1: 2, head: 0.1, tail: 0.6, a: A * 0.7, dry: 0.7 });
  // 躯干：自胸口向下渐淡入烟
  S.blob([[3, neckY], [shW, shY + 2], [shW - 1.5, shY + 13], [waW + 2, waY], [0, waY + 6], [-waW - 3, waY + 1], [-shW + 1.5, shY + 13], [-shW, shY + 2], [-3, neckY]], { a: A, grad: [1, 0.35] });
  S.line([[-2.5, neckY + 0.5], [2, shY + 7], [4.5, shY + 12]], 0.8, { c: PAPER, a: 0.35 });
  // 头
  S.ell(0, neckY - 1, 2.4, 2.8, { a: A });
  S.ell(0.8, headY, hr * 0.92, hr, { a: A });
  if (mist) {
    S.blob([[-hr - 2.5, headY + hr + 3], [-hr - 2, headY - 3], [-1, headY - hr - 4], [hr + 1.5, headY - 3.5], [hr + 3.5, headY + 2], [hr + 1, headY + 1], [-1, headY + hr + 1]], { a: A * 0.95 });
    S.line([[hr + 3, headY + 1], [hr - 1, headY - hr + 0.5], [-1, headY - hr - 3]], 0.7, { c: PAPER, a: 0.35 });
  } else {
    // 心魔：逆风上扬的乱发如焰 + 短角
    for (let i = 0; i < 6; i++) {
      const r0 = [-hr * 0.6 + i * 2.2, headY - hr + 1.5 + Math.abs(i - 2.5) * 0.6], g = Math.sin(S.t * 3 + ph + i);
      S.brush([r0, [r0[0] - 5 - i * 0.6, r0[1] - 7 - (i % 2) * 3 + g], [r0[0] - 12 - i * 1.2, r0[1] - 9 - (i % 3) * 3 + g * 2]], 2.4, { head: 0.05, tail: 0.75, dry: 0, a: A });
    }
    S.brush([[3.5, headY - hr + 1.5], [6, headY - hr - 4], [5, headY - hr - 7.5]], 2, { head: 0.02, tail: 0.8, dry: 0, a: A });
  }
  // 前臂：心魔为利爪，雾祟为垂袖化烟
  const s0 = [shW - 2, shY + 2];
  if (mist) {
    S.brush([s0, lerp(s0, hand, 0.5), hand], 8, { w1: 4, head: 0.1, tail: 0.2, taper: 0.5, a: A, dry: 0.6 });
    S.brush([hand, [hand[0] - 3, hand[1] + 8 + f2], [hand[0] - 8, hand[1] + 15 + f3 * 2]], 5, { w1: 1, head: 0.05, tail: 0.6, a: A * 0.6, dry: 0.6 });
  } else {
    S.brush([s0, [(s0[0] + hand[0]) / 2, (s0[1] + hand[1]) / 2 + 2], hand], 5, { w1: 3, head: 0.1, tail: 0.1, taper: 0.4, a: A, dry: 0.4 });
    const dir = Math.atan2(hand[1] - s0[1], hand[0] - s0[0]);
    for (const d of [-0.5, 0, 0.5]) S.brush([hand, [hand[0] + Math.cos(dir + d) * 6, hand[1] + Math.sin(dir + d) * 6 + 1.5]], 1.6, { head: 0.05, tail: 0.8, dry: 0, a: A });
  }
  // 点光：双眼、心口
  S.dot(4.2, headY - 0.6, 0.9, { glow: true });
  S.dot(1.6, headY - 0.9, 0.8, { glow: true });
  const heart = pose === 'cast' ? 3.2 : pose === 'attack' ? 2.6 : 2 + Math.sin(S.t * 4 + ph) * 0.3;
  S.wash(1.5, shY + 9, heart * 3, heart * 3, { c: S.acc, a: 0.45 });
  S.dot(1.5, shY + 9, heart, { glow: true });
  if (pose === 'cast') { S.dot(hand[0] + 1, hand[1] - 3, 1.8, { glow: true }); S.dot(hand2[0] - 1, hand2[1] - 3, 1.6, { glow: true }); }
  if (pose === 'attack') S.line([[hand[0] + 4, hand[1] - 12], [hand[0] + 12, hand[1] - 2], [hand[0] + 8, hand[1] + 10]], 1.2, { c: S.acc, a: 0.45, nb: true });
  return pose === 'attack' ? 0.1 : POSE_LEAN[pose] || 0;
}

/** 蛟（星陨古蛟）：盘曲长身由少量参数控制，带鳞纹、背鳍、短角与长须；首领气势：身后星辉 */
function jiao(S, o) {
  const pose = o.pose, atk = pose === 'attack', cast = pose === 'cast';
  const amp = S.v(1, 0.1), spread = S.v(1, 0.06), rise = S.v(1, 0.06), tailK = S.v(1, 0.25), ph = S.r() * TAU, wind = S.v(1, 0.2);
  const stars = [0, 1, 2, 3, 4].map(() => [S.v(0, 44), S.v(-62, 30), 0.5 + S.r() * 0.8]);
  const sw = (i) => Math.sin(S.t * 1.4 + ph + i * 0.55) * 1.4;
  const hd = atk ? 4 : 0;
  S.wash(0, 0.5, 46, 4);
  // 首领气势：身后星辉
  S.wash(-2, -46, 52, 40, { c: S.acc, a: 0.16 });
  for (const [x, y, r] of stars) S.dot(x, y, r, { glow: true, a: 0.85 });
  // 身躯中心线（头 → 尾）：颈上扬、前环、着地、背拱、尾梢上卷
  const C = [[32 + hd, -76 * rise + hd], [25 + hd * 0.5, -66 * rise], [21, -53 * rise], [27, -40], [35, -27], [30, -13], [16, -7], [2, -11],
    [-8, -10 - 16 * amp], [-20, -10 - 28 * amp], [-34, -10 - 26 * amp], [-43, -22], [-41, -9], [-31, -4], [-22, -6 - 3 * tailK], [-19, -13 - 6 * tailK]]
    .map(([x, y], i) => [x * spread + (i > 0 ? sw(i) : 0), y + (i > 0 ? sw(i + 3) * 0.6 : 0)]);
  // 足（后足在身后）
  const claw = (p, a) => { for (const d of [-2.5, 0, 2.5]) S.line([p, [p[0] + d + 2.5, p[1] + 1.2]], 0.9, { raw: true, a }); };
  S.brush([lerp(C[11], C[12], 0.5), [-48, -8], [-46, -1]], 4.5, { w1: 2.4, head: 0.05, tail: 0.3, taper: 0.5, dry: 0.3, a: 0.8 });
  claw([-46, -1], 0.8);
  const g = S.brush(C, 14, { w1: 3, head: 0.03, tail: 0.4, taper: 0.85, dry: 0.5, edge: 0.35 });
  const n = g.c.length;
  // 背鳍（朝上一侧）与鳞纹
  for (let i = 5; i < n * 0.92; i += 5) {
    const c = g.c[i], nm = g.nm[i], h = g.hw[i], s = nm[1] < 0 ? 1 : -1;
    const up = [nm[0] * s, nm[1] * s], b = [c[0] + up[0] * h * 0.9, c[1] + up[1] * h * 0.9], tg = [-up[1], up[0]];
    const len = 2.5 + h * 0.35;
    S.poly([[b[0] - tg[0] * 1.8, b[1] - tg[1] * 1.8], [b[0] + up[0] * len - tg[0] * 1.6, b[1] + up[1] * len - tg[1] * 1.6], [b[0] + tg[0] * 1.8, b[1] + tg[1] * 1.8]]);
    if (h > 2.5) {
      const q = h * 0.55;
      S.line([[c[0] + up[0] * q - tg[0] * 1.3, c[1] + up[1] * q - tg[1] * 1.3], [c[0] - tg[0] * 0.2, c[1] - tg[1] * 0.2], [c[0] - up[0] * q - tg[0] * 1.3, c[1] - up[1] * q - tg[1] * 1.3]], 0.55, { c: PAPER, a: 0.32, raw: true });
      S.line([[c[0] - up[0] * h * 0.8, c[1] - up[1] * h * 0.8], [c[0] - up[0] * h * 0.55, c[1] - up[1] * h * 0.55]], 0.5, { c: PAPER, a: 0.3, raw: true });
    }
  }
  // 前足
  const fb = lerp(C[3], C[4], 0.4), ft = atk ? [fb[0] + 14, fb[1] - 6] : [fb[0] + 10, -1];
  S.brush([fb, [fb[0] + 7, (fb[1] + ft[1]) / 2 - 2], ft], 4.5, { w1: 2.4, head: 0.05, tail: 0.3, taper: 0.5, dry: 0.3, edge: 0.3 });
  claw(ft, 1);
  // 头：长吻、下颌（出手时张口）
  const [hx, hy] = C[0];
  S.blob([[hx - 7, hy + 3], [hx - 4, hy - 5], [hx + 4, hy - 7], [hx + 12, hy - 5.5], [hx + 19, hy - 3], [hx + 20, hy - 0.5], atk ? [hx + 13, hy + 0.5] : [hx + 15, hy + 2.5], [hx + 6, hy + 5], [hx - 3, hy + 7]]);
  if (atk) {
    S.brush([[hx + 2, hy + 5], [hx + 10, hy + 6], [hx + 17, hy + 4]], 3.4, { head: 0.1, tail: 0.5, dry: 0 });
    S.line([[hx + 12, hy + 0.8], [hx + 12.6, hy + 2.6]], 0.6, { c: PAPER, raw: true });
    S.line([[hx + 15.5, hy + 0.5], [hx + 16, hy + 2.2]], 0.6, { c: PAPER, raw: true });
    S.wash(hx + 28, hy + 1, 11, 6, { c: S.acc, a: 0.55 });
  }
  // 短角、须、鬃
  S.brush([[hx + 1, hy - 5.5], [hx - 3, hy - 11], [hx - 8, hy - 13]], 2.6, { head: 0.02, tail: 0.75, dry: 0 });
  S.brush([[hx + 4, hy - 6.5], [hx + 2, hy - 12], [hx - 2, hy - 15.5]], 2.2, { head: 0.02, tail: 0.75, dry: 0, a: 0.8 });
  const wf = (k) => Math.sin(S.t * 2.4 + ph + k);
  S.brush([[hx + 17, hy - 2], [hx + 12, hy + 6 + wf(0)], [hx + 2 - 3 * wind, hy + 10 + wf(1) * 2], [hx - 10 - 5 * wind, hy + 8 + wf(2) * 3]], 1.3, { head: 0.05, tail: 0.8, dry: 0 });
  S.brush([[hx + 15, hy - 3], [hx + 8, hy - 9 + wf(1)], [hx - 2 - 3 * wind, hy - 9 + wf(2) * 2], [hx - 12 - 5 * wind, hy - 4 + wf(3) * 3]], 1.1, { head: 0.05, tail: 0.8, dry: 0, a: 0.85 });
  for (let i = 0; i < 4; i++) S.brush([[hx - 4, hy - 3 + i * 2.5], [hx - 11 - 2 * wind, hy - 3 + i * 3.5 + wf(i) * 1.5], [hx - 17 - i - 3 * wind, hy + i * 4 + wf(i + 1) * 2]], 2.2, { head: 0.05, tail: 0.7, dry: 0.3 });
  S.line([[hx + 6, hy - 4.6], [hx + 11, hy - 4]], 0.6, { c: PAPER, a: 0.4, raw: true });
  S.dot(hx + 8.5, hy - 2.6, 1.5, { glow: true });
  if (cast) { S.wash(hx + 26, hy - 10, 9, 9, { c: S.acc, a: 0.5 }); S.dot(hx + 26, hy - 10, 3.2, { glow: true }); S.dot(hx + 25, hy - 11, 1, { c: PAPER, a: 0.9 }); }
  return POSE_LEAN[pose] ? POSE_LEAN[pose] * 0.7 : 0;
}

const BUILDERS = { humanoid, wolf, spider, puppet, toad, snake, golem, bird, beast, vine, wraith, jiao };

// ---------------------------------------------------------------- 构建与包围盒

function build(archetype, opts = {}) {
  const arch = BUILDERS[archetype] ? archetype : 'beast';
  const o = {
    seed: opts.seed ?? `${arch}:${opts.variant || ''}`,
    ink: opts.ink || PALETTE.ink0,
    accent: opts.accent || PALETTE.cinnabar,
    pose: opts.pose || 'idle',
    variant: opts.variant,
    t: opts.t || 0,
  };
  const S = new Sketch(o.seed, o);
  const lean = BUILDERS[arch](S, o) || 0;
  return { list: S.list, lean, arch };
}

function bboxOf(list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const s of list) {
    if (s.nb) continue;
    if (s.pts) for (const p of s.pts) add(p[0], p[1]);
    else if (s.k === 'ell') { const r = Math.max(s.rx, s.ry); add(s.x - r, s.y - r); add(s.x + r, s.y + r); }
    else if (s.k === 'dot') { add(s.x - s.r, s.y - s.r); add(s.x + s.r, s.y + s.r); }
  }
  if (x0 === Infinity) return { minX: -30, maxX: 30, minY: -100, maxY: 0 };
  return { minX: x0, maxX: x1, minY: y0, maxY: y1 };
}

const boundsCache = new Map();
/**
 * 剪影包围盒（模型单位，scale=1，朝右，idle）。原点为脚底中心。
 * @returns {{w:number, h:number, minX:number, maxX:number, minY:number, maxY:number}}
 */
export function silhouetteBounds(archetype, opts = {}) {
  const key = `${archetype}|${opts.variant || ''}|${opts.seed ?? ''}`;
  if (!boundsCache.has(key)) {
    const b = bboxOf(build(archetype, { ...opts, t: 0, pose: 'idle' }).list);
    boundsCache.set(key, { ...b, w: b.maxX - b.minX, h: b.maxY - b.minY });
  }
  return boundsCache.get(key);
}

// ---------------------------------------------------------------- Canvas 渲染

function canvasRender(ctx, list, glow) {
  const base = ctx.globalAlpha;
  for (const s of list) {
    ctx.globalAlpha = base * s.a;
    ctx.shadowBlur = glow && s.k === 'fill' ? 14 : 0;
    if (s.k === 'fill') {
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
      ctx.closePath();
      if (s.grad) {
        let y0 = Infinity, y1 = -Infinity;
        for (const p of s.pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, rgba(s.c, s.grad[0]));
        g.addColorStop(1, rgba(s.c, s.grad[1]));
        ctx.fillStyle = g;
      } else ctx.fillStyle = s.c;
      ctx.fill();
    } else if (s.k === 'line') {
      ctx.strokeStyle = s.c;
      ctx.lineWidth = s.w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
      if (s.closed) ctx.closePath();
      ctx.stroke();
    } else if (s.k === 'dot') {
      if (s.glow) {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
        g.addColorStop(0, rgba(s.c, 0.75));
        g.addColorStop(1, rgba(s.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    } else if (s.k === 'ell') {
      ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.rx, s.ry, s.rot, 0, TAU); ctx.fill();
    } else if (s.k === 'wash') {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(1, s.ry / s.rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.rx);
      g.addColorStop(0, rgba(s.c, 1));
      g.addColorStop(1, rgba(s.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s.rx, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = base;
  ctx.shadowBlur = 0;
}

/** 任意颜色（#hex / rgb / rgba）→ 指定不透明度的 rgba 串 */
function rgba(c, a) {
  if (c[0] === '#') {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7);
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return c;
  const [r, g, b, a0 = 1] = m[1].split(',').map((v) => parseFloat(v));
  return `rgba(${r},${g},${b},${+(a * a0).toFixed(3)})`;
}

/**
 * 在 Canvas 上绘制剪影，锚点为脚底中心 (x, y)。
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} archetype  humanoid | wolf | spider | puppet | toad | snake | golem | bird | beast | vine | wraith | jiao
 * @param {{seed?:any, scale?:number, ink?:string, accent?:string, x?:number, y?:number,
 *          pose?:'idle'|'attack'|'cast'|'hurt', variant?:string, facing?:1|-1, t?:number, alpha?:number, glow?:string|null}} opts
 *   variant：humanoid → male|female|sword|alchemist|talisman|wanderer|meditate；spider → scorpion；bird → bat；beast → turtle；puppet → wood|sword；wraith → demon|mist
 *   t：动画时间（秒），驱动衣袂、发丝、拍翅、呼吸；glow：柔光颜色（shadowColor）
 */
export function drawSilhouette(ctx, archetype, opts = {}) {
  const { scale = 1, x = 0, y = 0, facing = 1, alpha = 1, glow = null } = opts;
  const m = build(archetype, opts);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((facing < 0 ? -1 : 1) * scale, scale);
  if (m.lean) ctx.rotate(m.lean);
  ctx.globalAlpha *= alpha;
  if (glow) ctx.shadowColor = glow;
  canvasRender(ctx, m.list, glow);
  ctx.restore();
}

// ---------------------------------------------------------------- SVG 渲染

let UID = 0;
const f1 = (v) => Math.round(v * 10) / 10;
const dOf = (pts, closed) => 'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L') + (closed ? 'Z' : '');
const op = (attr, a) => (a < 1 ? ` ${attr}="${+a.toFixed(3)}"` : '');

function svgRender(list) {
  const defs = [];
  const radial = new Map();
  const radialId = (c, a0) => {
    const key = `${c}|${a0}`;
    if (!radial.has(key)) {
      const id = `sl${(++UID).toString(36)}`;
      radial.set(key, id);
      defs.push(`<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${a0}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
    }
    return radial.get(key);
  };
  const out = [];
  for (const s of list) {
    if (s.k === 'fill') {
      if (s.grad) {
        const id = `sl${(++UID).toString(36)}`;
        defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c}" stop-opacity="${+(s.a * s.grad[0]).toFixed(3)}"/><stop offset="1" stop-color="${s.c}" stop-opacity="${+(s.a * s.grad[1]).toFixed(3)}"/></linearGradient>`);
        out.push(`<path d="${dOf(s.pts, true)}" fill="url(#${id})"/>`);
      } else out.push(`<path d="${dOf(s.pts, true)}" fill="${s.c}"${op('fill-opacity', s.a)}/>`);
    } else if (s.k === 'line') {
      out.push(`<path d="${dOf(s.pts, s.closed)}" fill="none" stroke="${s.c}" stroke-width="${f1(s.w) || 0.3}" stroke-linecap="round" stroke-linejoin="round"${op('stroke-opacity', s.a)}/>`);
    } else if (s.k === 'dot') {
      if (s.glow) out.push(`<circle cx="${f1(s.x)}" cy="${f1(s.y)}" r="${f1(s.r * 4)}" fill="url(#${radialId(s.c, 0.75)})"/>`);
      out.push(`<circle cx="${f1(s.x)}" cy="${f1(s.y)}" r="${f1(s.r)}" fill="${s.c}"${op('fill-opacity', s.a)}/>`);
    } else if (s.k === 'ell') {
      const rot = s.rot ? ` transform="rotate(${f1((s.rot * 180) / Math.PI)} ${f1(s.x)} ${f1(s.y)})"` : '';
      out.push(`<ellipse cx="${f1(s.x)}" cy="${f1(s.y)}" rx="${f1(s.rx)}" ry="${f1(s.ry)}" fill="${s.c}"${op('fill-opacity', s.a)}${rot}/>`);
    } else if (s.k === 'wash') {
      out.push(`<ellipse cx="${f1(s.x)}" cy="${f1(s.y)}" rx="${f1(s.rx)}" ry="${f1(s.ry)}" fill="url(#${radialId(s.c, 1)})"${op('opacity', s.a)}/>`);
    }
  }
  return { defs: defs.join(''), body: out.join('') };
}

/**
 * 同一造型的 SVG 字符串（默认 viewBox 0 0 128 160，脚底中心在 (64,150)）。
 * @param {string} archetype
 * @param {{seed?, ink?, accent?, pose?, variant?, facing?:1|-1, t?:number,
 *          size?:number, width?:number, height?:number, crop?:'full'|'fit'|'bust', title?:string, className?:string}} opts
 *   crop：full = 固定 128×160 画幅；fit = 紧贴整体的正方形；bust = 上半身正方形（头像用）
 */
export function silhouetteSVG(archetype, opts = {}) {
  const { facing = 1, crop = 'full', title = '', className = 'silhouette' } = opts;
  const m = build(archetype, opts);
  const { defs, body } = svgRender(m.list);
  const fx = facing < 0 ? -1 : 1;
  const tf = `translate(${VB_GX} ${VB_GY}) scale(${VB_S * fx} ${VB_S})${m.lean ? ` rotate(${f1((m.lean * 180) / Math.PI)})` : ''}`;
  let vb = `0 0 ${VB_W} ${VB_H}`, square = false;
  if (crop === 'fit' || crop === 'bust') {
    const b = bboxOf(m.list);
    const corners = [[b.minX, b.minY], [b.maxX, b.minY], [b.minX, b.maxY], [b.maxX, b.maxY]].map((p) => {
      const r = rotAbout(p, m.lean);
      return [VB_GX + r[0] * VB_S * fx, VB_GY + r[1] * VB_S];
    });
    const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const w = x1 - x0, h = y1 - y0;
    let side, cx, top;
    if (crop === 'bust') {
      side = Math.min(h, Math.max(w * 0.72, h * 0.56));
      cx = (x0 + x1) / 4 + VB_GX / 2 + fx * side * 0.06;
      top = y0 - side * 0.05;
    } else {
      side = Math.max(w, h) * 1.06 + 4;
      cx = (x0 + x1) / 2;
      top = (y0 + y1) / 2 - side / 2;
    }
    vb = `${f1(cx - side / 2)} ${f1(top)} ${f1(side)} ${f1(side)}`;
    square = true;
  }
  const W = opts.width ?? opts.size ?? (square ? 64 : VB_W);
  const H = opts.height ?? (square ? W : opts.size ? (opts.size * VB_H) / VB_W : VB_H);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${f1(W)}" height="${f1(H)}" class="${className}">` +
    (title ? `<title>${esc(title)}</title>` : '') +
    (defs ? `<defs>${defs}</defs>` : '') +
    `<g transform="${tf}">${body}</g></svg>`;
}

// ---------------------------------------------------------------- 敌人 → 剪影参数

/**
 * 由敌人数据推导剪影参数：原型取 enemy.art，变体由名称关键字决定，点缀色取元素色，种子取 id。
 * @returns {{archetype:string, variant?:string, seed:string, accent:string}}
 */
export function enemySilhouette(enemy) {
  if (!enemy) return { archetype: 'beast', seed: 'unknown', accent: PALETTE.ink2 };
  // art 可写成 'humanoid' 或 'humanoid/wanderer'；也接受 enemy.variant / enemy.artVariant 显式指定
  const [art, artVar] = String(enemy.art || '').split(/[/:]/);
  const archetype = BUILDERS[art] ? art : 'beast';
  const nm = `${enemy.name || ''}${enemy.id || ''}`;
  const explicit = enemy.variant || enemy.artVariant || artVar;
  let variant;
  if (explicit && (VARIANTS[archetype] || []).includes(explicit)) variant = explicit;
  else if (archetype === 'humanoid') {
    variant = /散修|游|残魂/.test(nm) ? 'wanderer' : /剑/.test(nm) ? 'sword' : /丹|药/.test(nm) ? 'alchemist' : /符|堕道|魔/.test(nm) ? 'talisman' : /女|仙子|姬/.test(nm) ? 'female' : 'male';
  } else if (archetype === 'spider') variant = /蝎|xie/.test(nm) ? 'scorpion' : 'spider';
  else if (archetype === 'bird') variant = /蝠|bianfu/.test(nm) ? 'bat' : 'crow';
  else if (archetype === 'beast') variant = /鼋|龟|yuan_|gui_/.test(nm) && !/渊/.test(nm) ? 'turtle' : 'qilin';
  else if (archetype === 'puppet') variant = /剑/.test(nm) ? 'sword' : 'wood';
  else if (archetype === 'wraith') variant = /祟|雾|云海|sui/.test(nm) ? 'mist' : 'demon';
  return { archetype, variant, seed: enemy.id || enemy.name || archetype, accent: elementColor(enemy.element) };
}

/**
 * SVG 毛笔笔触路径（d 字符串）：与剪影同一套变宽笔触几何，供图标复用。
 * @param {Array<[number,number]>} pts 中心线控制点
 * @param {number} w 笔宽
 * @param {{w1?:number, head?:number, tail?:number, taper?:number, seed?:any, wobble?:number}} o
 */
export function inkStrokeD(pts, w, o = {}) {
  const seed = typeof o.seed === 'number' ? o.seed >>> 0 : hashSeed(o.seed ?? 1);
  return dOf(ribbon(pts, w, { ...o, seed }).poly, true);
}

/** 平滑闭合形的 SVG 路径（Catmull-Rom），供图标复用 */
export function smoothD(pts, closed = true) {
  return dOf(spline(pts, closed), closed);
}

// 角色与敌人剪影 —— drawSilhouette(ctx, archetype, opts)（ART_GUIDE §4）
// 每个原型是一个由比例参数驱动的小函数，比例从 seed 派生；共享 blob / limb / poly 三个笔墨基元。
// 坐标：原点在脚底中心，身高约 100 单位，向上为负；opts.scale 缩放，opts.facing = 1 朝右 / -1 朝左。
import { PALETTE, withAlpha } from './palette.js';
import { seededRandom, hashSeed } from './noise.js';

function blob(g, cx, cy, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2);
  g.fill();
}

/** 沿折线的变宽实心笔触（肢体、尾、藤） */
function limb(g, pts, w0, w1 = w0 * 0.5) {
  const n = pts.length;
  if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    L.push([pts[i][0] - (dy / len) * w, pts[i][1] + (dx / len) * w]);
    R.push([pts[i][0] + (dy / len) * w, pts[i][1] - (dx / len) * w]);
  }
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath();
  g.fill();
  blob(g, pts[0][0], pts[0][1], w0 / 2, w0 / 2);
}

function poly(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill();
}

/** 二次曲线连接的平滑闭合形 */
function smooth(g, pts) {
  g.beginPath();
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[n - 1], pts[0]);
  g.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    m = mid(p, q);
    g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  g.closePath();
  g.fill();
}

// 比例抖动：j(0.15) → [0.85, 1.15]
const jit = (r) => (k) => 1 + (r() - 0.5) * 2 * k;

// ---------------- 原型 ----------------
const ARCH = {
  humanoid(g, r, o) {
    const j = jit(r);
    const v = o.variant || ['male', 'female', 'sword', 'alchemist'][Math.floor(r() * 4)];
    const sway = Math.sin(o.t * 1.6) * 2;
    const ink = g.fillStyle;
    if (v === 'meditate') {
      // 盘坐：衣摆椭圆 + 身躯 + 头 + 发髻
      blob(g, 0, -6, 34 * j(0.08), 9);
      smooth(g, [[-30, -6], [-20, -30], [-12, -44], [12, -44], [20, -30], [30, -6]]);
      blob(g, 0, -54, 8.5, 9.5);
      blob(g, 0, -65, 4.5, 4);
      g.fillStyle = withAlpha(o.accent, 0.9);
      g.fillRect(-13, -33, 26, 3); // 腰带
      g.fillStyle = ink;
      limb(g, [[-14, -40], [-24, -24], [-6, -16]], 7, 5); // 袖
      limb(g, [[14, -40], [24, -24], [6, -16]], 7, 5);
      limb(g, [[3, -64], [14 + sway, -70], [24 + sway * 2, -66]], 1.6, 0.6); // 发带飘
      return;
    }
    const hem = (v === 'female' ? 40 : 34) * j(0.1);
    const sh = 13 * j(0.1);
    const hy = -84 * j(0.04);
    // 长袍
    smooth(g, [[-sh, -70], [sh, -70], [sh + 4, -40], [hem / 2 + sway, -2], [hem / 4, 0], [-hem / 4, 0], [-hem / 2 + sway * 0.6, -2], [-sh - 4, -40]]);
    // 头、发
    blob(g, 0, hy, 7.5, 8.5);
    if (v === 'female') {
      limb(g, [[-2, hy - 6], [-8, hy + 6], [-10 + sway, hy + 26]], 9, 3);
      blob(g, 3, hy - 9, 5, 3.5);
    } else {
      blob(g, 0, hy - 10, 4.5, 4);
      g.fillRect(-0.8, hy - 17, 1.6, 6); // 簪
    }
    // 腰带
    g.fillStyle = withAlpha(o.accent, 0.9);
    g.fillRect(-sh - 1, -48, sh * 2 + 2, 3.5);
    limb(g, [[sh - 2, -46], [sh + 6 + sway * 2, -30], [sh + 10 + sway * 3, -20]], 2.4, 1);
    g.fillStyle = ink;
    // 袖与手
    const armF = o.pose === 'attack' ? [[sh, -66], [sh + 20, -64], [sh + 34, -66]] : [[sh, -66], [sh + 8, -48], [sh + 6, -34]];
    limb(g, armF, 9, 6);
    limb(g, [[-sh, -66], [-sh - 8, -48], [-sh - 12 - sway, -30]], 9, 7);
    if (v === 'sword' || o.pose === 'attack') {
      const [hx, hyy] = armF[armF.length - 1];
      g.strokeStyle = withAlpha(PALETTE.ink0, 0.95);
      g.lineWidth = 2.2;
      g.beginPath();
      if (o.pose === 'attack') { g.moveTo(hx, hyy); g.lineTo(hx + 40, hyy - 6); } else { g.moveTo(hx - 4, hyy + 14); g.lineTo(hx + 10, hyy - 44); }
      g.stroke();
      g.strokeStyle = withAlpha(o.accent, 0.8);
      g.lineWidth = 1;
      g.stroke();
    } else if (v === 'alchemist') {
      blob(g, -sh - 2, -40, 4.5, 5.5);
      blob(g, -sh - 2, -48, 3, 3.2); // 腰间葫芦
    }
  },

  wolf(g, r, o) {
    const j = jit(r);
    const L = 62 * j(0.1), H = 40 * j(0.1);
    const step = Math.sin(o.t * 4) * 3;
    smooth(g, [[-L / 2, -H * 0.9], [-L * 0.1, -H * 1.05], [L * 0.35, -H * 1.1], [L * 0.5, -H * 0.75], [L * 0.35, -H * 0.5], [-L * 0.4, -H * 0.55]]);
    // 头与吻
    poly(g, [[L * 0.32, -H * 1.12], [L * 0.52, -H * 1.42], [L * 0.62, -H * 1.3], [L * 0.86, -H * 1.12], [L * 0.62, -H * 0.96], [L * 0.4, -H * 0.86]]);
    poly(g, [[L * 0.46, -H * 1.34], [L * 0.5, -H * 1.62], [L * 0.58, -H * 1.32]]); // 耳
    for (const [x, ph] of [[-L * 0.38, 0], [-L * 0.24, 1], [L * 0.26, 1], [L * 0.38, 0]]) {
      const s = ph ? step : -step;
      limb(g, [[x, -H * 0.62], [x + 2 + s, -H * 0.3], [x + s * 1.4, 0]], 6.5, 3.5);
    }
    limb(g, [[-L * 0.48, -H * 0.85], [-L * 0.7, -H * 0.8], [-L * 0.82, -H * 0.5 + step]], 8, 2); // 尾
    g.fillStyle = o.accent;
    blob(g, L * 0.64, -H * 1.2, 1.8, 1.4);
  },

  spider(g, r, o) {
    const j = jit(r);
    const ink = g.fillStyle;
    const tw = Math.sin(o.t * 5) * 2;
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 4; i++) {
      const a = -0.5 + i * 0.35;
      const kx = s * (18 + i * 6) * j(0.1), ky = -34 - (i % 2 ? tw : -tw);
      limb(g, [[s * 4, -18], [kx, ky + i * 3], [s * (30 + i * 7), -2 + a]], 3.5, 1.5);
    }
    blob(g, -16, -20, 20 * j(0.1), 15 * j(0.1)); // 腹
    blob(g, 8, -18, 10, 8.5); // 头胸
    g.fillStyle = o.accent;
    blob(g, -18, -24, 6, 3.5, 0.3);
    blob(g, 13, -20, 1.6, 1.6);
    blob(g, 15, -17, 1.4, 1.4);
    g.fillStyle = ink;
  },

  puppet(g, r, o) {
    const j = jit(r);
    const ink = g.fillStyle;
    const swing = Math.sin(o.t * 2.5) * 4;
    g.fillRect(-11, -72, 22, 30 * j(0.08)); // 躯干木块
    g.fillRect(-9, -88, 18, 14); // 方头
    g.fillRect(-12, -42, 24, 6); // 胯
    const joint = (x, y) => blob(g, x, y, 3.2, 3.2);
    for (const s of [-1, 1]) {
      limb(g, [[s * 13, -68], [s * 18, -54 + s * swing]], 6, 5); joint(s * 18, -54 + s * swing);
      limb(g, [[s * 18, -54 + s * swing], [s * 20 + swing, -38]], 5, 4);
      limb(g, [[s * 7, -38], [s * 9, -20]], 7, 6); joint(s * 9, -20);
      limb(g, [[s * 9, -20], [s * 8 - swing * 0.3, 0]], 6, 6);
    }
    g.strokeStyle = withAlpha(PALETTE.ink2, 0.6);
    g.lineWidth = 0.7;
    g.beginPath();
    for (const [x, y] of [[-20 - swing, -38], [0, -88], [20 + swing, -38]]) { g.moveTo(x, y); g.lineTo(x * 0.6, -130); }
    g.stroke();
    g.fillStyle = o.accent;
    g.fillRect(-5, -84, 3, 3); g.fillRect(2, -84, 3, 3);
    g.fillStyle = ink;
  },

  toad(g, r, o) {
    const j = jit(r);
    const ink = g.fillStyle;
    const br = 1 + Math.sin(o.t * 2) * 0.03;
    smooth(g, [[-30, -2], [-34 * j(0.1), -18], [-20, -34 * br], [10, -38 * br], [30, -26], [34, -8], [20, 0]]);
    blob(g, -6, -38, 7, 6); blob(g, 12, -39, 7, 6); // 眼丘
    limb(g, [[22, -12], [34, -4], [40, 0]], 7, 4);
    limb(g, [[-24, -10], [-36, -2], [-42, 0]], 9, 5);
    g.fillStyle = withAlpha(o.accent, 0.8);
    const rr = seededRandom(7);
    for (let i = 0; i < 7; i++) blob(g, -20 + rr() * 40, -26 + rr() * 18, 2 + rr() * 2, 1.6 + rr() * 1.5);
    g.fillStyle = PALETTE.paper;
    blob(g, -5, -40, 2, 2); blob(g, 13, -41, 2, 2);
    g.fillStyle = ink;
  },

  snake(g, r, o) {
    const j = jit(r);
    const pts = [];
    const ph = o.t * 2.2;
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      pts.push([-46 + u * 72, -6 - Math.sin(u * 6 + ph) * 8 * (1 - u * 0.3) - (u > 0.75 ? (u - 0.75) * 160 : 0)]);
    }
    pts.reverse();
    limb(g, pts, 16 * j(0.1), 3);
    const [hx, hy] = pts[0];
    blob(g, hx + 6, hy - 2, 11, 7, -0.2);
    g.fillStyle = o.accent;
    blob(g, hx + 9, hy - 5, 1.6, 1.6);
    g.strokeStyle = o.accent;
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(hx + 16, hy); g.lineTo(hx + 24, hy + Math.sin(o.t * 9) * 2); g.stroke();
  },

  golem(g, r, o) {
    const j = jit(r);
    const ink = g.fillStyle;
    const b = Math.sin(o.t * 1.5) * 1.5;
    smooth(g, [[-26, -84 + b], [26, -84 + b], [32, -52], [20, -34], [-20, -34], [-32, -52]]); // 躯
    blob(g, 0, -92 + b, 9, 8); // 头
    limb(g, [[-28, -78 + b], [-40, -54], [-38, -30]], 15, 18); // 臂
    limb(g, [[28, -78 + b], [40, -54], [38, -30]], 15, 18);
    limb(g, [[-12, -36], [-14, 0]], 16, 18);
    limb(g, [[12, -36], [14, 0]], 16, 18);
    g.strokeStyle = withAlpha(o.accent, 0.9);
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-8, -76); g.lineTo(2, -64); g.lineTo(-4, -52); g.lineTo(6, -42); g.stroke(); // 裂纹
    g.fillStyle = o.accent;
    blob(g, -3, -93 + b, 1.8, 1.4); blob(g, 4, -93 + b, 1.8, 1.4);
    g.fillStyle = ink;
  },

  bird(g, r, o) {
    const j = jit(r);
    const flap = Math.sin(o.t * 6);
    const ink = g.fillStyle;
    const cy = -54 + flap * 3;
    blob(g, 0, cy, 18 * j(0.1), 8, -0.15);
    blob(g, 18, cy - 6, 6.5, 6); // 头
    poly(g, [[23, cy - 8], [33, cy - 4], [23, cy - 3]]); // 喙
    // 双翼：羽片扇形，随拍动开合
    for (const s of [-1, 1]) {
      const span = 44 * j(0.1);
      const tipY = cy - 26 * (s > 0 ? flap : -flap * 0.6) - 10;
      const feathers = [];
      for (let i = 0; i <= 5; i++) feathers.push([-6 - (i / 5) * span * 0.9, tipY + (i / 5) * (cy - tipY) * 0.9 + (i % 2) * 4]);
      poly(g, [[6, cy - 2], [-2, cy - 4], ...feathers, [-10, cy + 2]]);
    }
    poly(g, [[-16, cy], [-36, cy + 8], [-32, cy + 2], [-38, cy - 2]]); // 尾羽
    g.fillStyle = o.accent;
    poly(g, [[16, cy - 11], [12, cy - 20], [20, cy - 12]]); // 冠
    blob(g, 20, cy - 7, 1.4, 1.4);
    g.fillStyle = ink;
    limb(g, [[2, cy + 6], [4, 0]], 1.4, 1);
  },

  beast(g, r, o) {
    const j = jit(r);
    const ink = g.fillStyle;
    const L = 78 * j(0.12), H = 52 * j(0.1);
    const breathe = Math.sin(o.t * 1.8) * 1.5;
    const shell = r() < 0.35; // 一部分兽形带甲壳（如鼋）
    if (shell) {
      smooth(g, [[-L * 0.5, -H * 0.35], [-L * 0.35, -H * 0.95 - breathe], [L * 0.25, -H - breathe], [L * 0.45, -H * 0.4], [0, -H * 0.25]]);
      blob(g, L * 0.55, -H * 0.5, 9, 7);
    } else {
      smooth(g, [[-L * 0.48, -H * 0.5], [-L * 0.3, -H * 0.95 - breathe], [L * 0.2, -H * 1.05 - breathe], [L * 0.45, -H * 0.9], [L * 0.4, -H * 0.45], [-L * 0.4, -H * 0.4]]);
      smooth(g, [[L * 0.35, -H * 1.1], [L * 0.6, -H * 1.15], [L * 0.72, -H * 0.85], [L * 0.5, -H * 0.7]]); // 头
      poly(g, [[L * 0.5, -H * 1.1], [L * 0.44, -H * 1.5], [L * 0.58, -H * 1.12]]); // 角
      for (let i = 0; i < 5; i++) poly(g, [[-L * 0.3 + i * L * 0.12, -H * 0.95], [-L * 0.25 + i * L * 0.12, -H * 1.2 - (i % 2) * 6], [-L * 0.2 + i * L * 0.12, -H * 0.98]]); // 鬃刺
      limb(g, [[-L * 0.46, -H * 0.7], [-L * 0.66, -H * 0.9], [-L * 0.72, -H * 1.1]], 9, 3);
    }
    for (const x of [-L * 0.33, -L * 0.18, L * 0.18, L * 0.32]) limb(g, [[x, -H * 0.5], [x + 2, 0]], 11, 12);
    g.fillStyle = o.accent;
    blob(g, shell ? L * 0.6 : L * 0.6, shell ? -H * 0.53 : -H * 0.98, 2.2, 1.6);
    if (shell) { g.globalAlpha = 0.5; for (let i = 0; i < 4; i++) blob(g, -L * 0.25 + i * L * 0.15, -H * 0.7, 6, 4); g.globalAlpha = 1; }
    g.fillStyle = ink;
  },

  vine(g, r, o) {
    const j = jit(r);
    const ink = g.fillStyle;
    const n = 3 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const pts = [];
      const base = (k - (n - 1) / 2) * 14;
      const hgt = (70 + r() * 30) * j(0.1);
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        pts.push([base + Math.sin(u * 5 + k + o.t * 1.4) * 10 * u, -u * hgt]);
      }
      limb(g, pts, 7, 2);
      for (let i = 2; i < 10; i += 2) { const [x, y] = pts[i]; poly(g, [[x, y], [x + (i % 4 ? 6 : -6), y - 2], [x, y - 4]]); } // 刺
      if (k === Math.floor(n / 2)) {
        const [tx, ty] = pts[10];
        g.fillStyle = o.accent;
        for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2 + o.t * 0.5; blob(g, tx + Math.cos(a) * 6, ty + Math.sin(a) * 6, 5, 3, a); }
        g.fillStyle = ink;
        blob(g, tx, ty, 3.5, 3.5);
      }
    }
    blob(g, 0, -2, 30, 5);
  },
};

export const ARCHETYPES = Object.keys(ARCH);

/**
 * 绘制剪影。
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} archetype  humanoid | wolf | spider | puppet | toad | snake | golem | bird | beast | vine
 * @param {{seed?:any, scale?:number, ink?:string, accent?:string, x?:number, y?:number, facing?:1|-1, variant?:string, pose?:string, t?:number, alpha?:number, glow?:string}} opts
 */
export function drawSilhouette(ctx, archetype, opts = {}) {
  const fn = ARCH[archetype] || ARCH.beast;
  const { seed = archetype, scale = 1, ink = PALETTE.ink0, accent = PALETTE.cinnabar, x = 0, y = 0, facing = 1, alpha = 1, glow = null } = opts;
  const r = seededRandom(hashSeed(seed));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);
  ctx.globalAlpha *= alpha;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 14; }
  // 地面墨影
  ctx.fillStyle = withAlpha(PALETTE.ink0, 0.18);
  blob(ctx, 0, 1, 30, 4);
  ctx.fillStyle = ink;
  fn(ctx, r, { ...opts, accent, t: opts.t || 0 });
  ctx.restore();
}

/** 剪影的大致包围盒（单位尺寸，供布局） */
export function silhouetteBounds(archetype) {
  return { bird: { w: 90, h: 90 }, snake: { w: 90, h: 60 }, toad: { w: 84, h: 46 }, spider: { w: 80, h: 44 }, beast: { w: 110, h: 80 }, wolf: { w: 100, h: 66 }, vine: { w: 70, h: 100 }, golem: { w: 90, h: 104 }, puppet: { w: 50, h: 100 } }[archetype] || { w: 60, h: 100 };
}

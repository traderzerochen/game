// 特效系统：灵气粒子 / 突破汇聚、剑光拖尾、法术爆发、雷劫闪电 + 墨晕散、治疗光环（ART_GUIDE §4、§6）
// 受档位控制：粒子上限、模糊、闪电分叉、墨晕。
import { PALETTE, withAlpha } from './palette.js';
import { tier as tierOf } from './tiers.js';

export const GLOW = { gold: PALETTE.glowGold, cyan: PALETTE.glowCyan, red: PALETTE.glowRed };

/** 雷劫主题：外辉、雷芯、闪屏色 */
export const BOLT_THEMES = {
  default: { glow: GLOW.cyan, core: 'rgba(255,255,255,.95)', flash: '255,250,235' },
  zixiao: { glow: 'rgba(190,140,255,.85)', core: 'rgba(250,240,255,.95)', flash: '236,222,255' },
  jiuyou: { glow: 'rgba(90,140,255,.85)', core: 'rgba(215,232,255,.95)', flash: '196,214,255' },
  dengqiong: { glow: GLOW.gold, core: 'rgba(255,255,246,1)', flash: '255,246,222' },
};
const rgba = (c, a) => c.replace(/[\d.]+\)$/, `${Math.max(0, Math.min(1, a)).toFixed(3)})`);

/** 五行 → 柔光色（金、青、赤三色） */
export function glowFor(el) {
  if (el === 'fire' || el === 'earth') return GLOW.red;
  if (el === 'water' || el === 'wood') return GLOW.cyan;
  return GLOW.gold;
}

export function createFx(quality = 'mid') {
  let T = tierOf(quality);
  const parts = [];   // 点粒子 {x,y,vx,vy,life,age,r,color,kind,tx,ty}
  const trails = [];  // 剑光 {pts, age, life, color, w}
  const bolts = [];   // 闪电 {paths:[[x,y]...], age, life}
  const rings = [];   // 光环 / 冲击波 {x,y,r0,r1,age,life,color,w}
  const blots = [];   // 墨晕 {x,y,r,age,life}
  let flash = 0, flashColor = '255,255,255';
  let shake = 0;

  function add(p) {
    if (parts.length >= T.particles) parts.shift();
    parts.push(p);
  }

  return {
    setQuality(q) { T = tierOf(q); while (parts.length > T.particles) parts.shift(); },
    get count() { return parts.length; },
    get shake() { return shake; },

    /** 打坐时持续的灵气汇聚：rate 为每秒生成数（会按档位缩放） */
    ambient(cx, cy, rate, dt, spread = 220) {
      const n = rate * dt * (T.particles / 150);
      let k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      while (k-- > 0) {
        const a = Math.random() * Math.PI * 2, d = spread * (0.4 + Math.random() * 0.6);
        add({ kind: 'seek', x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.55, tx: cx, ty: cy, vx: 0, vy: 0, age: 0, life: 2 + Math.random() * 2.5, r: 0.8 + Math.random() * 1.8, color: Math.random() < 0.55 ? GLOW.gold : GLOW.cyan });
      }
    },

    /** 突破：大量灵气向中心汇聚，随后一圈金色冲击波 */
    gather(cx, cy, { color = GLOW.gold, spread = 320 } = {}) {
      const n = Math.round(T.particles * 0.8);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, d = spread * (0.5 + Math.random() * 0.7);
        add({ kind: 'seek', fast: true, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.6, tx: cx, ty: cy, vx: 0, vy: 0, age: 0, life: 1.2 + Math.random() * 0.6, r: 1 + Math.random() * 2.2, color: i % 3 ? color : GLOW.cyan });
      }
      rings.push({ x: cx, y: cy, r0: 10, r1: spread * 0.9, age: -1.1, life: 0.9, color, w: 6 });
    },

    /** 剑光拖尾：沿弧线的渐隐柔光笔触 */
    swordTrail(x0, y0, x1, y1, { color = GLOW.cyan, arc = 0.35, w = 7 } = {}) {
      const pts = [];
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const nx = -(y1 - y0) * arc, ny = (x1 - x0) * arc;
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (mx + nx) + t * t * x1;
        const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (my + ny) + t * t * y1;
        pts.push([bx, by]);
      }
      trails.push({ pts, age: 0, life: 0.45, color, w });
      for (let i = 0; i < Math.min(14, T.particles / 10); i++) {
        const p = pts[Math.floor(Math.random() * pts.length)];
        add({ kind: 'spark', x: p[0], y: p[1], vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.7) * 80, age: 0, life: 0.5 + Math.random() * 0.4, r: 0.8 + Math.random() * 1.2, color });
      }
    },

    /** 法术爆发：放射粒子 + 冲击环 */
    burst(x, y, { color = GLOW.red, power = 1 } = {}) {
      const n = Math.round(Math.min(T.particles * 0.3, 60) * power);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160 * power;
        add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, life: 0.5 + Math.random() * 0.5, r: 1 + Math.random() * 2, color });
      }
      rings.push({ x, y, r0: 6, r1: 70 * power, age: 0, life: 0.45, color, w: 4 });
    },

    /** 治疗光环：上升的青色光点 + 柔和光圈 */
    heal(x, y) {
      rings.push({ x, y, r0: 20, r1: 46, age: 0, life: 0.9, color: GLOW.cyan, w: 3 });
      for (let i = 0; i < Math.min(30, T.particles / 5); i++) add({ kind: 'rise', x: x + (Math.random() - 0.5) * 50, y: y + Math.random() * 20, vx: 0, vy: -30 - Math.random() * 40, age: 0, life: 0.8 + Math.random() * 0.6, r: 1 + Math.random() * 1.5, color: GLOW.cyan });
    },

    /** 雷劫闪电：主干 + 分叉（档位决定分叉数），全屏闪白、震屏，落点墨晕散开 */
    lightning(x0, y0, x1, y1, { power = 1, theme = 'default', branches = null } = {}) {
      const th = BOLT_THEMES[theme] || BOLT_THEMES.default;
      const paths = [jag(x0, y0, x1, y1, 6)];
      const nb = Math.max(1, Math.min(T.bolts, branches ?? T.bolts)); // 档位决定上限
      for (let b = 1; b < nb; b++) {
        const src = paths[0][Math.floor(paths[0].length * (0.15 + Math.random() * 0.6))];
        const ang = Math.atan2(y1 - y0, x1 - x0) + (Math.random() - 0.5) * 1.8;
        const len = Math.hypot(x1 - x0, y1 - y0) * (0.2 + Math.random() * 0.35);
        paths.push(jag(src[0], src[1], src[0] + Math.cos(ang) * len, src[1] + Math.sin(ang) * len, 4));
      }
      bolts.push({ paths, age: 0, life: 0.5 + 0.1 * power, glow: th.glow, core: th.core, w: 1 + 0.25 * (power - 1) });
      flash = Math.min(1, 0.5 + 0.3 * power);
      flashColor = th.flash;
      shake = Math.max(shake, 0.3 * power);
      blots.push({ x: x1, y: y1, r: 50 + 40 * power, age: 0, life: T.inkBloom ? 2.4 : 1.4 });
      if (T.inkBloom) for (let i = 0; i < 3; i++) blots.push({ x: x1 + (Math.random() - 0.5) * 120, y: y1 + (Math.random() - 0.3) * 40, r: 30 + Math.random() * 40, age: -0.15 * i, life: 2 });
      this.burst(x1, y1, { color: theme === 'default' ? GLOW.gold : th.glow, power: 0.8 * power });
    },

    /** 上升光尘（飞升接引） */
    rise(x, y, { color = GLOW.gold, spread = 80, n = 4 } = {}) {
      for (let i = 0; i < n * (T.particles / 150); i++) add({ kind: 'rise', x: x + (Math.random() - 0.5) * spread, y: y + Math.random() * 30, vx: (Math.random() - 0.5) * 10, vy: -40 - Math.random() * 60, age: 0, life: 1.5 + Math.random() * 1.5, r: 1 + Math.random() * 1.8, color });
    },

    /** 屏幕闪色（如丹成、结局） */
    flash(alpha = 0.5, color = '255,240,200') { flash = Math.max(flash, alpha); flashColor = color; },

    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.kind === 'seek') {
          const k = Math.min(1, dt * (p.fast ? 3.2 : 0.9));
          p.x += (p.tx - p.x) * k;
          p.y += (p.ty - p.y) * k - dt * (p.fast ? 0 : 5);
          if (Math.hypot(p.tx - p.x, p.ty - p.y) < 6) p.age = p.life;
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.kind === 'spark') { p.vx *= 1 - dt * 2.5; p.vy = p.vy * (1 - dt * 2.5) + 60 * dt; }
        }
        if (p.age >= p.life) parts.splice(i, 1);
      }
      for (const arr of [trails, bolts, rings, blots]) for (let i = arr.length - 1; i >= 0; i--) { arr[i].age += dt; if (arr[i].age >= arr[i].life) arr.splice(i, 1); }
      flash = Math.max(0, flash - dt * 2.2);
      shake = Math.max(0, shake - dt);
    },

    draw(ctx, W, H) {
      ctx.save();
      // 墨晕（在光效之下）
      for (const b of blots) {
        if (b.age < 0) continue;
        const u = b.age / b.life;
        const r = b.r * (0.4 + u * 1.4);
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
        const a = 0.55 * (1 - u);
        g.addColorStop(0, withAlpha(PALETTE.ink0, a));
        g.addColorStop(0.55, withAlpha(PALETTE.ink1, a * 0.5));
        g.addColorStop(1, withAlpha(PALETTE.ink1, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      const blur = T.blur;
      // 粒子
      for (const p of parts) {
        const u = p.age / p.life;
        const a = Math.sin(Math.min(1, u) * Math.PI) * 0.9;
        if (blur) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          g.addColorStop(0, rgba(p.color, a));
          g.addColorStop(1, rgba(p.color, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = rgba(p.color, a);
          ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
      }
      // 剑光
      for (const tr of trails) {
        const u = tr.age / tr.life;
        const n = tr.pts.length;
        const head = Math.min(n - 1, Math.floor((u * 2.2) * (n - 1))); // 先划出，再淡去
        const tail = Math.max(0, Math.floor((u * 2.2 - 0.8) * (n - 1)));
        for (let i = Math.max(1, tail); i <= head; i++) {
          const k = (i - tail) / Math.max(1, head - tail);
          ctx.strokeStyle = rgba(tr.color, (1 - u) * (0.3 + 0.7 * k));
          ctx.lineWidth = tr.w * (0.25 + 0.75 * k) * (blur ? 1 : 0.7);
          ctx.lineCap = 'round';
          if (blur) { ctx.shadowColor = tr.color; ctx.shadowBlur = 12; }
          ctx.beginPath(); ctx.moveTo(tr.pts[i - 1][0], tr.pts[i - 1][1]); ctx.lineTo(tr.pts[i][0], tr.pts[i][1]); ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
      // 光环
      for (const rg of rings) {
        if (rg.age < 0) continue;
        const u = rg.age / rg.life;
        ctx.strokeStyle = rgba(rg.color, (1 - u) * 0.8);
        ctx.lineWidth = rg.w * (1 - u * 0.6);
        ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r0 + (rg.r1 - rg.r0) * easeOut(u), 0, Math.PI * 2); ctx.stroke();
      }
      // 闪电
      for (const bt of bolts) {
        const u = bt.age / bt.life;
        const flick = u < 0.15 || (u > 0.25 && u < 0.35) ? 1 : 0.45;
        bt.paths.forEach((path, i) => {
          for (const [w, c] of blur ? [[9, bt.glow], [2.5, bt.core]] : [[2.5, bt.core]]) {
            ctx.strokeStyle = rgba(c, (1 - u) * flick * (i ? 0.7 : 1));
            ctx.lineWidth = w * (i ? 0.6 : 1) * bt.w;
            if (blur && w > 3) { ctx.shadowColor = bt.glow; ctx.shadowBlur = 18; }
            ctx.beginPath();
            ctx.moveTo(path[0][0], path[0][1]);
            for (let k = 1; k < path.length; k++) ctx.lineTo(path[k][0], path[k][1]);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        });
      }
      ctx.restore();
      if (flash > 0) {
        ctx.fillStyle = `rgba(${flashColor},${(flash * 0.8).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    },

    clear() { parts.length = trails.length = bolts.length = rings.length = blots.length = 0; flash = 0; shake = 0; },
  };
}

const easeOut = (u) => 1 - (1 - u) * (1 - u);

/** 中点位移生成锯齿闪电路径 */
export function jagPath(x0, y0, x1, y1, depth) { return jag(x0, y0, x1, y1, depth); }
function jag(x0, y0, x1, y1, depth) {
  let pts = [[x0, y0], [x1, y1]];
  let amp = Math.hypot(x1 - x0, y1 - y0) * 0.18;
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
      const off = (Math.random() - 0.5) * 2 * amp;
      next.push([(ax + bx) / 2 - (dy / l) * off, (ay + by) / 2 + (dx / l) * off], pts[i]);
    }
    pts = next;
    amp *= 0.55;
  }
  return pts;
}

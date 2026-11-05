// 秘境 / 主界面 / 渡劫场景 —— renderScene(ctx, sceneKey, t, quality, size)
// 场景由下方 SCENES 数据描述，统一由一个构建器预渲染成离屏层，按时间平移（ART_GUIDE §5）。
import { PALETTE, withAlpha, mix } from './palette.js';
import { hashSeed, seededRandom } from './noise.js';
import { drawMountainLayer } from './mountains.js';
import { drawCloudBand, drawPine, drawRock, drawBamboo, drawWaterfallFlow, drawPavilion, drawStalactites, drawWater, drawDeadTree, drawStars, drawCrater, drawStele, drawFloatingIsland, drawSkyCrack, drawHeavenGate } from './scenery.js';
import { jagPath } from './fx.js';
import { tier as tierOf } from './tiers.js';

const P = PALETTE;
const SPEED = 20; // 层速系数（px/s）；层速 0.05 / 0.15 / 0.3 / 0.6 依 ART_GUIDE §5

// 渡劫场景族：一个构建器按主题派生（初雷/三九 = 墨色，紫霄 = 紫，九幽 = 幽蓝，登穹 = 金白 + 天门）
export const TRIB_THEMES = {
  default: { sky: ['#4a4744', '#8d877c'], cloud: ['#2a2826', '#1d1b19'], mtn: [P.ink1, P.ink0], rain: 'rgba(207,200,184,.35)' },
  zixiao: { sky: ['#3d3446', '#857a8e'], cloud: ['#2b2233', '#1f1826'], mtn: ['#2e2836', '#1d1820'], rain: 'rgba(215,200,235,.35)' },
  jiuyou: { sky: ['#1f2a38', '#566477'], cloud: ['#141c27', '#0f151d'], mtn: ['#1c2430', '#10151c'], rain: 'rgba(170,195,235,.35)' },
  dengqiong: { sky: ['#6e6658', '#d9cfb6'], cloud: ['#4a4438', '#3b362c'], mtn: ['#3b3833', '#2a2723'], rain: 'rgba(255,240,200,.3)', gate: true },
  ascension: { sky: ['#e9dcb8', '#f6f0e1'], cloud: ['#f8f0dc', '#fff8e8'], mtn: [P.ink3, P.ink2], rain: null, gate: true, light: true },
};
function tribScene(theme) {
  const T = TRIB_THEMES[theme];
  return {
    name: theme === 'ascension' ? '天门' : '雷劫', sky: T.sky, dark: !T.light, gate: !!T.gate,
    layers: [
      { kind: 'clouds', y: 0.12, thick: 0.14, speed: 0.15, minTier: 'low', alpha: 0.85, color: T.cloud[0] },
      { kind: 'mountain', ink: T.mtn[0], y: 0.62, height: 0.32, peaks: 4, blur: 4, speed: 0.05, minTier: 'low', sharp: 2 },
      { kind: 'clouds', y: 0.26, thick: 0.1, speed: 0.3, minTier: 'mid', alpha: 0.7, color: T.cloud[1] },
      { kind: 'mountain', ink: T.mtn[1], y: 0.82, height: 0.2, peaks: 3, blur: 1, speed: 0.15, minTier: 'mid' },
      { kind: 'props', speed: 0, minTier: 'low', items: [{ type: 'rock', x: 0.5, y: 0.92, size: 0.2, ink: T.mtn[1] }] },
      { kind: 'clouds', y: 0.95, thick: 0.05, speed: 0.6, minTier: 'high', alpha: 0.4, color: T.light ? '#fff6e0' : T.cloud[0] },
    ],
    ambient: T.rain ? 'rain' : 'stardust', rainColor: T.rain,
  };
}
function tribScenes() {
  const out = {};
  for (const k of Object.keys(TRIB_THEMES)) out[k === 'default' ? 'tribulation' : k === 'ascension' ? 'ascension' : `tribulation_${k}`] = tribScene(k);
  return out;
}

// minTier：该层在哪一档及以上才出现。low 仅 2 个视差层，mid 4 层，high 5 层。
// kind: mountain | clouds | props（前景元素）| static（不平移，含飞瀑等）
export const SCENES = {
  home: {
    name: '潮生后山', sky: ['#f7f2e6', '#efe6d2'], sun: { x: 0.78, y: 0.2, r: 34, color: P.cinnabar, alpha: 0.18 },
    layers: [
      { kind: 'mountain', ink: P.ink4, y: 0.5, height: 0.32, peaks: 3, blur: 6, speed: 0.05, minTier: 'low' },
      { kind: 'mountain', ink: P.ink3, y: 0.64, height: 0.26, peaks: 4, blur: 3, speed: 0.15, minTier: 'mid', texture: 0.4 },
      { kind: 'static', items: [{ type: 'cliffFall', x: 0.16, y: 0.7, size: 0.42 }], minTier: 'mid' },
      { kind: 'clouds', y: 0.6, thick: 0.08, speed: 0.3, minTier: 'mid', alpha: 0.85 },
      { kind: 'props', speed: 0.6, minTier: 'low', items: [
        { type: 'rock', x: 0.5, y: 0.9, size: 0.14 }, { type: 'pine', x: 0.82, y: 0.92, size: 0.42 },
        { type: 'rock', x: 0.88, y: 0.95, size: 0.1 }, { type: 'pine', x: 0.3, y: 0.95, size: 0.24 } ] },
      { kind: 'clouds', y: 0.97, thick: 0.06, speed: 0.6, minTier: 'high', alpha: 0.6 },
    ],
    ambient: 'qi',
  },
  mist_valley: {
    name: '雾栖谷', sky: ['#eef0e8', '#e2e4d8'], tint: P.malachite,
    layers: [
      { kind: 'mountain', ink: mix(P.ink4, P.malachite, 0.15), y: 0.48, height: 0.3, peaks: 5, blur: 6, speed: 0.05, minTier: 'low', sharp: 1.8 },
      { kind: 'clouds', y: 0.46, thick: 0.1, speed: 0.15, minTier: 'mid', alpha: 0.9 },
      { kind: 'mountain', ink: mix(P.ink3, P.malachite, 0.2), y: 0.66, height: 0.3, peaks: 6, blur: 3, speed: 0.15, minTier: 'mid', sharp: 2 },
      { kind: 'clouds', y: 0.66, thick: 0.1, speed: 0.3, minTier: 'mid', alpha: 0.95 },
      { kind: 'props', speed: 0.6, minTier: 'low', items: [
        { type: 'deadTree', x: 0.12, y: 0.96, size: 0.5 }, { type: 'rock', x: 0.2, y: 0.97, size: 0.12 },
        { type: 'pine', x: 0.9, y: 0.97, size: 0.34 }, { type: 'rock', x: 0.66, y: 0.98, size: 0.08 } ] },
      { kind: 'clouds', y: 0.92, thick: 0.08, speed: 0.6, minTier: 'high', alpha: 0.7 },
    ],
    ambient: 'mist',
  },
  cold_cave: {
    name: '寒潭洞', sky: ['#c9d2d6', '#e4e7e2'], tint: P.azurite,
    layers: [
      { kind: 'mountain', ink: mix(P.ink3, P.azurite, 0.25), y: 0.62, height: 0.3, peaks: 4, blur: 6, speed: 0.05, minTier: 'low' },
      { kind: 'static', items: [{ type: 'water', y: 0.78, h: 0.22, ink: P.azurite }], minTier: 'mid' },
      { kind: 'mountain', ink: mix(P.ink2, P.azurite, 0.2), y: 0.8, height: 0.24, peaks: 5, blur: 2, speed: 0.15, minTier: 'mid', sharp: 2.2 },
      { kind: 'static', items: [{ type: 'stalactites', maxLen: 0.28, ink: P.ink1 }], minTier: 'low' },
      { kind: 'props', speed: 0.6, minTier: 'mid', items: [{ type: 'rock', x: 0.15, y: 0.99, size: 0.16 }, { type: 'rock', x: 0.86, y: 1, size: 0.2 }] },
      { kind: 'clouds', y: 0.9, thick: 0.05, speed: 0.3, minTier: 'high', alpha: 0.5, color: '#eef4f6' },
    ],
    ambient: 'snow',
  },
  bell_hall: {
    name: '沉钟古殿', sky: ['#f2e9d6', '#e8d9bb'], sun: { x: 0.3, y: 0.24, r: 40, color: P.gamboge, alpha: 0.2 }, tint: P.ochre,
    layers: [
      { kind: 'mountain', ink: mix(P.ink4, P.ochre, 0.15), y: 0.5, height: 0.28, peaks: 3, blur: 6, speed: 0.05, minTier: 'low' },
      { kind: 'mountain', ink: mix(P.ink3, P.ochre, 0.15), y: 0.68, height: 0.22, peaks: 4, blur: 3, speed: 0.15, minTier: 'mid', texture: 0.5 },
      { kind: 'static', items: [{ type: 'pavilion', x: 0.7, y: 0.66, size: 0.34, tiers: 3, bell: true }], minTier: 'low' },
      { kind: 'clouds', y: 0.68, thick: 0.07, speed: 0.3, minTier: 'mid', alpha: 0.85 },
      { kind: 'props', speed: 0.6, minTier: 'mid', items: [{ type: 'pine', x: 0.12, y: 0.98, size: 0.46 }, { type: 'rock', x: 0.4, y: 0.99, size: 0.1 }] },
      { kind: 'clouds', y: 0.95, thick: 0.06, speed: 0.6, minTier: 'high', alpha: 0.6 },
    ],
    ambient: 'leaves',
  },
  red_gorge: {
    name: '赤砂火峡', sky: ['#f3dfcc', '#ebcdb1'], sun: { x: 0.55, y: 0.18, r: 46, color: P.cinnabar, alpha: 0.28 }, tint: P.cinnabar,
    layers: [
      { kind: 'mountain', ink: mix(P.ink4, P.cinnabar, 0.25), y: 0.52, height: 0.36, peaks: 6, blur: 6, speed: 0.05, minTier: 'low', sharp: 2.4 },
      { kind: 'mountain', ink: mix(P.ink2, P.ochre, 0.4), y: 0.8, height: 0.42, peaks: 4, blur: 2, speed: 0.15, minTier: 'mid', sharp: 1.5, texture: 0.6 },
      { kind: 'clouds', y: 0.62, thick: 0.05, speed: 0.3, minTier: 'mid', alpha: 0.5, color: '#f6e3d2' },
      { kind: 'props', speed: 0.6, minTier: 'low', items: [{ type: 'deadTree', x: 0.82, y: 0.97, size: 0.46 }, { type: 'rock', x: 0.22, y: 0.98, size: 0.18, ink: mix(P.ink1, P.cinnabar, 0.2) }] },
      { kind: 'clouds', y: 0.98, thick: 0.05, speed: 0.6, minTier: 'high', alpha: 0.45, color: '#f6e3d2' },
    ],
    ambient: 'embers',
  },
  clear_spring: {
    name: '澄泉秘境', sky: ['#eef3ee', '#e1ebe4'], tint: P.azurite,
    layers: [
      { kind: 'mountain', ink: mix(P.ink4, P.azurite, 0.2), y: 0.5, height: 0.26, peaks: 3, blur: 6, speed: 0.05, minTier: 'low', sharp: 1.1 },
      { kind: 'mountain', ink: mix(P.ink3, P.malachite, 0.3), y: 0.64, height: 0.2, peaks: 4, blur: 3, speed: 0.15, minTier: 'mid', sharp: 1.2 },
      { kind: 'static', items: [{ type: 'cliffFall', x: 0.8, y: 0.68, size: 0.4 }, { type: 'water', y: 0.74, h: 0.26, ink: P.azurite }], minTier: 'low' },
      { kind: 'clouds', y: 0.62, thick: 0.06, speed: 0.3, minTier: 'mid', alpha: 0.8 },
      { kind: 'props', speed: 0.6, minTier: 'mid', items: [{ type: 'bamboo', x: 0.08, y: 1, size: 0.7 }, { type: 'bamboo', x: 0.13, y: 1, size: 0.55 }, { type: 'rock', x: 0.4, y: 1, size: 0.1 }] },
      { kind: 'clouds', y: 0.96, thick: 0.05, speed: 0.6, minTier: 'high', alpha: 0.55 },
    ],
    ambient: 'fireflies',
  },
  star_waste: {
    name: '星陨荒原', sky: ['#262c38', '#5a6170'], dark: true, stars: 160,
    sun: { x: 0.8, y: 0.16, r: 22, color: '#e8e4d6', alpha: 0.32 },
    layers: [
      { kind: 'mountain', ink: '#3a404c', y: 0.6, height: 0.16, peaks: 4, blur: 6, speed: 0.05, minTier: 'low', sharp: 1.2, texture: 0.1 },
      { kind: 'clouds', y: 0.58, thick: 0.05, speed: 0.15, minTier: 'mid', alpha: 0.35, color: '#8a90a0' },
      { kind: 'mountain', ink: '#2a2f39', y: 0.76, height: 0.1, peaks: 5, blur: 2, speed: 0.15, minTier: 'mid', sharp: 1.1, texture: 0.2 },
      { kind: 'static', minTier: 'low', items: [
        { type: 'crater', x: 0.3, y: 0.86, size: 0.5 }, { type: 'crater', x: 0.78, y: 0.8, size: 0.32 },
        { type: 'stele', x: 0.16, y: 0.97, size: 0.34, tilt: -0.22 }, { type: 'stele', x: 0.88, y: 0.96, size: 0.26, tilt: 0.3 } ] },
      { kind: 'clouds', y: 0.97, thick: 0.05, speed: 0.6, minTier: 'high', alpha: 0.3, color: '#9aa0ae' },
    ],
    ambient: 'stardust', events: ['meteors'],
  },
  void_sea: {
    name: '归墟云海', sky: ['#c9ccd0', '#eceae3'], crack: true,
    layers: [
      { kind: 'clouds', y: 0.16, thick: 0.12, speed: 0.05, minTier: 'low', alpha: 0.85, color: '#55565a' },
      { kind: 'props', speed: 0.15, minTier: 'mid', items: [{ type: 'island', x: 0.22, y: 0.42, size: 0.32, pines: 1, ink: P.ink3 }, { type: 'island', x: 0.74, y: 0.3, size: 0.2, pines: 0, ink: P.ink3 }] },
      { kind: 'clouds', y: 0.6, thick: 0.12, speed: 0.15, minTier: 'low', alpha: 0.95 },
      { kind: 'props', speed: 0.3, minTier: 'mid', items: [{ type: 'island', x: 0.62, y: 0.58, size: 0.42, pines: 2, ink: P.ink1 }] },
      { kind: 'clouds', y: 0.82, thick: 0.14, speed: 0.3, minTier: 'mid', alpha: 0.95 },
      { kind: 'clouds', y: 0.98, thick: 0.1, speed: 0.6, minTier: 'high', alpha: 0.9 },
    ],
    ambient: 'mist', events: ['skyflash'],
  },
  ...tribScenes(),
};

const TIER_RANK = { low: 0, mid: 1, high: 2 };
const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function buildScene(key, W, H, q) {
  const def = SCENES[key] || SCENES.home;
  const seed = hashSeed(key);
  const T = tierOf(q);
  const rank = TIER_RANK[T.key];
  // 背景（天空 + 日轮）只画一次
  const bg = makeCanvas(W, H);
  const b = bg.getContext('2d');
  const sky = b.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, def.sky[0]);
  sky.addColorStop(1, def.sky[1]);
  b.fillStyle = sky;
  b.fillRect(0, 0, W, H);
  if (def.sun) {
    const s = def.sun;
    const g = b.createRadialGradient(s.x * W, s.y * H, 0, s.x * W, s.y * H, s.r * 2.2);
    g.addColorStop(0, withAlpha(s.color, s.alpha * 2.5));
    g.addColorStop(0.45, withAlpha(s.color, s.alpha * 2));
    g.addColorStop(0.5, withAlpha(s.color, s.alpha * 0.5));
    g.addColorStop(1, withAlpha(s.color, 0));
    b.fillStyle = g;
    b.beginPath(); b.arc(s.x * W, s.y * H, s.r * 2.2, 0, Math.PI * 2); b.fill();
  }
  if (def.stars) drawStars(b, { seed, width: W, height: H * 0.7, count: Math.round(def.stars * (0.5 + 0.5 * rank)) });
  if (def.crack) drawSkyCrack(b, { seed, width: W, height: H });
  const layers = [];
  const falls = [];
  let parallaxCount = 0;
  const maxParallax = T.layers;
  def.layers.forEach((L, i) => {
    if (TIER_RANK[L.minTier || 'low'] > rank) return;
    const moving = L.kind !== 'static' && (L.speed || 0) > 0;
    if (moving) { if (parallaxCount >= maxParallax) return; parallaxCount++; }
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const s = seed + i * 1009;
    const blur = T.blur ? (L.blur || 0) : 0;
    const alphaK = T.blur ? 1 : 0.85; // 低档：以透明度代替模糊
    if (L.kind === 'mountain') {
      // 模糊用“缩小绘制再放大”实现：比 ctx.filter 快两个数量级，且各浏览器一致
      const k = blur > 0 ? 1 / (1 + blur * 0.45) : 1;
      const tgt = k < 1 ? makeCanvas(W * k, H * k) : c;
      const tg = tgt.getContext('2d');
      if (k < 1) tg.scale(tgt.width / W, tgt.height / H);
      drawMountainLayer(tg, { seed: s, width: W, total: H, y: L.y * H, height: L.height * H, ink: L.ink, blur: 0, alpha: alphaK, peaks: L.peaks || 3, sharp: L.sharp || 1.4, texture: L.texture ?? 0.3 });
      if (k < 1) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(tgt, 0, 0, W, H); }
    } else if (L.kind === 'clouds') {
      drawCloudBand(g, { seed: s, width: W, y: L.y * H, thick: L.thick * H, alpha: (L.alpha ?? 0.8) * alphaK, color: L.color || '#f8f3e8', count: Math.round(W / 70) });
    } else {
      // 平移层的元素在左右各画一份，越过边界的部分在平铺时无缝衔接
      const wraps = moving ? [0, -W, W] : [0];
      for (const it of L.items || []) for (const dx of wraps) {
        g.save(); g.translate(dx, 0);
        const f = drawItem(g, it, W, H, s, def);
        g.restore();
        if (f && dx === 0) falls.push(f);
      }
    }
    layers.push({ canvas: c, speed: L.kind === 'static' ? 0 : (L.speed || 0) });
  });
  return { key, W, H, q: T.key, bg, layers, def, falls, ambient: makeAmbient(def.ambient, W, H, T, seed) };
}

// ---------- 场景事件：流星、无声闪电（按时间周期确定性出现，无需状态） ----------
function drawEvents(ctx, sc, t) {
  const ev = sc.def.events;
  if (!ev) return;
  const { W, H } = sc;
  if (ev.includes('meteors')) {
    const period = 4.5, k = Math.floor(t / period), u = (t % period) / 0.9;
    if (u < 1) {
      const r = seededRandom(k * 7919 + 13);
      const x0 = W * (0.2 + r() * 0.7), y0 = H * (0.04 + r() * 0.2), len = W * (0.15 + r() * 0.15);
      const hx = x0 - len * u, hy = y0 + len * 0.45 * u;
      const g = ctx.createLinearGradient(hx, hy, hx + len * 0.35, hy - len * 0.16);
      g.addColorStop(0, `rgba(255,248,225,${(0.9 * (1 - u * 0.6)).toFixed(2)})`);
      g.addColorStop(1, 'rgba(255,248,225,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + len * 0.35, hy - len * 0.16); ctx.stroke();
    }
  }
  if (ev.includes('skyflash')) {
    const period = 6.5, k = Math.floor(t / period), u = (t % period);
    if (u < 0.45) {
      const r = seededRandom(k * 104729 + 7);
      const a = u < 0.08 ? 1 : u < 0.16 ? 0.3 : u < 0.24 ? 0.8 : Math.max(0, 1 - (u - 0.24) / 0.2);
      const fx = W * (0.15 + r() * 0.7);
      const glow = ctx.createRadialGradient(fx, H * 0.15, 0, fx, H * 0.15, W * 0.45);
      glow.addColorStop(0, `rgba(235,242,255,${(0.45 * a).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(235,242,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H * 0.7);
      if (!sc._bolt || sc._boltK !== k) { sc._bolt = jagPath(fx, H * 0.05, fx + (r() - 0.5) * W * 0.15, H * 0.32, 5); sc._boltK = k; }
      ctx.strokeStyle = `rgba(250,252,255,${(0.75 * a).toFixed(3)})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); sc._bolt.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    }
  }
}

function drawItem(g, it, W, H, seed, def) {
  const ink = it.ink || (def.dark ? P.ink0 : P.ink1);
  const x = (it.x ?? 0.5) * W, y = (it.y ?? 1) * H, size = (it.size ?? 0.2) * H;
  switch (it.type) {
    case 'pine': drawPine(g, x, y, size, { seed: seed + x, ink }); break;
    case 'rock': drawRock(g, x, y, size, { seed: seed + x, ink }); break;
    case 'bamboo': drawBamboo(g, x, y, size, { seed: seed + x, ink }); break;
    case 'deadTree': drawDeadTree(g, x, y, size, { seed: seed + x, ink }); break;
    case 'pavilion': drawPavilion(g, x, y, size, { seed, ink, tiers: it.tiers || 2, bell: it.bell }); break;
    case 'stalactites': drawStalactites(g, { seed, width: W, y: 0, maxLen: (it.maxLen || 0.25) * H, ink, count: Math.round(W / 40) }); break;
    case 'water': drawWater(g, { seed, width: W, y: it.y * H, h: it.h * H, ink: it.ink || P.azurite }); break;
    case 'crater': drawCrater(g, x, y, size * 1.6, { seed: seed + x, ink }); break;
    case 'stele': drawStele(g, x, y, size, { seed: seed + x, ink, tilt: it.tilt }); break;
    case 'island': drawFloatingIsland(g, x, y, size * 1.2, { seed: seed + x, ink, pines: it.pines ?? 1 }); break;
    case 'cliffFall': {
      // 悬崖：两块高石夹一道瀑布的岩壁（瀑布水流由每帧动画叠加）
      const w = size * 0.5;
      drawRock(g, x - w * 0.7, y, size * 0.55, { seed: seed + 3, ink: P.ink2, flat: 1.6 });
      drawRock(g, x + w * 0.7, y, size * 0.5, { seed: seed + 5, ink: P.ink2, flat: 1.8 });
      return { x, top: y - size * 0.78, h: size * 0.78, w: w * 0.45 };
    }
    default: break;
  }
  return null;
}

// ---------- 环境粒子（雪、萤、余烬、落叶、雾、雨） ----------
function makeAmbient(kind, W, H, T, seed) {
  if (!kind || kind === 'qi') return null;
  const n = Math.round(T.particles * (kind === 'rain' ? 0.5 : kind === 'mist' ? 0.06 : 0.2));
  const rand = seededRandom(seed + 5);
  const ps = [];
  for (let i = 0; i < n; i++) ps.push({ x: rand() * W, y: rand() * H, v: 0.5 + rand(), r: 0.6 + rand() * 1.8, ph: rand() * Math.PI * 2 });
  return { kind, ps, color: null };
}

function drawAmbient(ctx, A, W, H, t, dt) {
  if (!A) return;
  ctx.save();
  for (const p of A.ps) {
    let col, r = p.r;
    switch (A.kind) {
      case 'stardust': p.y += dt * 9 * p.v; p.x += Math.sin(t * 0.8 + p.ph) * dt * 5; col = `rgba(240,232,205,${(0.35 + 0.5 * Math.abs(Math.sin(t * 2 + p.ph))).toFixed(2)})`; r *= 0.8; break;
      case 'snow': p.y += dt * 14 * p.v; p.x += Math.sin(t + p.ph) * dt * 6; col = 'rgba(250,252,255,.85)'; break;
      case 'embers': p.y -= dt * 22 * p.v; p.x += Math.sin(t * 2 + p.ph) * dt * 10; col = `rgba(240,120,90,${(0.4 + 0.4 * Math.sin(t * 3 + p.ph)).toFixed(2)})`; break;
      case 'fireflies': p.x += Math.cos(t * 0.7 + p.ph) * dt * 12; p.y += Math.sin(t * 0.9 + p.ph) * dt * 8; col = `rgba(220,240,160,${(0.3 + 0.5 * Math.max(0, Math.sin(t * 1.5 + p.ph))).toFixed(2)})`; r *= 1.3; break;
      case 'leaves': p.y += dt * 18 * p.v; p.x += (Math.sin(t + p.ph) * 20 - 8) * dt; col = 'rgba(154,107,63,.55)'; break;
      case 'mist': {
        p.x += dt * 6 * p.v;
        const R = r * 22, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
        g.addColorStop(0, 'rgba(248,246,238,.22)'); g.addColorStop(1, 'rgba(248,246,238,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2);
        if (p.x > W + R) p.x = -R;
        continue;
      }
      case 'rain': p.y += dt * 420 * p.v; p.x -= dt * 60; col = A.color || 'rgba(207,200,184,.35)'; break;
      default: col = 'rgba(0,0,0,0)';
    }
    if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
    if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
    if (p.x > W + 20) p.x = -20;
    if (p.x < -20) p.x = W + 20;
    ctx.fillStyle = col;
    if (A.kind === 'rain') { ctx.fillRect(p.x, p.y, 1, 10 * p.v); continue; }
    if (A.kind === 'leaves') { ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 2.2, r, t + p.ph, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/**
 * 绘制场景。size = {w, h}（CSS 像素）；ctx 已按 dpr 缩放。
 * 首次调用或尺寸/档位改变时预渲染各层，之后每帧只做平移贴图与少量动画。
 */
export function renderScene(ctx, sceneKey, t, quality = 'mid', size = null, dt = 1 / 60) {
  const W = Math.round(size?.w || ctx.canvas.width), H = Math.round(size?.h || ctx.canvas.height);
  const ck = `${sceneKey}|${W}|${H}|${quality}`;
  let sc = cache.get(ck);
  if (!sc) {
    sc = buildScene(sceneKey, W, H, quality);
    cache.set(ck, sc);
    while (cache.size > 4) cache.delete(cache.keys().next().value);
  }
  ctx.drawImage(sc.bg, 0, 0, W, H);
  for (const L of sc.layers) {
    if (!L.speed) { ctx.drawImage(L.canvas, 0, 0, W, H); continue; }
    const off = (t * L.speed * SPEED) % W;
    ctx.drawImage(L.canvas, -off, 0, W, H);
    ctx.drawImage(L.canvas, W - off, 0, W, H);
  }
  // 飞瀑动画
  for (const f of sc.falls) drawWaterfallFlow(ctx, f.x, f.top, f.w, f.h, t, { alpha: 0.8 });
  if (sc.ambient && sc.def.rainColor) sc.ambient.color = sc.def.rainColor;
  drawEvents(ctx, sc, t);
  drawAmbient(ctx, sc.ambient, W, H, t, dt);
  return sc;
}

export function sceneName(key) {
  return SCENES[key]?.name || key;
}

export const SCENE_KEYS = Object.keys(SCENES);

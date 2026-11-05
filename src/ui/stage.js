// 主舞台 Canvas —— 阶段 1 占位：fbm 远山两层 + 打坐占位剪影 + 灵气粒子。
// 阶段 2 由 src/art/scenes.js 的 renderScene 替换背景层。
import { PALETTE, withAlpha } from '../art/palette.js';
import { fbm, seededRandom, hashSeed } from '../art/noise.js';
import { tier } from '../art/tiers.js';

const SCENE_NAMES = {
  home: '潮生村后山', mist_valley: '雾栖谷', cold_cave: '寒潭洞', bell_hall: '钟鸣殿', red_gorge: '赤岩峡', clear_spring: '清泉',
  tribulation: '雷劫',
};

export function createStage(container, { getQuality }) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let layers = [];
  let sceneKey = 'home';
  let sceneLabel = '';
  let particles = [];
  let figureLabel = '修';
  let t = 0;
  let burst = 0; // 突破汇聚动画剩余时间

  function resize() {
    const r = container.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    buildLayers();
  }

  // 预渲染山层到离屏 Canvas（宽度为 2 倍以便横移循环）
  function buildLayers() {
    const seed = hashSeed(sceneKey);
    const defs = [
      { ink: PALETTE.ink4, y: 0.42, amp: 0.22, freq: 2.2, speed: 0.05, alpha: 0.9 },
      { ink: PALETTE.ink3, y: 0.58, amp: 0.2, freq: 3.4, speed: 0.15, alpha: 0.8 },
      { ink: PALETTE.ink2, y: 0.74, amp: 0.12, freq: 5, speed: 0.3, alpha: 0.6 },
    ];
    layers = defs.map((d, i) => {
      const c = document.createElement('canvas');
      const lw = W * 2, lh = H;
      c.width = Math.max(1, Math.round(lw * dpr));
      c.height = Math.max(1, Math.round(lh * dpr));
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      const s = seed + i * 977;
      g.beginPath();
      g.moveTo(0, lh);
      const steps = 160;
      for (let k = 0; k <= steps; k++) {
        const x = (k / steps) * lw;
        // 首尾平滑闭合：用周期化的噪声坐标
        const u = (k / steps) * d.freq * 2;
        const ridge = fbm(s, u % (d.freq * 2), undefined, { octaves: 4 });
        const ridge2 = fbm(s, (u % (d.freq * 2)) - d.freq * 2, undefined, { octaves: 4 });
        const blend = k / steps;
        const v = ridge * (1 - blend) + ridge2 * blend;
        const y = lh * (d.y - d.amp * (v - 0.3) * 1.6);
        g.lineTo(x, y);
      }
      g.lineTo(lw, lh);
      g.closePath();
      const grad = g.createLinearGradient(0, lh * (d.y - d.amp), 0, lh);
      grad.addColorStop(0, withAlpha(d.ink, d.alpha));
      grad.addColorStop(0.55, withAlpha(d.ink, d.alpha * 0.5));
      grad.addColorStop(1, withAlpha(d.ink, 0));
      g.fillStyle = grad;
      g.fill();
      return { canvas: c, speed: d.speed, w: lw };
    });
  }

  function setScene(key, label) {
    sceneKey = key || 'home';
    sceneLabel = label || SCENE_NAMES[sceneKey] || sceneKey;
    buildLayers();
  }

  function spawn(n, rand = Math.random) {
    const cx = W / 2, cy = H * 0.72;
    for (let i = 0; i < n; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = 60 + rand() * Math.min(W, H) * 0.45;
      particles.push({ x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist * 0.6, life: 1.5 + rand() * 2.5, age: 0, r: 1 + rand() * 2, hue: rand() < 0.5 ? 'gold' : 'cyan' });
    }
  }

  const rand = seededRandom(7);
  function frame(dt, { qiRatio = 0 } = {}) {
    t += dt;
    const q = tier(getQuality());
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 宣纸底 + 天光
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#f6f1e4');
    sky.addColorStop(1, PALETTE.paper);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // 山层（档位低时只画 2 层）
    const nLayers = Math.min(layers.length, q.layers >= 4 ? 3 : 2);
    for (let i = 0; i < nLayers; i++) {
      const L = layers[i];
      const off = (t * L.speed * 40) % (L.w / 2);
      ctx.drawImage(L.canvas, -off, 0, L.w, H);
      ctx.drawImage(L.canvas, -off + L.w, 0, L.w, H);
    }
    // 雾带
    const mistY = H * 0.62 + Math.sin(t * 0.3) * 6;
    const mist = ctx.createLinearGradient(0, mistY - 40, 0, mistY + 40);
    mist.addColorStop(0, 'rgba(243,236,220,0)');
    mist.addColorStop(0.5, 'rgba(243,236,220,.75)');
    mist.addColorStop(1, 'rgba(243,236,220,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, mistY - 40, W, 80);

    // 打坐占位剪影：墨色圆角块 + 标签
    const cx = W / 2, cy = H * 0.72;
    const glowR = 50 + 30 * qiRatio + (burst > 0 ? 40 * burst : 0);
    const glow = ctx.createRadialGradient(cx, cy - 20, 4, cx, cy - 20, glowR);
    glow.addColorStop(0, withAlpha(PALETTE.gamboge, 0.25 + 0.2 * qiRatio));
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy - 20, glowR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.ink1;
    roundRect(ctx, cx - 26, cy - 56, 52, 64, 14);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + 10, 44, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.paper;
    ctx.font = `28px ${getComputedStyle(document.body).getPropertyValue('--font-kai') || 'serif'}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(figureLabel, cx, cy - 24);

    // 灵气粒子：向人物汇聚
    const max = q.particles;
    const rate = (8 + 30 * qiRatio) * (max / 150) * (burst > 0 ? 6 : 1);
    const want = rate * dt;
    if (particles.length < max) spawn(Math.min(max - particles.length, Math.floor(want) + (rand() < want % 1 ? 1 : 0)), rand);
    ctx.save();
    if (q.blur) { ctx.shadowBlur = 6; }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      const k = Math.min(1, dt * (0.9 + (burst > 0 ? 2.5 : 0)));
      p.x += (cx - p.x) * k * 0.8;
      p.y += (cy - 24 - p.y) * k * 0.8 - dt * 6;
      const a = Math.sin(Math.min(1, p.age / p.life) * Math.PI);
      if (p.age >= p.life || Math.hypot(cx - p.x, cy - 24 - p.y) < 8) { particles.splice(i, 1); continue; }
      const col = p.hue === 'gold' ? PALETTE.glowGold : PALETTE.glowCyan;
      ctx.shadowColor = col;
      ctx.fillStyle = col.replace(/[\d.]+\)$/, `${(0.85 * a).toFixed(2)})`);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (burst > 0) burst = Math.max(0, burst - dt / 1.6);

    // 场景名（占位标签）
    if (sceneKey !== 'home') {
      ctx.fillStyle = withAlpha(PALETTE.ink1, 0.75);
      ctx.font = `22px serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`【${sceneLabel}】`, 16, 28);
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  resize();
  setScene('home');

  return {
    frame,
    setScene,
    resize,
    get scene() { return sceneKey; },
    /** 突破时灵气汇聚 */
    gather() { burst = 1; },
    clearParticles() { particles = []; },
  };
}

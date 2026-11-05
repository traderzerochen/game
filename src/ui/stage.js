// 主舞台 Canvas：水墨视差场景 + 角色/敌人剪影 + 特效层
import { PALETTE, elementColor, withAlpha } from '../art/palette.js';
import { renderScene, sceneName } from '../art/scenes.js';
import { drawSilhouette, enemySilhouette } from '../art/silhouette.js';
import { createFx, glowFor, GLOW } from '../art/fx.js';

export function createStage(container, { getQuality }) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1, dpr = 1;
  let sceneKey = 'home';
  let sceneLabel = '';
  let mode = 'home'; // home | battle | tribulation
  let enemy = null;  // {archetype, seed, accent, name}
  let t = 0;
  let q = getQuality();
  const fx = createFx(q);
  const hit = { player: 0, enemy: 0 };
  const lunge = { player: 0, enemy: 0 };
  let playerVariant = 'meditate';

  function resize() {
    const r = container.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  // 布局：返回角色锚点
  function layout() {
    const s = Math.min(H / 360, W / 520);
    if (mode === 'battle') return { p: [W * 0.3, H * 0.9], e: [W * 0.7, H * 0.9], s: s * 1.05 };
    if (mode === 'explore') return { p: [W * 0.42, H * 0.9], e: null, s: s * 1.05 };
    if (mode === 'tribulation') return { p: [W * 0.5, H * 0.79], e: null, s: s * 0.85 };
    return { p: [W * 0.5, H * 0.86], e: null, s: s * 1.1 };
  }

  function frame(dt, { qiRatio = 0, cultivating = true } = {}) {
    t += dt;
    const nq = getQuality();
    if (nq !== q) { q = nq; fx.setQuality(q); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shake = fx.shake;
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 10 * shake);
    renderScene(ctx, sceneKey, t, q, { w: W, h: H }, dt);

    const L = layout();
    const [px, py] = L.p;
    // 打坐时的灵气汇聚与身后光晕
    if ((mode === 'home' || mode === 'tribulation') && cultivating) {
      const cy = py - 50 * L.s;
      const g = ctx.createRadialGradient(px, cy, 4, px, cy, (60 + 40 * qiRatio) * L.s);
      g.addColorStop(0, withAlpha(PALETTE.gamboge, 0.16 + 0.18 * qiRatio));
      g.addColorStop(1, withAlpha(PALETTE.gamboge, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, cy, (60 + 40 * qiRatio) * L.s, 0, Math.PI * 2); ctx.fill();
      if (mode === 'home') fx.ambient(px, cy, 10 + 30 * qiRatio, dt, Math.min(W, H) * 0.45);
    }
    // 玩家
    for (const k of ['player', 'enemy']) { hit[k] = Math.max(0, hit[k] - dt); lunge[k] = Math.max(0, lunge[k] - dt); }
    const pl = lunge.player > 0 ? Math.sin((lunge.player / 0.3) * Math.PI) * 26 * L.s : 0;
    drawSilhouette(ctx, 'humanoid', {
      seed: 'player', variant: mode === 'battle' || mode === 'explore' ? 'sword' : playerVariant, pose: lunge.player > 0 ? 'attack' : hit.player > 0 && mode === 'battle' ? 'hurt' : 'idle',
      x: px + pl - (hit.player > 0 ? 6 * L.s : 0), y: py, scale: L.s, facing: 1, t,
      ink: mode === 'tribulation' ? PALETTE.ink0 : PALETTE.ink1, accent: PALETTE.azurite,
      alpha: hit.player > 0 && Math.floor(hit.player * 30) % 2 ? 0.45 : 1,
      glow: mode === 'tribulation' ? GLOW.cyan : null,
    });
    // 敌人
    if (mode === 'battle' && enemy && L.e) {
      const [ex, ey] = L.e;
      const el = lunge.enemy > 0 ? Math.sin((lunge.enemy / 0.3) * Math.PI) * 26 * L.s : 0;
      drawSilhouette(ctx, enemy.archetype, {
        seed: enemy.seed, variant: enemy.variant, pose: lunge.enemy > 0 ? 'attack' : hit.enemy > 0 ? 'hurt' : 'idle', x: ex - el + (hit.enemy > 0 ? 6 * L.s : 0), y: ey, scale: L.s * (enemy.boss ? 1.25 : 1), facing: -1, t,
        ink: PALETTE.ink0, accent: enemy.accent, alpha: hit.enemy > 0 && Math.floor(hit.enemy * 30) % 2 ? 0.45 : 1,
      });
    }
    fx.update(dt);
    fx.draw(ctx, W, H);
    // 场景题签
    if (sceneKey !== 'home' && sceneLabel) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `20px ${getComputedStyle(document.body).getPropertyValue('--font-kai') || 'serif'}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const label = `「${sceneLabel}」`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(243,236,220,.72)';
      ctx.fillRect(10, 10, tw + 12, 30);
      ctx.fillStyle = PALETTE.ink1;
      ctx.fillText(label, 16, 14);
    }
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  resize();

  const api = {
    frame,
    resize,
    fx,
    get scene() { return sceneKey; },
    get mode() { return mode; },
    setScene(key, label) {
      sceneKey = key || 'home';
      sceneLabel = label || (sceneKey === 'home' ? '' : sceneName(sceneKey));
      mode = sceneKey === 'tribulation' ? 'tribulation' : sceneKey === 'home' ? 'home' : 'explore';
      if (sceneKey === 'home') { enemy = null; fx.clear(); }
    },
    /** 战斗：设置敌人（null 表示离开战斗，回到行走/探索状态） */
    setEnemy(e) {
      if (e) {
        mode = 'battle';
        const sil = enemySilhouette(e) || {};
        enemy = { archetype: sil.archetype || e.art || 'beast', variant: sil.variant, seed: sil.seed ?? e.id, accent: sil.accent || elementColor(e.element), name: e.name, boss: !!e.boss, element: e.element };
      } else {
        enemy = null;
        if (mode === 'battle') mode = 'explore';
      }
    },
    setPlayerVariant(v) { playerVariant = v || 'meditate'; },
    /** 突破时灵气汇聚 */
    gather() { const L = layout(); fx.gather(L.p[0], L.p[1] - 50 * L.s, { spread: Math.min(W, H) * 0.55 }); },
    /** 战斗回放中的一次出手（BattleEvent） */
    strike(ev, playerEl = 'none') {
      const L = layout();
      if (!L.e) return;
      const isP = ev.actor === 'player';
      const [ax, ay] = isP ? L.p : L.e;
      const [bx, by] = isP ? L.e : L.p;
      const midY = -55 * L.s;
      if (ev.heal && !ev.dmg) { fx.heal(ax, ay + midY); return; }
      if (ev.shield && !ev.dmg) { fx.heal(ax, ay + midY); return; }
      if (ev.action === 'pill') { fx.heal(ax, ay + midY); return; }
      lunge[isP ? 'player' : 'enemy'] = 0.3;
      const el = isP ? playerEl : enemy?.element;
      const color = ev.elem ? glowFor(ev.elem) : glowFor(el);
      fx.swordTrail(ax + (isP ? 20 : -20) * L.s, ay - 80 * L.s, bx + (isP ? -10 : 10) * L.s, by - 30 * L.s, { color, arc: isP ? 0.3 : -0.3, w: 8 * L.s });
      if (ev.dmg != null) hit[isP ? 'enemy' : 'player'] = 0.3;
      if (ev.crit || ev.action === 'skill') fx.burst(bx, by + midY, { color, power: ev.crit ? 1.2 : 0.6 });
      if (ev.heal) fx.heal(ax, ay + midY);
    },
    /** 渡劫：一道天雷劈向角色 */
    thunder(power = 1) {
      const L = layout();
      const [px, py] = L.p;
      fx.lightning(px + (Math.random() - 0.5) * W * 0.3, 0, px, py - 60 * L.s, { power });
      hit.player = 0.35;
    },
    healPulse() { const L = layout(); fx.heal(L.p[0], L.p[1] - 50 * L.s); },
    flash(a, c) { fx.flash(a, c); },
  };
  return api;
}

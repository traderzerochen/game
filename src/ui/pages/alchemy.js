// 炼丹页 —— 阶段 1 简版：丹方列表 + 炼制（engine 未开放时提示）；阶段 2 加丹炉动画
import { h, sealButton } from '../dom.js';
import { fmtPct, reasonText } from '../format.js';
import { pillIcon, herbIcon } from '../../art/icons.js';
import { QUALITY_NAMES } from '../../art/palette.js';
import { drawFurnace } from '../../art/scenery.js';
import { createFx, GLOW } from '../../art/fx.js';

const BREW_MS = 2000;

/** 炼制动画：丹炉、炉火、火星；结束后揭示品质结果 */
function brew(app, recipe, pill, res) {
  const cv = h('canvas', { width: 560, height: 440 });
  const result = h('div', { class: 'furnace-result', text: '炉火渐旺……' });
  const box = h('div', { class: 'furnace-box' }, cv, result);
  let alive = true;
  const close = app.openModal({ title: recipe.name, body: box, actions: [{ text: '收丹' }], onClose: () => { alive = false; } });
  void close;
  const ctx = cv.getContext('2d');
  ctx.scale(2, 2);
  const fx = createFx(app.settings.quality);
  const W = 280, H = 220, cx = 140, base = 200;
  let t = 0, last = performance.now(), revealed = false;
  const frame = (now) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const heat = Math.min(1, t / (BREW_MS / 1000));
    ctx.clearRect(0, 0, W, H);
    // 炉火
    const fire = ctx.createRadialGradient(cx, base - 18, 2, cx, base - 18, 60 + 20 * heat);
    fire.addColorStop(0, `rgba(240,140,70,${0.25 + 0.5 * heat})`);
    fire.addColorStop(1, 'rgba(240,120,90,0)');
    ctx.fillStyle = fire;
    ctx.fillRect(0, 0, W, H);
    if (!revealed && Math.random() < 0.6) fx.burst(cx + (Math.random() - 0.5) * 60, base - 10, { color: Math.random() < 0.7 ? GLOW.red : GLOW.gold, power: 0.15 });
    drawFurnace(ctx, cx, base, 170, { t, heat: revealed ? heat * 0.6 : heat });
    // 青烟
    ctx.fillStyle = 'rgba(107,102,93,.12)';
    for (let i = 0; i < 5; i++) { const yy = base - 140 - ((t * 30 + i * 20) % 80); ctx.beginPath(); ctx.ellipse(cx + Math.sin(t + i) * 12, yy, 14 + i * 3, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    fx.update(dt);
    fx.draw(ctx, W, H);
    if (!revealed && t >= BREW_MS / 1000) {
      revealed = true;
      if (res.success) {
        const q = res.quality || 0;
        fx.gather(cx, base - 130, { color: q >= 3 ? GLOW.gold : GLOW.cyan, spread: 120 });
        fx.burst(cx, base - 130, { color: GLOW.gold, power: 0.6 + q * 0.3 });
        result.className = `furnace-result q${q}`;
        result.innerHTML = pillIcon(pill, q) + `丹成 · <span class="q${q}">${QUALITY_NAMES[q]}${pill?.name || ''}</span> ×${res.count || 1}`;
      } else {
        fx.lightning(cx, base - 180, cx, base - 120, { power: 0.3 });
        result.className = 'furnace-result bad';
        result.textContent = '炉火失控，丹药化作一缕青烟。';
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function render(el, app) {
  const { game, data } = app;
  const st = game.state;
  const a = st.alchemy || { level: 1, xp: 0 };
  el.appendChild(h('div', { class: 'section' },
    h('h3', {}, '丹道 ', h('span', { class: 'muted', text: `第 ${a.level} 层 · 火候 ${a.xp}/${10 * a.level}` })),
    h('div', { class: 'desc', text: '灵根含火者，炼丹更易成。' })));
  const list = h('div', { class: 'section' }, h('h3', { text: '丹方' }));
  for (const r of data.recipes) {
    const pill = data.byId.pills.get(r.pillId);
    const info = game.craftInfo ? game.craftInfo(r.id) : null;
    const usable = info && info.ok !== false;
    const can = usable && info.can;
    const rate = usable ? info.rate : r.baseRate;
    const mats = r.herbs.map((x) => {
      const herb = data.byId.herbs.get(x.herbId);
      const have = st.inventory.herbs[x.herbId] || 0;
      return h('span', { class: `small ${have >= x.count ? '' : 'bad'}`, style: { marginRight: '8px', display: 'inline-flex', alignItems: 'center', gap: '2px' } },
        h('span', { html: herbIcon(herb, { size: 18 }) }), `${herb?.name || x.herbId} ${have}/${x.count}`);
    });
    const tooLow = (r.realmReq || 0) > st.stage;
    list.appendChild(h('div', { class: `card ${tooLow ? 'locked' : ''}` },
      h('div', { class: 'icon-box', html: pillIcon(pill, 0) }),
      h('div', { class: 'body' },
        h('div', { class: 'name', text: r.name }),
        h('div', { class: 'meta', text: `成丹 ${r.yield} 枚 · 灵石 ${r.stones} · 成功率 ${fmtPct(rate)}` }),
        h('div', {}, mats),
        h('div', { class: 'desc', text: pill?.desc || '' })),
      h('div', { class: 'actions' },
        sealButton('炼制', () => {
          const res = game.craft(r.id);
          if (!res.ok) { app.toast(reasonText(res.reason) || '丹炉未开', 'bad'); return; }
          brew(app, r, pill, res);
          app.forceRefresh();
        }, { disabled: !can || tooLow, title: usable ? reasonText(info.missing?.length ? 'missing_herbs' : info.reason) : '丹炉尚未开启' }))));
  }
  el.appendChild(list);
}

export default { id: 'alchemy', name: '炼丹', title: '炼丹', render };

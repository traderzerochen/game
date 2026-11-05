// 背包页：药材、丹药（按品质）、法宝装备，以及坊市购买
import { h, btn } from '../dom.js';
import { fmtInt, fmtPct, reasonText } from '../format.js';
import { herbIcon, pillIcon, treasureIcon, techniqueIcon } from '../../art/icons.js';
import { ELEMENT_NAMES, QUALITY_NAMES } from '../../art/palette.js';

const SLOT_NAMES = { weapon: '兵刃', armor: '护甲', charm: '佩饰' };
const STAT_NAMES = { hp: '气血', mp: '灵力', atk: '攻', def: '防', spd: '速', crit: '会心' };
const USABLE = new Set(['qi', 'qiRate', 'breakthrough', 'tribulation', 'lifespan']);
const PILL_EFFECT = {
  qi: (v) => `灵气 +${fmtPct(v)} 境界所需`, qiRate: (v, d) => `修炼 +${fmtPct(v)}，持续 ${d || 0} 息`,
  breakthrough: (v) => `破关成功率 +${fmtPct(v)}`, tribulation: (v) => `渡劫减伤 +${fmtPct(v)}`,
  heal: (v) => `回复 ${fmtPct(v)} 气血（战斗/渡劫）`, mp: (v) => `回复 ${fmtPct(v)} 灵力（战斗）`, lifespan: (v) => `寿元 +${v} 年`,
};
const QM = [1, 1.25, 1.5, 2];

export function treasureStatText(t) {
  const parts = [];
  for (const [k, v] of Object.entries(t.stats?.flat || {})) parts.push(`${STAT_NAMES[k] || k}+${k === 'crit' ? fmtPct(v) : v}`);
  for (const [k, v] of Object.entries(t.stats?.pct || {})) parts.push(`${STAT_NAMES[k] || k}+${fmtPct(v)}`);
  if (t.tribResist) parts.push(`雷劫减伤 ${fmtPct(t.tribResist)}`);
  if (t.alchemyBonus) parts.push(`炼丹 +${fmtPct(t.alchemyBonus)}`);
  if (t.protect) parts.push(`护命 ${fmtPct(t.protect)}`);
  return parts.join(' · ');
}

/** 服丹并以浮字报告实际药效（qi 类含丹毒衰减） */
export function usePillUI(app, pill, q) {
  const r = app.game.usePill(pill.id, q);
  if (!r.ok) { app.toast(r.reason === 'invalid' && pill.effect?.type === 'qi' ? '灵气已满，药力无处容纳' : reasonText(r.reason), 'bad'); app.forceRefresh(); return r; }
  const nm = `${QUALITY_NAMES[q]}${pill.name}`;
  let msg = `服下${nm}`;
  if (r.type === 'qi') {
    msg += `，灵气 +${fmtInt(r.qiGained ?? 0)}`;
    if (r.toxicity > 0) msg += `（丹毒 ${r.toxicity} 层，药效 ×${+(r.mult ?? 1).toFixed(2)}）`;
  } else if (r.type === 'qiRate') msg += `，修炼 +${fmtPct(r.value)}`;
  else if (r.type === 'breakthrough') msg += `，破关 +${fmtPct(r.value)}`;
  else if (r.type === 'tribulation') msg += `，渡劫减伤 +${fmtPct(r.value)}`;
  else if (r.type === 'lifespan') msg += `，寿元 +${r.value} 年`;
  app.toast(msg, r.toxicity > 0 ? 'bad' : 'good');
  app.forceRefresh();
  return r;
}

function render(el, app) {
  const { game, data } = app;
  const st = game.state;
  const inv = st.inventory;
  const act = (r, msg) => { if (!r.ok) app.toast(reasonText(r.reason), 'bad'); else if (msg) app.toast(msg, 'good'); app.forceRefresh(); };

  // ---- 法宝 ----
  const tBox = h('div', { class: 'section' }, h('h3', { text: '法宝' }));
  for (const slot of ['weapon', 'armor', 'charm']) {
    const id = st.treasures[slot];
    const t = id && data.byId.treasures.get(id);
    tBox.appendChild(h('div', { class: `card ${t ? 'equipped' : ''}` },
      h('div', { class: 'icon-box', html: t ? treasureIcon(t) : '' }),
      h('div', { class: 'body' },
        h('div', { class: 'meta', text: SLOT_NAMES[slot] }),
        h('div', { class: 'name', text: t ? t.name : '— 空 —' }),
        t ? h('div', { class: 'meta', text: treasureStatText(t) }) : null),
      h('div', { class: 'actions' }, t ? btn('卸下', () => act(game.unequipTreasure(slot)), { cls: 'small' }) : null)));
  }
  for (const id of inv.treasures || []) {
    const t = data.byId.treasures.get(id);
    if (!t) continue;
    const low = (t.realmReq || 0) > st.stage;
    tBox.appendChild(h('div', { class: 'card' },
      h('div', { class: 'icon-box', html: treasureIcon(t) }),
      h('div', { class: 'body' },
        h('div', { class: 'name' }, t.name, ' ', h('span', { class: `small q${(t.rarity || 1) - 1}`, text: QUALITY_NAMES[(t.rarity || 1) - 1] })),
        h('div', { class: 'meta', text: `${SLOT_NAMES[t.slot]} · ${treasureStatText(t)}` }),
        h('div', { class: 'desc', text: t.desc })),
      h('div', { class: 'actions' }, btn('祭炼', () => act(game.equipTreasure(id), `已祭炼${t.name}`), { cls: 'small', disabled: low, title: low ? '境界不足' : '' }))));
  }
  el.appendChild(tBox);

  // ---- 丹药 ----
  const tox = game.view().pillToxicity || { n: 0, nextMult: 1 };
  const toxText = `丹毒 ${tox.n} 层，药效 ×${+(tox.nextMult ?? 1).toFixed(2)}`;
  const pBox = h('div', { class: 'section' }, h('h3', {}, '丹药 ', h('span', { class: 'muted', text: '点击服用' })));
  const hasQiPill = Object.entries(inv.pills || {}).some(([pid, arr]) => data.byId.pills.get(pid)?.effect?.type === 'qi' && (arr || []).some((n) => n > 0));
  if (hasQiPill) pBox.appendChild(h('div', { class: `small toxicity ${tox.n > 0 ? 'on' : ''}`, text: `聚气类丹药：${toxText}（同一小境界内每服一颗，下一颗药效 ×0.6；破境后清除）` }));
  const pGrid = h('div', { class: 'grid-items' });
  for (const [pid, arr] of Object.entries(inv.pills || {})) {
    const pill = data.byId.pills.get(pid);
    if (!pill) continue;
    (arr || []).forEach((n, q) => {
      if (!n) return;
      const e = pill.effect || {};
      const usable = USABLE.has(e.type);
      const tip = `${QUALITY_NAMES[q]}${pill.name}\n${(PILL_EFFECT[e.type] || (() => ''))(+(e.value * QM[q]).toFixed(3), e.duration)}\n${pill.desc || ''}${usable ? '' : '\n（战斗规则或渡劫时使用）'}`;
      const isQi = e.type === 'qi';
      pGrid.appendChild(h('div', {
        class: `item ${usable ? 'clickable' : ''}`, title: isQi ? `${tip}\n${toxText}` : tip,
        onclick: usable ? () => usePillUI(app, pill, q) : null,
      }, h('div', { html: pillIcon(pill, q) }), h('div', { class: `nm q${q}`, text: `${QUALITY_NAMES[q]}${pill.name}` }), h('div', { class: 'cnt', text: `×${n}` }),
      isQi ? h('div', { class: `tox ${tox.n > 0 ? 'on' : ''}`, text: tox.n > 0 ? `毒${tox.n} ×${+tox.nextMult.toFixed(2)}` : '无毒' }) : null));
    });
  }
  pBox.appendChild(pGrid.children.length ? pGrid : h('div', { class: 'desc', text: '尚无丹药。' }));
  el.appendChild(pBox);

  // ---- 药材 ----
  const hBox = h('div', { class: 'section' }, h('h3', { text: '药材' }));
  const hGrid = h('div', { class: 'grid-items' });
  for (const [id, n] of Object.entries(inv.herbs || {})) {
    const hb = data.byId.herbs.get(id);
    if (!hb || !n) continue;
    hGrid.appendChild(h('div', { class: 'item', title: `${hb.name}（${ELEMENT_NAMES[hb.element] || ''}）\n${hb.desc || ''}` },
      h('div', { html: herbIcon(hb) }), h('div', { class: 'nm', text: hb.name }), h('div', { class: 'cnt', text: `×${n}` })));
  }
  hBox.appendChild(hGrid.children.length ? hGrid : h('div', { class: 'desc', text: data.texts.empty?.inventory || '' }));
  el.appendChild(hBox);

  // ---- 坊市 ----
  const shop = data.shop || {};
  const sBox = h('div', { class: 'section' }, h('h3', {}, '坊市 ', h('span', { class: 'muted', text: `囊中灵石 ${fmtInt(inv.stones)}` })));
  const row = (kind, item, icon, name, sub, owned, req) => {
    const low = (req || 0) > st.stage;
    sBox.appendChild(h('div', { class: `card ${low ? 'locked' : ''}` },
      h('div', { class: 'icon-box', html: icon }),
      h('div', { class: 'body' }, h('div', { class: 'name', text: name }), h('div', { class: 'meta', text: sub })),
      h('div', { class: 'actions' },
        owned ? h('span', { class: 'small muted', text: '已拥有' })
          : btn(`${fmtInt(item.price)} 灵石`, () => act(game.buy(kind, item.id), `购得${name}`), { cls: 'small', disabled: inv.stones < item.price || low, title: low ? '境界不足' : '' }))));
  };
  for (const it of shop.techniques || []) {
    const t = data.byId.techniques.get(it.id);
    if (t) row('technique', it, techniqueIcon(t), t.name, `${ELEMENT_NAMES[t.element] || ''} · ${t.desc}`, !!st.techniques.owned[t.id], t.realmReq);
  }
  for (const it of shop.treasures || []) {
    const t = data.byId.treasures.get(it.id);
    const has = t && ((inv.treasures || []).includes(t.id) || Object.values(st.treasures).includes(t.id));
    if (t) row('treasure', it, treasureIcon(t), t.name, treasureStatText(t), has, t.realmReq);
  }
  for (const it of shop.herbs || []) {
    const hb = data.byId.herbs.get(it.id);
    if (hb) row('herb', it, herbIcon(hb), hb.name, `持有 ${inv.herbs?.[hb.id] || 0} · ${hb.desc}`, false, 0);
  }
  el.appendChild(sBox);
}

export default { id: 'bag', name: '背包', title: '行囊', render };

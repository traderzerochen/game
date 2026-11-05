// 功法页：已拥有列表、心法 / 护体 / 技能（4 槽，可调顺序）、升级、五行适配
import { h, btn } from '../dom.js';
import { fmtInt, fmtPct, reasonText } from '../format.js';
import { techniqueIcon } from '../../art/icons.js';
import { ELEMENT_NAMES, QUALITY_NAMES } from '../../art/palette.js';
import { MAX_SKILL_SLOTS } from '../../core/constants.js';

const TYPE_NAMES = { heart: '心法', skill: '技能', body: '护体' };
const KIND_NAMES = { damage: '攻伐', heal: '回春', shield: '护盾', buff: '增益', drain: '汲取' };
const STAT_NAMES = { hp: '气血', mp: '灵力', atk: '攻', def: '防', spd: '速', crit: '会心' };

export function upgradeCostOf(game, tech) {
  if (game.upgradeCost) return game.upgradeCost(tech.id);
  const lv = game.state.techniques.owned[tech.id] || 1;
  return Math.round((tech.upgradeCost || 0) * Math.pow(lv, 1.5)); // DESIGN §3.11，仅用于展示
}

export function effectText(t, lv = 1) {
  const e = t.effect || {};
  if (t.type === 'heart') {
    const q = (e.qiRate || 0) + (e.qiRatePerLv || 0) * (lv - 1);
    const st = e.stats ? ' · ' + Object.entries(e.stats).map(([k, v]) => `${STAT_NAMES[k] || k}+${fmtPct(v)}`).join(' ') : '';
    return `修炼 +${fmtPct(q)}${st}`;
  }
  if (t.type === 'skill') {
    const p = (e.power || 0) + (e.powerPerLv || 0) * (lv - 1);
    return `${KIND_NAMES[e.kind] || e.kind} · 威能 ${p.toFixed(2)} · 耗灵力 ${e.mpCost || 0}`;
  }
  if (t.type === 'body') {
    const m = 1 + 0.1 * (lv - 1);
    return Object.entries(e.stats || {}).map(([k, v]) => `${STAT_NAMES[k] || k}+${fmtPct(v * m)}`).join(' ');
  }
  return '';
}

function render(el, app) {
  const { game, data } = app;
  const st = game.state;
  const owned = st.techniques.owned || {};
  const eq = st.techniques.equipped;
  const act = (r, okMsg) => { if (!r.ok) app.toast(reasonText(r.reason), 'bad'); else if (okMsg) app.toast(okMsg, 'good'); app.forceRefresh(); };

  // ---- 已装备 ----
  const slotCard = (label, id, onUnequip, extra = null) => {
    const t = id && data.byId.techniques.get(id);
    return h('div', { class: `card ${t ? 'equipped' : ''}` },
      h('div', { class: 'icon-box', html: t ? techniqueIcon(t) : '' }),
      h('div', { class: 'body' },
        h('div', { class: 'meta', text: label }),
        h('div', { class: 'name', text: t ? `${t.name} · 第 ${owned[id]} 重` : '— 空 —' }),
        t ? h('div', { class: 'meta', text: effectText(t, owned[id]) }) : null),
      h('div', { class: 'actions' }, extra, t ? btn('卸下', onUnequip, { cls: 'small' }) : null));
  };
  const eqBox = h('div', { class: 'section' }, h('h3', { text: '运转中' }));
  eqBox.appendChild(slotCard('心法', eq.heart, () => act(game.unequipTechnique('heart'))));
  eqBox.appendChild(slotCard('护体', eq.body, () => act(game.unequipTechnique('body'))));
  for (let i = 0; i < MAX_SKILL_SLOTS; i++) {
    const id = eq.skills[i];
    const move = (d) => {
      const ids = [...eq.skills];
      const j = i + d;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      act(game.setSkillOrder(ids));
    };
    const arrows = id ? h('div', { class: 'row' },
      btn('↑', () => move(-1), { cls: 'small', disabled: i === 0, title: '前移' }),
      btn('↓', () => move(1), { cls: 'small', disabled: i >= eq.skills.length - 1, title: '后移' })) : null;
    eqBox.appendChild(slotCard(`技能 ${i + 1}`, id, () => act(game.unequipTechnique('skill', i)), arrows));
  }
  eqBox.appendChild(h('div', { class: 'desc', text: '战斗中按技能顺序轮转施放；灵力不足时以拳脚应敌。' }));
  el.appendChild(eqBox);

  // ---- 已拥有 ----
  const list = h('div', { class: 'section' }, h('h3', { text: '藏经' }));
  const ids = Object.keys(owned).filter((id) => data.byId.techniques.has(id));
  if (!ids.length) list.appendChild(h('div', { class: 'desc', text: data.texts.empty?.techniques || '' }));
  const order = { heart: 0, body: 1, skill: 2 };
  ids.sort((a, b) => {
    const A = data.byId.techniques.get(a), B = data.byId.techniques.get(b);
    return (order[A.type] - order[B.type]) || (B.rarity - A.rarity);
  });
  for (const id of ids) {
    const t = data.byId.techniques.get(id);
    const lv = owned[id];
    const max = game.maxLevel(id);
    const aff = game.affinity(id);
    const isEq = eq.heart === id || eq.body === id || eq.skills.includes(id);
    const cost = upgradeCostOf(game, t);
    const tooLow = (t.realmReq || 0) > st.stage;
    const actions = [];
    if (!isEq) {
      const full = t.type === 'skill' && eq.skills.length >= MAX_SKILL_SLOTS;
      actions.push(btn(t.type === 'skill' ? '装入' : '运转', () => act(game.equipTechnique(id, t.type), `已运转${t.name}`),
        { cls: 'small', disabled: full || tooLow, title: full ? '技能槽已满，请先卸下一门' : tooLow ? '境界不足' : '' }));
    }
    actions.push(btn(lv >= max ? '已至上限' : `参悟 ${fmtInt(cost)} 灵石`, () => act(game.upgradeTechnique(id), `${t.name}精进至第 ${lv + 1} 重`),
      { cls: 'small blue', disabled: lv >= max || st.inventory.stones < cost }));
    list.appendChild(h('div', { class: `card ${isEq ? 'equipped' : ''}` },
      h('div', { class: 'icon-box', html: techniqueIcon(t) }),
      h('div', { class: 'body' },
        h('div', { class: 'name' }, t.name, ' ', h('span', { class: `small q${(t.rarity || 1) - 1}`, text: QUALITY_NAMES[(t.rarity || 1) - 1] })),
        h('div', { class: 'meta' },
          h('span', { class: 'tag', text: TYPE_NAMES[t.type] || t.type }), ' ',
          h('span', { class: `tag el-${t.element}`, text: ELEMENT_NAMES[t.element] || '无' }),
          ` 第 ${lv}/${max} 重 · 适配 `, h('b', { class: aff > 1 ? 'good' : aff < 1 ? 'bad' : '', text: `×${aff}` })),
        h('div', { class: 'meta', text: effectText(t, lv) }),
        h('div', { class: 'desc', text: t.desc })),
      h('div', { class: 'actions' }, actions)));
  }
  el.appendChild(list);
  el.appendChild(h('div', { class: 'desc', text: '功法上限随大境界提升：每入一大境界，可多参悟两重。灵根与功法五行相合者，事半功倍。' }));
}

export default { id: 'techniques', name: '功法', title: '功法', render };

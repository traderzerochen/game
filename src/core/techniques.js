// 功法：适配、装备、升级
import { MAX_SKILL_SLOTS } from './constants.js';
import { clamp, fail, num } from './util.js';

export function affinity(tech, roots) {
  if (!tech || !tech.element || tech.element === 'none') return 1.0;
  if (Array.isArray(roots) && roots.includes(tech.element)) return roots.length === 1 ? 1.35 : 1.2;
  return 0.75;
}

export function maxLevel(state, ctx, techId) {
  const t = ctx.data.byId.techniques.get(techId);
  if (!t) return 0;
  const major = Math.floor(num(state.stage) / 3);
  return Math.max(1, Math.min(num(t.maxLevel, 10), 3 + 2 * major));
}

export function upgradeCost(state, ctx, techId) {
  const t = ctx.data.byId.techniques.get(techId);
  const lv = num(state.techniques.owned[techId], 0);
  if (!t || lv < 1) return 0;
  return Math.max(0, Math.round(num(t.upgradeCost, 0) * Math.pow(lv, 1.5)));
}

const SLOT = { heart: 'heart', body: 'body', skill: 'skills', skills: 'skills' };

export function equip(state, ctx, techId, slot, index) {
  const t = ctx.data.byId.techniques.get(techId);
  const key = SLOT[slot];
  if (!t || !key) return fail('invalid');
  if (!state.techniques.owned[techId]) return fail('not_owned');
  const wantType = key === 'skills' ? 'skill' : key;
  if (t.type !== wantType) return fail('invalid');
  if (num(t.realmReq) > state.stage) return fail('realm_too_low');
  const eq = state.techniques.equipped;
  if (key === 'skills') {
    const cur = eq.skills.filter((x) => x !== techId);
    if (Number.isInteger(index) && index >= 0 && index < MAX_SKILL_SLOTS) {
      if (index < cur.length) cur[index] = techId;
      else cur.push(techId);
    } else {
      if (cur.length >= MAX_SKILL_SLOTS) return fail('invalid');
      cur.push(techId);
    }
    eq.skills = cur.slice(0, MAX_SKILL_SLOTS);
  } else {
    eq[key] = techId;
  }
  ctx.bus.emit('technique:changed', { id: techId, level: state.techniques.owned[techId] });
  return { ok: true };
}

export function unequip(state, ctx, slot, index) {
  const key = SLOT[slot];
  if (!key) return fail('invalid');
  const eq = state.techniques.equipped;
  let id = null;
  if (key === 'skills') {
    const i = Number.isInteger(index) ? index : eq.skills.length - 1;
    if (i < 0 || i >= eq.skills.length) return fail('invalid');
    id = eq.skills.splice(i, 1)[0];
  } else {
    id = eq[key];
    if (!id) return fail('invalid');
    eq[key] = null;
  }
  ctx.bus.emit('technique:changed', { id });
  return { ok: true };
}

export function setSkillOrder(state, ctx, ids) {
  if (!Array.isArray(ids) || ids.length > MAX_SKILL_SLOTS) return fail('invalid');
  if (new Set(ids).size !== ids.length) return fail('invalid');
  for (const id of ids) {
    const t = ctx.data.byId.techniques.get(id);
    if (!t || t.type !== 'skill') return fail('invalid');
    if (!state.techniques.owned[id]) return fail('not_owned');
  }
  state.techniques.equipped.skills = [...ids];
  ctx.bus.emit('technique:changed', {});
  return { ok: true };
}

export function upgrade(state, ctx, techId) {
  const t = ctx.data.byId.techniques.get(techId);
  if (!t) return fail('invalid');
  const lv = num(state.techniques.owned[techId], 0);
  if (lv < 1) return fail('not_owned');
  if (lv >= maxLevel(state, ctx, techId)) return fail('max_level');
  const cost = upgradeCost(state, ctx, techId);
  if (state.inventory.stones < cost) return fail('not_enough_stones');
  state.inventory.stones = clamp(state.inventory.stones - cost, 0, Number.MAX_SAFE_INTEGER);
  state.techniques.owned[techId] = lv + 1;
  ctx.bus.emit('technique:changed', { id: techId, level: lv + 1 });
  return { ok: true, level: lv + 1, cost };
}

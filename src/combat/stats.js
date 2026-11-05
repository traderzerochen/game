// 玩家最终属性 —— DESIGN §3.6
import { CRIT_CAP } from '../core/constants.js';
import { affinity } from '../core/techniques.js';
import { clamp, num } from '../core/util.js';

const KEYS = ['hp', 'mp', 'atk', 'def', 'spd'];

export function equippedTreasures(state, ctx) {
  const out = [];
  for (const slot of ['weapon', 'armor', 'charm']) {
    const id = state.treasures?.[slot];
    const t = id && ctx.data.byId.treasures.get(id);
    if (t) out.push(t);
  }
  return out;
}

export function computeStats(state, ctx) {
  const realm = ctx.data.realm(state.stage);
  const base = realm.baseStats;
  const flat = { hp: 0, mp: 0, atk: 0, def: 0, spd: 0, crit: 0 };
  const pct = { hp: 0, mp: 0, atk: 0, def: 0, spd: 0, crit: 0 };
  for (const t of equippedTreasures(state, ctx)) {
    for (const [k, v] of Object.entries(t.stats?.flat || {})) if (k in flat) flat[k] += num(v);
    for (const [k, v] of Object.entries(t.stats?.pct || {})) if (k in pct) pct[k] += num(v);
  }
  const eq = state.techniques.equipped;
  const heart = eq.heart && ctx.data.byId.techniques.get(eq.heart);
  const body = eq.body && ctx.data.byId.techniques.get(eq.body);
  if (heart) {
    for (const [k, v] of Object.entries(heart.effect?.stats || {})) if (k in pct) pct[k] += num(v);
  }
  if (body) {
    const lv = num(state.techniques.owned[body.id], 1);
    const m = (1 + 0.1 * (lv - 1)) * affinity(body, state.player.roots);
    for (const [k, v] of Object.entries(body.effect?.stats || {})) if (k in pct) pct[k] += num(v) * m;
  }
  const out = {};
  for (const k of KEYS) {
    out[k] = Math.max(1, Math.round((num(base[k]) + flat[k]) * (1 + pct[k])));
  }
  out.crit = clamp(num(base.crit) + flat.crit + pct.crit, 0, CRIT_CAP);
  out.element = heart ? heart.element || 'none' : 'none';
  return out;
}

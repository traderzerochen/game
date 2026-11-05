// 炼丹与丹药 —— DESIGN §3.9 / §3.10
import { QUALITY_MULT } from './constants.js';
import { equippedTreasures } from '../combat/stats.js';
import { addPill } from './inventory.js';
import { qiCap } from './cultivation.js';
import { addBuff } from './expedition.js';
import { addLog, clamp, fail, inc, num } from './util.js';

export function craftInfo(state, ctx, recipeId) {
  const r = ctx.data.byId.recipes.get(recipeId);
  if (!r) return { can: false, rate: 0, missing: [], reason: 'invalid' };
  const L = clamp(Math.floor(num(state.alchemy.level, 1)), 1, 10);
  let bonus = 0;
  for (const t of equippedTreasures(state, ctx)) bonus += num(t.alchemyBonus);
  const rate = clamp(num(r.baseRate) + 0.03 * (L - 1) + (state.player.roots.includes('fire') ? 0.05 : 0) + bonus, 0.05, 0.98);
  const missing = [];
  for (const h of r.herbs || []) {
    const have = num(state.inventory.herbs[h.herbId]);
    if (have < h.count) missing.push({ herbId: h.herbId, need: h.count, have });
  }
  const info = { can: false, rate, missing, stones: num(r.stones), qualityWeights: weights(L) };
  if (state.ending) info.reason = 'ended';
  else if (num(r.realmReq) > state.stage) info.reason = 'realm_too_low';
  else if (missing.length) info.reason = 'missing_herbs';
  else if (state.inventory.stones < num(r.stones)) info.reason = 'not_enough_stones';
  else info.can = true;
  return info;
}

function weights(L) {
  return [60, 28 + 2 * L, 10 + 1.5 * L, 2 + 0.5 * L].map((w) => ({ weight: w }));
}

export function craft(state, ctx, recipeId) {
  const info = craftInfo(state, ctx, recipeId);
  if (!info.can) return fail(info.reason || 'invalid');
  const r = ctx.data.byId.recipes.get(recipeId);
  for (const h of r.herbs) {
    state.inventory.herbs[h.herbId] -= h.count;
    if (state.inventory.herbs[h.herbId] <= 0) delete state.inventory.herbs[h.herbId];
  }
  state.inventory.stones -= num(r.stones);
  inc(state.counters, 'crafts');
  const success = ctx.rng.next() < info.rate;
  const L = clamp(Math.floor(num(state.alchemy.level, 1)), 1, 10);
  const out = { ok: true, success, pillId: r.pillId, quality: null, count: 0 };
  if (success) {
    const w = weights(L).map((x, i) => ({ q: i, weight: x.weight }));
    out.quality = ctx.rng.weighted(w).q;
    out.count = Math.max(1, Math.floor(num(r.yield, 1)));
    addPill(state, ctx, r.pillId, out.quality, out.count);
    state.alchemy.xp += 3 * num(r.tier, 1);
  } else {
    state.alchemy.xp += 1;
  }
  while (state.alchemy.level < 10 && state.alchemy.xp >= 10 * state.alchemy.level) {
    state.alchemy.xp -= 10 * state.alchemy.level;
    state.alchemy.level += 1;
    out.levelUp = state.alchemy.level;
  }
  if (state.alchemy.level >= 10) state.alchemy.xp = Math.min(state.alchemy.xp, 10 * 10);
  ctx.bus.emit('alchemy:done', { success, pillId: r.pillId, quality: out.quality });
  addLog(state, ctx, success ? 'good' : 'bad', success ? `炼成${ctx.data.byId.pills.get(r.pillId)?.name || r.pillId}` : '丹炉炸裂，药材尽毁');
  return out;
}

export function usePill(state, ctx, pillId, q) {
  const pill = ctx.data.byId.pills.get(pillId);
  q = Math.floor(num(q, -1));
  if (!pill || q < 0 || q > 3) return fail('invalid');
  const arr = state.inventory.pills[pillId];
  if (!arr || arr[q] <= 0) return fail('not_owned');
  if (num(pill.realmReq) > state.stage) return fail('realm_too_low');
  const e = pill.effect || {};
  const v = num(e.value) * QUALITY_MULT[q];
  const realm = ctx.data.realm(state.stage);
  const res = { ok: true, type: e.type, value: v };
  switch (e.type) {
    case 'qi': {
      const cap = qiCap(state, ctx);
      if (state.qi >= cap) return fail('invalid');
      const before = state.qi;
      state.qi = clamp(state.qi + v * num(realm.qiCost), 0, cap);
      res.qiGained = state.qi - before;
      break;
    }
    case 'qiRate':
      addBuff(state, v, num(e.duration));
      break;
    case 'breakthrough':
      state.pending.breakthroughBonus = clamp(state.pending.breakthroughBonus + v, 0, 0.3);
      break;
    case 'tribulation':
      state.pending.tribulationResist = clamp(state.pending.tribulationResist + v, 0, 0.3);
      break;
    case 'lifespan': {
      const used = num(state.player.pillLifespanUses[pillId]);
      if (used >= 3) return fail('max_level');
      state.player.pillLifespanUses[pillId] = used + 1;
      state.player.lifespanBonus += v;
      break;
    }
    default:
      return fail('invalid'); // heal / mp 仅在战斗或渡劫中使用
  }
  arr[q] -= 1;
  inc(state.counters.pillUsed, pillId);
  ctx.bus.emit('pill:used', { pillId, q });
  return res;
}

// 渡劫 —— DESIGN §3.5
import { QUALITY_MULT } from './constants.js';
import { computeStats, equippedTreasures } from '../combat/stats.js';
import { setEnding } from './ending.js';
import { addLog, clamp, fail, inc, num } from './util.js';

function resistOf(state, ctx, S, realm, includePending = true) {
  const refDef = num(realm.baseStats.def);
  let r = S.def / Math.max(1e-9, S.def + 4 * refDef);
  for (const t of equippedTreasures(state, ctx)) r += num(t.tribResist);
  if (includePending) r += num(state.pending.tribulationResist);
  return clamp(r, 0, 0.85);
}

export function tribulationInfo(state, ctx) {
  const realm = ctx.data.realm(state.stage);
  const tb = realm.tribulation;
  if (!tb) return null;
  const S = computeStats(state, ctx);
  const resist = resistOf(state, ctx, S, realm);
  const R = Math.max(1, Math.floor(num(tb.rounds, 1)));
  let total = 0;
  for (let r = 1; r <= R; r++) total += num(tb.power) * num(realm.baseStats.hp) / R * (1 + 0.12 * (r - 1));
  const cost = num(realm.qiCost);
  const info = {
    name: tb.name, rounds: R, power: num(tb.power), lethal: !!tb.lethal, resist, hp: S.hp, maxHp: S.hp,
    expectedDmg: Math.round(total * (1 - resist)), cost, canAttempt: false,
    isAscend: state.stage >= ctx.data.realms.length - 1,
  };
  if (state.ending) info.reason = 'ended';
  else if (state.qi < cost) info.reason = 'not_enough_qi';
  else info.canAttempt = true;
  return info;
}

export function runTribulation(state, ctx, opts = {}) {
  const info = tribulationInfo(state, ctx);
  if (!info) return fail('invalid');
  if (!info.canAttempt) return fail(info.reason);
  const realm = ctx.data.realm(state.stage);
  const tb = realm.tribulation;
  const S = computeStats(state, ctx);
  const resist = info.resist;
  const R = info.rounds;
  const from = state.stage;
  const healPills = Array.isArray(opts?.healPills) ? [...opts.healPills] : [];
  let hp = S.hp, used = 0, died = false;
  const rounds = [];
  ctx.bus.emit('tribulation:start', { name: tb.name, rounds: R });
  inc(state.counters, 'tribulations');
  for (let r = 1; r <= R; r++) {
    const strike = num(tb.power) * num(realm.baseStats.hp) / R * (1 + 0.12 * (r - 1)) * ctx.rng.range(0.8, 1.2);
    const dmg = Math.max(0, Math.round(strike * (1 - resist)));
    hp -= dmg;
    let healed = 0;
    if (hp <= 0) {
      rounds.push({ r, strike: Math.round(strike), dmg, hp: 0, healed });
      died = true;
      break;
    }
    if (hp < 0.5 * S.hp && used < 3) {
      for (let i = 0; i < healPills.length; i++) {
        const hpill = healPills[i];
        const pill = ctx.data.byId.pills.get(hpill?.pillId);
        const q = clamp(Math.floor(num(hpill?.q)), 0, 3);
        const arr = state.inventory.pills[hpill?.pillId];
        if (!pill || pill.effect?.type !== 'heal' || !arr || arr[q] <= 0) continue;
        arr[q] -= 1;
        used++;
        healed = Math.round(num(pill.effect.value) * QUALITY_MULT[q] * S.hp);
        hp = Math.min(S.hp, hp + healed);
        inc(state.counters.pillUsed, pill.id);
        ctx.bus.emit('pill:used', { pillId: pill.id, q });
        healPills.splice(i, 1);
        break;
      }
    }
    rounds.push({ r, strike: Math.round(strike), dmg, hp: Math.max(0, Math.round(hp)), healed });
  }
  const cost = info.cost;
  state.pending.tribulationResist = 0;
  const rep = { ok: true, success: !died, name: tb.name, from, to: from, rounds, resist, maxHp: S.hp, hpEnd: Math.max(0, Math.round(hp)), death: false };
  if (!died) {
    state.qi = clamp(state.qi - cost, 0, Number.MAX_SAFE_INTEGER);
    if (info.isAscend) {
      rep.ending = setEnding(state, ctx, 'ascend');
    } else {
      state.stage = from + 1;
      rep.to = state.stage;
      ctx.bus.emit('realm:changed', { stage: state.stage });
      addLog(state, ctx, 'rare', `渡过${tb.name}，晋入${ctx.data.realm(state.stage).name}`);
    }
  } else {
    inc(state.counters, 'tribulationFails');
    state.qi = clamp(state.qi - 0.5 * cost, 0, Number.MAX_SAFE_INTEGER);
    state.injury.until = Math.max(state.injury.until, state.time.played + 600);
    addLog(state, ctx, 'bad', `${tb.name}失败，身受重伤`);
    if (tb.lethal) {
      let protect = 0;
      for (const t of equippedTreasures(state, ctx)) protect += num(t.protect);
      const p = 0.25 * (1 - clamp(protect, 0, 1));
      if (ctx.rng.chance(p)) {
        rep.death = true;
        rep.ending = setEnding(state, ctx, 'fallen');
      }
    }
  }
  ctx.bus.emit('tribulation:end', rep);
  return rep;
}

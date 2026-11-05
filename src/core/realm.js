// 境界与小境界破关 —— DESIGN §3.4
import { addLog, clamp, fail, inc, num } from './util.js';

export function getRealm(stage, data) {
  return data.realm(stage);
}
export function isMajorBreak(stage, data) {
  return !!data.realm(stage).tribulation;
}

export function breakthroughChance(state, ctx) {
  const r = ctx.data.realm(state.stage);
  return clamp(num(r.minorChance) + num(state.pending.breakthroughBonus) + num(state.legacy.breakBonus), 0.05, 1);
}

export function breakthroughInfo(state, ctx) {
  const r = ctx.data.realm(state.stage);
  const isMajor = !!r.tribulation;
  const cost = num(r.qiCost);
  const info = { canAttempt: false, isMajor, chance: breakthroughChance(state, ctx), cost };
  if (state.ending) info.reason = 'ended';
  else if (isMajor) info.reason = 'need_tribulation';
  else if (state.qi < cost) info.reason = 'not_enough_qi';
  else info.canAttempt = true;
  return info;
}

export function attemptBreakthrough(state, ctx) {
  const info = breakthroughInfo(state, ctx);
  if (!info.canAttempt) return fail(info.reason);
  const from = state.stage;
  const success = ctx.rng.next() < info.chance;
  inc(state.counters, 'breakthroughs');
  state.pending.breakthroughBonus = 0;
  if (success) {
    state.qi = clamp(state.qi - info.cost, 0, Number.MAX_SAFE_INTEGER);
    state.stage = from + 1;
    ctx.bus.emit('realm:changed', { stage: state.stage });
    addLog(state, ctx, 'good', `突破至${ctx.data.realm(state.stage).name}`);
  } else {
    inc(state.counters, 'breakthroughFails');
    state.qi = clamp(state.qi - 0.3 * info.cost, 0, Number.MAX_SAFE_INTEGER);
    addLog(state, ctx, 'bad', '破关失败，灵气受损');
  }
  ctx.bus.emit('breakthrough', { success, from, to: success ? state.stage : from, chance: info.chance });
  return { ok: true, success, from, to: state.stage, chance: info.chance };
}

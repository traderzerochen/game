// 修炼速度与时间推进 —— DESIGN §3.3
import { QI_CAP_MULT, OFFLINE_CAP_SEC, OFFLINE_EFFICIENCY, INJURY_QI_MULT, GARDEN_INTERVAL, GARDEN_CAP, YEAR_SECONDS } from './constants.js';
import { affinity } from './techniques.js';
import { lifespan, setEnding } from './ending.js';
import { num, clamp } from './util.js';

export function qiCap(state, ctx) {
  return QI_CAP_MULT * num(ctx.data.realm(state.stage).qiCost);
}

function rateAt(state, ctx, t) {
  const realm = ctx.data.realm(state.stage);
  const roots = state.player.roots;
  const rootMult = num(ctx.data.roots.tiers[roots.length]?.mult, 1);
  const hid = state.techniques.equipped.heart;
  const h = hid && ctx.data.byId.techniques.get(hid);
  let heartMult = 1;
  if (h) {
    const lv = num(state.techniques.owned[hid], 1);
    const e = h.effect || {};
    heartMult = 1 + (num(e.qiRate) + num(e.qiRatePerLv) * (lv - 1)) * affinity(h, roots);
  }
  let buff = 0;
  for (const b of state.buffs) if (b.type === 'qiRate' && b.until > t) buff += num(b.value);
  const r = num(realm.baseRate) * rootMult * heartMult * (1 + buff) * (1 + num(state.legacy.qiBonus)) *
    (state.injury.until > t ? INJURY_QI_MULT : 1);
  return Math.max(0, num(r));
}

export function qiRate(state, ctx) {
  return rateAt(state, ctx, state.time.played);
}

export function advance(state, ctx, sec, { offline = false } = {}) {
  const res = { qiGained: 0, gardenGained: 0 };
  if (state.ending) return { ...res, ended: state.ending.id };
  let dt = num(sec, 0);
  if (dt <= 0) return res;
  dt = Math.min(dt, 1e9);
  // 寿元截断
  const left = (lifespan(state, ctx) - state.player.age) * YEAR_SECONDS;
  let dies = false;
  if (left <= dt) { dt = Math.max(0, left); dies = true; }
  const start = state.time.played, end = start + dt;
  const cap = qiCap(state, ctx);
  const eff = offline ? OFFLINE_EFFICIENCY : 1;
  const pts = new Set();
  for (const b of state.buffs) if (b.until > start && b.until < end) pts.add(b.until);
  if (state.injury.until > start && state.injury.until < end) pts.add(state.injury.until);
  const cuts = [start, ...[...pts].sort((a, b) => a - b), end];
  const qi0 = state.qi;
  let qi = qi0;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const slice = cuts[i + 1] - cuts[i];
    if (slice > 0) qi = Math.min(cap, qi + rateAt(state, ctx, cuts[i]) * slice * eff);
  }
  state.qi = clamp(qi, 0, cap);
  res.qiGained = Math.max(0, state.qi - qi0);
  state.time.played = end;
  state.player.age = num(state.player.age) + dt / YEAR_SECONDS;
  state.buffs = state.buffs.filter((b) => b.until > end);
  // 药园
  const g = state.garden;
  g.acc = num(g.acc) + dt;
  const n = Math.floor(g.acc / GARDEN_INTERVAL);
  if (n > 0) {
    g.acc -= n * GARDEN_INTERVAL;
    const add = Math.max(0, Math.min(GARDEN_CAP - g.pending, n));
    g.pending += add;
    res.gardenGained = add;
  }
  if (dies) {
    state.player.age = Math.max(state.player.age, lifespan(state, ctx));
    setEnding(state, ctx, 'sit');
    res.ended = 'sit';
  }
  return res;
}

export function applyOffline(state, ctx, nowMs) {
  const last = num(state.time.lastSeen, 0);
  let seconds = last > 0 ? (num(nowMs, 0) - last) / 1000 : 0;
  if (!(seconds > 0)) seconds = 0;
  const capped = seconds > OFFLINE_CAP_SEC;
  const sec = Math.min(seconds, OFFLINE_CAP_SEC);
  const r = sec > 0 ? advance(state, ctx, sec, { offline: true }) : { qiGained: 0 };
  if (num(nowMs) > 0) state.time.lastSeen = nowMs;
  const out = { seconds: sec, capped, qiGained: r.qiGained };
  if (sec > 0) ctx.bus.emit('offline', out);
  return out;
}

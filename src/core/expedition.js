// 历练（秘境）—— DESIGN §3.12
import { computeStats } from '../combat/stats.js';
import { makePlayerUnit, makeEnemyUnit, simulateBattle } from '../combat/battle.js';
import { addHerb, addPill, addStones, giveTreasure, giveTechnique } from './inventory.js';
import { addLog, clamp, fail, inc, num } from './util.js';
import { qiCap } from './cultivation.js';

export function canEnter(state, ctx, id) {
  if (state.ending) return fail('ended');
  const d = ctx.data.byId.dungeons.get(id);
  if (!d) return fail('invalid');
  if (state.stage < num(d.realmReq)) return fail('realm_too_low');
  const wait = num(state.expeditions.readyAt[id], 0) - state.time.played;
  if (wait > 0) return { ok: false, reason: 'cooldown', readyIn: wait };
  return { ok: true };
}

function rollRange(rng, r) {
  if (Array.isArray(r)) return rng.int(Math.floor(num(r[0])), Math.max(Math.floor(num(r[0])), Math.floor(num(r[1], r[0]))));
  return Math.floor(num(r));
}

function addBuff(state, value, duration) {
  const until = state.time.played + num(duration);
  const b = state.buffs.find((x) => x.type === 'qiRate' && x.until > state.time.played);
  if (b) { b.value = Math.max(b.value, value); b.until = Math.max(b.until, until); }
  else state.buffs.push({ type: 'qiRate', value, until });
}
export { addBuff };

/**
 * 执行单个效果。run = {hp, maxHp, loot:{stones,herbs,pills,treasures,techniques}, dungeon, failed, retreat}
 * 返回描述对象。物品直接入包，灵石累计到 run.loot.stones，最后统一结算。
 */
export function resolveEffect(state, ctx, eff, run) {
  const rng = ctx.rng;
  const out = { type: eff.type };
  switch (eff.type) {
    case 'stones': {
      const n = rng.int(Math.floor(num(eff.min)), Math.max(Math.floor(num(eff.min)), Math.floor(num(eff.max, eff.min))));
      run.loot.stones += n; out.count = n; break;
    }
    case 'herb': {
      const id = eff.herbId || rng.pick(eff.pool || []);
      const n = rollRange(rng, eff.count ?? 1);
      if (id && n > 0 && ctx.data.byId.herbs.has(id)) { addHerb(state, ctx, id, n); run.loot.herbs[id] = (run.loot.herbs[id] || 0) + n; out.id = id; out.count = n; }
      break;
    }
    case 'qi': {
      const g = num(eff.ratio) * num(ctx.data.realm(state.stage).qiCost);
      const before = state.qi;
      state.qi = clamp(state.qi + g, 0, qiCap(state, ctx));
      out.count = state.qi - before; break;
    }
    case 'hp': {
      const d = Math.round(num(eff.ratio) * run.maxHp);
      run.hp = clamp(run.hp + d, 0, run.maxHp); out.count = d; break;
    }
    case 'battle': {
      const eid = eff.enemyId || rng.pick(run.dungeon.enemyPool || []);
      const enemy = ctx.data.byId.enemies.get(eid);
      if (!enemy) break;
      out.battle = fight(state, ctx, enemy, run); out.enemyId = eid; break;
    }
    case 'treasure': {
      if (eff.chance != null && !rng.chance(num(eff.chance, 1))) break;
      const r = giveTreasure(state, ctx, eff.treasureId, true);
      if (r.dup) run.loot.stones += 0; else run.loot.treasures.push(eff.treasureId);
      out.id = eff.treasureId; out.dup = r.dup; out.stones = r.stones; run.loot.dupStones += r.stones; run.loot.stones += r.stones; break;
    }
    case 'technique': {
      if (eff.chance != null && !rng.chance(num(eff.chance, 1))) break;
      const r = giveTechnique(state, ctx, eff.techniqueId, true);
      if (!r.dup) run.loot.techniques.push(eff.techniqueId);
      out.id = eff.techniqueId; out.dup = r.dup; out.stones = r.stones; run.loot.dupStones += r.stones; run.loot.stones += r.stones; break;
    }
    case 'pill': {
      const n = Math.max(1, Math.floor(num(eff.count, 1)));
      addPill(state, ctx, eff.pillId, eff.quality ?? 0, n);
      run.loot.pills.push({ pillId: eff.pillId, q: eff.quality ?? 0, count: n });
      out.id = eff.pillId; out.count = n; break;
    }
    case 'buff': {
      addBuff(state, num(eff.value), num(eff.duration)); out.count = num(eff.value); break;
    }
    default: break;
  }
  return out;
}

function fight(state, ctx, enemy, run) {
  const a = makePlayerUnit(state, ctx);
  a.hp = clamp(Math.round(run.hp), 1, a.maxHp);
  const b = makeEnemyUnit(enemy);
  const res = simulateBattle(a, b, ctx, { pillRules: state.battleConfig.pillRules, inventory: state.inventory, counters: state.counters });
  inc(state.counters, 'battles');
  run.hp = res.winner === 'enemy' ? 0 : a.hp;
  if (res.winner === 'player') {
    inc(state.counters, 'battlesWon');
    inc(state.counters.enemyDefeated, enemy.id);
    const d = enemy.drops || {};
    const stones = rollRange(ctx.rng, d.stones ?? 0);
    run.loot.stones += stones;
    const herbs = [];
    for (const h of d.herbs || []) {
      if (ctx.rng.chance(num(h.chance))) {
        const n = rollRange(ctx.rng, h.count ?? 1);
        if (n > 0) { addHerb(state, ctx, h.herbId, n); run.loot.herbs[h.herbId] = (run.loot.herbs[h.herbId] || 0) + n; herbs.push({ herbId: h.herbId, count: n }); }
      }
    }
    const treasures = [];
    for (const t of d.treasures || []) {
      if (ctx.rng.chance(num(t.chance))) {
        const r = giveTreasure(state, ctx, t.treasureId, true);
        run.loot.dupStones += r.stones; run.loot.stones += r.stones;
        if (!r.dup) run.loot.treasures.push(t.treasureId);
        treasures.push({ treasureId: t.treasureId, dup: r.dup });
      }
    }
    res.drops = { stones, herbs, treasures };
  }
  ctx.bus.emit('battle:end', { winner: res.winner, enemyId: enemy.id });
  return { enemyId: enemy.id, name: enemy.name, winner: res.winner, rounds: res.rounds, log: res.log, playerHpEnd: res.playerHpEnd, playerMaxHp: a.maxHp, enemyMaxHp: b.maxHp, pillsUsed: res.pillsUsed, drops: res.drops };
}

function gainsOf(results) {
  const g = [];
  for (const r of results) {
    if (r.type === 'stones' && r.count) g.push({ kind: 'stones', count: r.count });
    else if (r.type === 'herb' && r.id) g.push({ kind: 'herb', id: r.id, count: r.count });
    else if (r.type === 'pill' && r.id) g.push({ kind: 'pill', id: r.id, count: r.count });
    else if ((r.type === 'treasure' || r.type === 'technique') && r.id) g.push({ kind: r.type, id: r.id, count: 1, dup: !!r.dup });
    else if (r.type === 'qi' && r.count) g.push({ kind: 'qi', count: r.count });
    else if (r.type === 'battle' && r.battle?.drops) {
      const d = r.battle.drops;
      if (d.stones) g.push({ kind: 'stones', count: d.stones });
      for (const h of d.herbs) g.push({ kind: 'herb', id: h.herbId, count: h.count });
      for (const t of d.treasures) g.push({ kind: 'treasure', id: t.treasureId, count: 1, dup: t.dup });
    }
  }
  return g;
}

export function runExpedition(state, ctx, id) {
  const can = canEnter(state, ctx, id);
  if (!can.ok) return can;
  const d = ctx.data.byId.dungeons.get(id);
  const S = computeStats(state, ctx);
  const run = {
    hp: S.hp, maxHp: S.hp, hpStart: S.hp, dungeon: d,
    loot: { stones: 0, dupStones: 0, herbs: {}, pills: [], treasures: [], techniques: [] },
  };
  const steps = [];
  const total = Math.max(1, Math.floor(num(d.steps, 5)));
  let defeated = false, retreat = false;
  inc(state.counters.dungeonRuns, id);
  for (let i = 0; i < total - 1 && !defeated; i++) {
    const pool = (d.eventPool || []).filter((e) => ctx.data.byId.events.has(e.eventId));
    if (!pool.length) break;
    const ev = ctx.data.byId.events.get(ctx.rng.weighted(pool).eventId);
    inc(state.counters.eventTriggered, ev.id);
    let passed = true;
    if (ev.check) {
      const v = num(S[ev.check.stat]) * ctx.rng.range(0.7, 1.3);
      passed = v >= num(ev.check.difficulty);
    }
    const effects = (passed ? ev.effects : ev.failEffects) || [];
    const results = [];
    for (const eff of effects) {
      results.push(resolveEffect(state, ctx, eff, run));
      if (run.hp <= 0) { defeated = true; break; }
    }
    steps.push({ index: i, kind: 'event', eventId: ev.id, type: ev.type, name: ev.name, text: passed ? ev.text : ev.textFail || ev.text, passed, effects: results, gains: gainsOf(results), hp: run.hp, hpAfter: run.hp, battle: results.find((x) => x.battle)?.battle });
  }
  let cleared = false;
  const boss = !defeated && ctx.data.byId.enemies.get(d.boss);
  if (boss) {
    const battle = fight(state, ctx, boss, run);
    steps.push({ index: steps.length, kind: 'boss', eventId: null, type: 'boss', name: boss.name, text: '', enemyId: boss.id, effects: [{ type: 'battle', battle }], gains: gainsOf([{ type: 'battle', battle }]), hp: run.hp, hpAfter: run.hp, battle });
    if (battle.winner === 'player') cleared = true;
    else if (battle.winner === 'enemy') defeated = true;
    else retreat = true;
  }
  let reward = null;
  if (cleared) {
    const cr = d.clearReward || {};
    reward = { stones: rollRange(ctx.rng, cr.stones ?? 0), herbs: [], treasure: null };
    run.loot.stones += reward.stones;
    for (const h of cr.herbs || []) { addHerb(state, ctx, h.herbId, h.count); run.loot.herbs[h.herbId] = (run.loot.herbs[h.herbId] || 0) + num(h.count); reward.herbs.push(h); }
    if (cr.treasure && ctx.rng.chance(num(cr.treasure.chance, 1))) {
      const r = giveTreasure(state, ctx, cr.treasure.treasureId, true);
      run.loot.dupStones += r.stones; run.loot.stones += r.stones;
      if (!r.dup) run.loot.treasures.push(cr.treasure.treasureId);
      reward.treasure = { treasureId: cr.treasure.treasureId, dup: r.dup };
    }
    inc(state.expeditions.cleared, id);
  }
  const stones = Math.floor(run.loot.stones * (defeated ? 0.5 : 1));
  addStones(state, ctx, stones);
  state.expeditions.readyAt[id] = state.time.played + num(d.cooldown);
  if (defeated) state.injury.until = Math.max(state.injury.until, state.time.played + 300);
  addLog(state, ctx, defeated ? 'bad' : cleared ? 'good' : 'info', defeated ? `${d.name}历练失败，负伤而归` : cleared ? `${d.name}历练通关` : `${d.name}历练结束`);
  const report = {
    ok: true, dungeonId: id, name: d.name, success: cleared, cleared, defeated, retreat,
    steps, stones, dupStones: run.loot.dupStones, herbs: run.loot.herbs, pills: run.loot.pills,
    treasures: run.loot.treasures, techniques: run.loot.techniques, clearReward: reward,
    hpStart: run.hpStart, hpEnd: run.hp, maxHp: run.maxHp, injured: defeated,
    reason: cleared ? undefined : defeated ? 'defeated' : 'retreat',
    gains: { stones, herbs: run.loot.herbs, pills: run.loot.pills, treasures: run.loot.treasures, techniques: run.loot.techniques },
  };
  ctx.bus.emit('expedition:end', report);
  return report;
}

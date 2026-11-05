// 整体模拟（lead）：500 个角色用固定种子，从开局玩到金丹前期（stage 6）。
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../../src/data/index.js';
import { createGame } from '../../src/core/game.js';
import { playCharacter } from './policy.js';

const N = Number(process.env.SIM_N || 500);
const TARGET = 6;
const BASE_SEED = 20261105;

function assertSane(game, tag) {
  const v = game.view();
  const nums = {
    qi: v.qi, qiCap: v.qiCap, qiRate: v.qiRate, age: v.age, lifespan: v.lifespan, stones: v.stones, played: v.played,
    ...Object.fromEntries(Object.entries(v.stats).filter(([, x]) => typeof x === 'number').map(([k, x]) => ['stat.' + k, x])),
  };
  for (const [k, x] of Object.entries(nums)) {
    assert.ok(Number.isFinite(x), `${tag}: ${k} not finite (${x})`);
    assert.ok(x >= 0, `${tag}: ${k} negative (${x})`);
  }
  assert.ok(v.qi <= v.qiCap + 1e-6, `${tag}: qi ${v.qi} > cap ${v.qiCap}`);
  const b = v.breakthrough;
  if (b && b.chance != null) assert.ok(b.chance >= 0 && b.chance <= 1, `${tag}: breakthrough chance ${b.chance}`);
  const t = v.tribulation;
  if (t) {
    assert.ok(t.resist >= 0 && t.resist <= 1, `${tag}: resist ${t.resist}`);
    assert.ok(Number.isFinite(t.expectedDmg) && t.expectedDmg >= 0, `${tag}: expectedDmg ${t.expectedDmg}`);
  }
  const inv = game.state.inventory;
  for (const [id, c] of Object.entries(inv.herbs)) assert.ok(Number.isInteger(c) && c >= 0, `${tag}: herb ${id}=${c}`);
  for (const [id, arr] of Object.entries(inv.pills)) arr.forEach((c, q) => assert.ok(Number.isInteger(c) && c >= 0, `${tag}: pill ${id}[${q}]=${c}`));
}

test(`simulation: ${N} characters reach 金丹 without errors`, () => {
  const union = { techniqueUsed: {}, pillUsed: {}, eventTriggered: {}, enemyDefeated: {} };
  const played = [];
  let tribs = 0, tribFails = 0, endings = 0, steps = 0;
  const failures = [];
  for (let i = 0; i < N; i++) {
    const seed = BASE_SEED + i;
    const game = createGame({ data: DATA, seed, now: () => 0 });
    game.newGame({ seed });
    let k = 0;
    let r;
    try {
      r = playCharacter(game, DATA, {
        targetStage: TARGET,
        maxPlayed: 200 * 3600,
        onStep: (g) => { if (++k % 7 === 0) assertSane(g, `seed ${seed} step ${k}`); },
      });
      assertSane(game, `seed ${seed} end`);
    } catch (e) {
      failures.push(`seed ${seed}: ${e.message}`);
      continue;
    }
    if (!r.reached) failures.push(`seed ${seed}: stuck at stage ${r.stage}, played ${(r.played / 3600).toFixed(1)}h, ending ${r.ending?.id}`);
    if (r.ending) endings++;
    steps += r.steps;
    played.push(r.played);
    const c = game.state.counters;
    tribs += c.tribulations; tribFails += c.tribulationFails;
    for (const key of Object.keys(union)) for (const [id, n] of Object.entries(c[key] || {})) union[key][id] = (union[key][id] || 0) + n;
  }
  assert.deepEqual(failures.slice(0, 10), [], `${failures.length} characters failed`);
  assert.equal(endings, 0, 'no character should end (坐化/陨落) before 金丹');

  played.sort((a, b) => a - b);
  const h = (p) => (played[Math.floor(p * (played.length - 1))] / 3600).toFixed(2);
  const report = {
    characters: N, medianHours: h(0.5), p10Hours: h(0.1), p90Hours: h(0.9),
    tribulationFailRate: (tribFails / Math.max(1, tribs)).toFixed(2), avgSteps: Math.round(steps / N),
  };
  console.log('[sim] balance report', JSON.stringify(report));
  // 节奏：普通玩家 1–4 小时游戏时间到金丹（允许一定浮动）
  assert.ok(Number(report.medianHours) >= 0.75 && Number(report.medianHours) <= 5, `median hours ${report.medianHours}`);

  // 自然游玩的覆盖：金丹前可进入的秘境里，每个事件都至少触发一次
  const reachable = DATA.dungeons.filter((d) => d.realmReq < TARGET);
  const missingEvents = [];
  for (const d of reachable) for (const { eventId } of d.eventPool) if (!union.eventTriggered[eventId]) missingEvents.push(`${d.id}/${eventId}`);
  assert.deepEqual(missingEvents, [], 'events never triggered in natural play');
  // 金丹前所有敌人至少被击败一次
  const missingEnemies = [];
  for (const d of reachable) for (const id of [...d.enemyPool, d.boss]) if (!union.enemyDefeated[id]) missingEnemies.push(id);
  assert.deepEqual([...new Set(missingEnemies)], [], 'enemies never defeated');
  console.log('[sim] natural coverage', JSON.stringify({
    techniquesUsed: Object.keys(union.techniqueUsed).length, pillsUsed: Object.keys(union.pillUsed).length,
    events: Object.keys(union.eventTriggered).length, enemies: Object.keys(union.enemyDefeated).length,
  }));
});

test('simulation is deterministic for a fixed seed', () => {
  const run = () => {
    const g = createGame({ data: DATA, seed: 77, now: () => 0 });
    g.newGame({ seed: 77 });
    playCharacter(g, DATA, { targetStage: 4 });
    return JSON.stringify({ st: g.state.stage, qi: g.state.qi, p: g.state.time.played, inv: g.state.inventory, c: g.state.counters });
  };
  assert.equal(run(), run());
});

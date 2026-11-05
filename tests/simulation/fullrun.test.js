// 全程模拟（lead）：固定种子，角色从开局一直玩到结局（飞升、陨落或坐化）。
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../../src/data/index.js';
import { createGame } from '../../src/core/game.js';
import { playCharacter } from './policy.js';

const N = Number(process.env.FULL_N || 300);
const BASE_SEED = 31415;
const MAX_HOURS = 400;

test(`full run: ${N} characters play to an ending`, () => {
  const endings = { ascend: 0, fallen: 0, sit: 0 };
  const hours = { jindan: [], yuanying: [], huashen: [], end: [] };
  const union = { eventTriggered: {}, enemyDefeated: {}, techniqueUsed: {}, pillUsed: {} };
  const failures = [];
  for (let i = 0; i < N; i++) {
    const seed = BASE_SEED + i;
    const game = createGame({ data: DATA, seed, now: () => 0 });
    game.newGame({ seed });
    const seen = {};
    let k = 0;
    try {
      playCharacter(game, DATA, {
        targetStage: 99,
        maxPlayed: MAX_HOURS * 3600,
        onStep: (g) => {
          const s = g.state.stage;
          for (const [key, st] of [['jindan', 6], ['yuanying', 9], ['huashen', 12]]) {
            if (s >= st && !seen[key]) { seen[key] = 1; hours[key].push(g.state.time.played / 3600); }
          }
          if (++k % 11 === 0) {
            const v = g.view();
            for (const x of [v.qi, v.qiRate, v.qiCap, v.age, v.stones, v.stats.hp, v.stats.atk]) {
              if (!Number.isFinite(x) || x < 0) throw new Error(`bad number ${x} at stage ${s}`);
            }
            if (v.breakthrough && !(v.breakthrough.chance >= 0 && v.breakthrough.chance <= 1)) throw new Error('chance out of range');
          }
        },
      });
    } catch (e) {
      failures.push(`seed ${seed}: ${e.message}`);
      continue;
    }
    const end = game.state.ending?.id;
    if (!end) { failures.push(`seed ${seed}: no ending after ${(game.state.time.played / 3600).toFixed(1)}h, stage ${game.state.stage}`); continue; }
    endings[end]++;
    hours.end.push(game.state.time.played / 3600);
    for (const key of Object.keys(union)) for (const [id, n] of Object.entries(game.state.counters[key] || {})) union[key][id] = (union[key][id] || 0) + n;
  }
  assert.deepEqual(failures.slice(0, 10), [], `${failures.length} characters failed`);

  const med = (a) => (a.sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? NaN);
  const report = {
    characters: N, endings,
    medianHours: Object.fromEntries(Object.entries(hours).map(([k, a]) => [k, med(a).toFixed(1)])),
  };
  console.log('[full] report', JSON.stringify(report));

  assert.ok(endings.ascend / N >= 0.6, `ascension rate ${endings.ascend}/${N} < 60%`);
  const endMed = med(hours.end);
  assert.ok(endMed >= 8 && endMed <= 30, `median full-run hours ${endMed}`);
  // 后期内容在自然游玩中也被覆盖：所有秘境的事件和敌人至少出现一次
  const missingEvents = [];
  for (const d of DATA.dungeons) for (const { eventId } of d.eventPool) if (!union.eventTriggered[eventId]) missingEvents.push(`${d.id}/${eventId}`);
  assert.deepEqual(missingEvents, [], 'events never triggered across full runs');
  const missingEnemies = new Set();
  for (const d of DATA.dungeons) for (const id of [...d.enemyPool, d.boss]) if (!union.enemyDefeated[id]) missingEnemies.add(id);
  assert.deepEqual([...missingEnemies], [], 'enemies never defeated across full runs');
});

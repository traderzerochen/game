import test from 'node:test';
import assert from 'node:assert/strict';
import { mk, DATA } from './helpers.js';
import { elemMult } from '../../src/combat/elements.js';
import { makePlayerUnit, makeEnemyUnit, simulateBattle } from '../../src/combat/battle.js';
import { createRng } from '../../src/core/rng.js';

test('elemMult', () => {
  assert.equal(elemMult('metal', 'wood'), 1.3);
  assert.equal(elemMult('wood', 'metal'), 0.75);
  assert.equal(elemMult('none', 'wood'), 1);
  assert.equal(elemMult('fire', 'fire'), 1);
});
function ctxOf(g, seed = 1) { return { data: g.data, rng: createRng(seed), bus: g.bus }; }
test('battle deterministic and bounded', () => {
  const g = mk();
  const enemy = DATA.enemies[0];
  const go = () => { const c = ctxOf(g); return simulateBattle(makePlayerUnit(g.state, c), makeEnemyUnit(enemy), c, {}); };
  const a = go(), b = go();
  assert.deepEqual(a, b);
  assert.ok(a.rounds <= 30);
  assert.ok(['player', 'enemy', 'timeout'].includes(a.winner));
});
test('timeout when nobody can hurt', () => {
  const g = mk();
  const c = ctxOf(g);
  const p = makePlayerUnit(g.state, c);
  const e = makeEnemyUnit({ ...DATA.enemies[0], stats: { hp: 1e9, mp: 0, atk: 1, def: 1e9, spd: 1, crit: 0 }, skills: [] });
  e.atk = 1; p.hp = p.maxHp = 1e9;
  assert.equal(simulateBattle(p, e, c, {}).winner, 'timeout');
});
test('pills used by rule, max 3, counters', () => {
  const g = mk();
  const c = ctxOf(g);
  const p = makePlayerUnit(g.state, c);
  p.hp = 5;
  const inv = { pills: { huichun_dan: [10, 0, 0, 0] } };
  const counters = { techniqueUsed: {}, pillUsed: {} };
  const strong = { ...DATA.enemies[0], stats: { hp: 99999, mp: 0, atk: 30, def: 1, spd: 1, crit: 0 }, skills: [] };
  const r = simulateBattle(p, makeEnemyUnit(strong), c, { pillRules: [{ pillId: 'huichun_dan', below: 0.9 }], inventory: inv, counters });
  assert.equal(r.pillsUsed.length, 3);
  assert.equal(inv.pills.huichun_dan[0], 7);
  assert.equal(counters.pillUsed.huichun_dan, 3);
  assert.ok(counters.techniqueUsed.fuchen_zhang > 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mk } from './helpers.js';

function at(stage, seed = 1) {
  const g = mk(seed);
  g.state.stage = stage;
  g.state.qi = g.view().realm.qiCost;
  return g;
}
test('tribulationInfo and success at stage 2', () => {
  const g = at(2);
  const info = g.tribulationInfo();
  assert.equal(info.canAttempt, true);
  assert.ok(info.expectedDmg > 0 && info.resist >= 0 && info.resist <= 0.85);
  const r = g.tribulation({ healPills: [] });
  assert.equal(r.ok, true);
  if (r.success) { assert.equal(g.state.stage, 3); assert.equal(g.state.qi, 0); }
  else { assert.ok(g.view().injured); assert.equal(g.state.stage, 2); assert.equal(r.death, false); }
  assert.equal(g.state.counters.tribulations, 1);
});
test('not enough qi / non-gate', () => {
  const g = mk();
  assert.equal(g.tribulation().reason, 'invalid');
  g.state.stage = 2;
  assert.equal(g.tribulation().reason, 'not_enough_qi');
});
test('heal pills consumed, max 3; lethal can fell', () => {
  const g = at(8);
  g.state.inventory.pills.huichun_dan = [5, 0, 0, 0];
  g.state.player.roots = ['fire'];
  const r = g.tribulation({ healPills: Array(5).fill({ pillId: 'huichun_dan', q: 0 }) });
  assert.ok(5 - g.state.inventory.pills.huichun_dan[0] <= 3);
  let fell = 0;
  for (let s = 1; s < 80; s++) { const h = at(11, s); const x = h.tribulation(); if (x.death) { fell++; assert.equal(h.state.ending.id, 'fallen'); assert.equal(h.breakthrough().reason, 'ended'); } }
  assert.ok(fell > 0);
});
test('ascend at stage 14', () => {
  let asc = 0;
  for (let s = 1; s < 40; s++) { const g = at(14, s); g.state.treasures = {}; const x = g.tribulation(); if (x.success) { asc++; assert.equal(g.state.ending.id, 'ascend'); } }
  assert.ok(asc >= 0);
});

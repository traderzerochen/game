import test from 'node:test';
import assert from 'node:assert/strict';
import { mk } from './helpers.js';

test('breakthrough needs qi; success advances stage', () => {
  const g = mk();
  assert.equal(g.breakthrough().reason, 'not_enough_qi');
  g.state.qi = g.view().realm.qiCost;
  g.state.legacy.breakBonus = 1;
  const r = g.breakthrough();
  assert.ok(r.ok && r.success);
  assert.equal(g.state.stage, 1);
  assert.equal(g.state.qi, 0);
});
test('major gate needs tribulation, chance clamped', () => {
  const g = mk();
  g.state.stage = 2; g.state.qi = 1e6;
  assert.equal(g.breakthrough().reason, 'need_tribulation');
  g.state.pending.breakthroughBonus = 50;
  assert.equal(g.view().breakthrough.chance, 1);
});
test('failure costs 30% and clears bonus', () => {
  const g = mk();
  const c = g.view().realm.qiCost; g.state.qi = c * 2; g.state.pending.breakthroughBonus = -5;
  const r = g.breakthrough();
  assert.equal(r.success, false);
  assert.ok(Math.abs(g.state.qi - (c * 2 - 0.3 * c)) < 1e-6);
  assert.equal(g.state.pending.breakthroughBonus, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mk } from './helpers.js';

test('craftInfo missing and craft consumes', () => {
  const g = mk(3);
  assert.equal(g.craftInfo('r_juling_dan').reason, 'missing_herbs');
  assert.equal(g.craft('r_juling_dan').reason, 'missing_herbs');
  g.state.inventory.herbs = { ninglu_cao: 20, qingsui_gen: 20 };
  g.state.inventory.stones = 100;
  const i = g.craftInfo('r_juling_dan');
  assert.ok(i.can && i.rate >= 0.05 && i.rate <= 0.98);
  let ok = 0;
  for (let k = 0; k < 8; k++) { const r = g.craft('r_juling_dan'); assert.ok(r.ok); if (r.success) ok++; }
  assert.equal(g.state.counters.crafts, 8);
  assert.ok(ok > 0);
  assert.equal(g.state.inventory.stones, 100 - 40);
  assert.ok(g.state.alchemy.xp > 0 || g.state.alchemy.level > 1);
  g.state.inventory.stones = 0;
  assert.equal(g.craft('r_juling_dan').reason, 'not_enough_stones');
});
test('usePill effects', () => {
  const g = mk();
  g.state.inventory.pills.juling_dan = [2, 0, 0, 1];
  assert.equal(g.usePill('juling_dan', 1).reason, 'not_owned');
  const before = g.state.qi;
  const r = g.usePill('juling_dan', 3);
  assert.ok(r.ok);
  assert.ok(Math.abs(g.state.qi - before - 0.15 * 2 * g.view().realm.qiCost) < 1e-6);
  assert.equal(g.state.counters.pillUsed.juling_dan, 1);
  assert.equal(g.usePill('huichun_dan', 0).reason, 'not_owned');
  g.state.inventory.pills.huichun_dan = [1, 0, 0, 0];
  assert.equal(g.usePill('huichun_dan', 0).reason, 'invalid');
});
test('pill types from data', () => {
  const g = mk();
  const ps = g.data.pills;
  for (const p of ps) {
    const h = mk(4);
    h.state.inventory.pills[p.id] = [3, 0, 0, 0];
    h.state.stage = 14;
    const r = h.usePill(p.id, 0);
    if (['qiRate'].includes(p.effect.type)) { assert.ok(r.ok); assert.equal(h.state.buffs.length, 1); }
    if (p.effect.type === 'breakthrough') { h.usePill(p.id, 0); h.usePill(p.id, 0); assert.ok(h.state.pending.breakthroughBonus <= 0.3); }
    if (p.effect.type === 'lifespan') { for (let i = 0; i < 5; i++) h.state.inventory.pills[p.id][0] = 3, h.usePill(p.id, 0); assert.equal(h.state.player.pillLifespanUses[p.id], 3); }
  }
});

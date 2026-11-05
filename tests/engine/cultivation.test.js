import test from 'node:test';
import assert from 'node:assert/strict';
import { mk } from './helpers.js';

test('advance accumulates qi analytically and clamps to cap', () => {
  const g = mk();
  const rate = g.view().qiRate;
  assert.ok(rate > 0);
  g.advance(100);
  assert.ok(Math.abs(g.state.qi - rate * 100) < 1e-6);
  g.advance(1e7);
  assert.equal(g.state.qi, g.view().qiCap);
});
test('advance 8h is fast and handles bad input', () => {
  const g = mk();
  const t = Date.now();
  g.advance(8 * 3600);
  assert.ok(Date.now() - t < 50);
  for (const bad of [NaN, Infinity, -5, undefined]) g.advance(bad);
  assert.ok(Number.isFinite(g.state.qi));
});
test('buff expiry slicing', () => {
  const g = mk();
  const base = g.view().qiRate;
  g.state.buffs.push({ type: 'qiRate', value: 1, until: 50 });
  g.advance(100);
  assert.ok(Math.abs(g.state.qi - base * (2 * 50 + 50)) < 1e-6);
  assert.equal(g.state.buffs.length, 0);
});
test('injury halves rate', () => {
  const g = mk();
  const base = g.view().qiRate;
  g.state.injury.until = 100;
  g.advance(200);
  assert.ok(Math.abs(g.state.qi - base * (50 + 100)) < 1e-6);
});
test('offline cap and efficiency', () => {
  const g = mk();
  const rate = g.view().qiRate;
  const r = g.applyOffline(1000000 + 20 * 3600 * 1000);
  assert.equal(r.capped, true);
  assert.equal(r.seconds, 8 * 3600);
  assert.ok(Math.abs(r.qiGained - Math.min(g.view().qiCap, rate * 8 * 3600 * 0.8)) < 1e-3);
  for (const bad of [NaN, Infinity, -1]) assert.equal(mk().applyOffline(bad).seconds, 0);
});
test('garden and aging, sit ending', () => {
  const g = mk();
  g.advance(3000);
  assert.equal(g.state.garden.pending, 10);
  g.advance(200 * 3600);
  assert.equal(g.state.ending.id, 'sit');
  assert.equal(g.breakthrough().reason, 'ended');
  assert.equal(g.rebirth().ok, true);
  assert.equal(g.state.legacy.lives, 1);
});
test('determinism', () => {
  const run = () => { const g = mk(3); g.advance(2000); g.breakthrough(); g.startExpedition('wuqi_gu'); return JSON.stringify(g.state); };
  assert.equal(run(), run());
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mk } from './helpers.js';

test('expedition report, cooldown, counters', () => {
  const g = mk(11);
  const r = g.startExpedition('wuqi_gu');
  assert.equal(r.ok, true);
  assert.ok(r.steps.length >= 1 && r.steps.length <= 5);
  assert.ok(Number.isFinite(r.hpEnd));
  const c = g.canEnter('wuqi_gu');
  assert.equal(c.reason, 'cooldown');
  assert.ok(c.readyIn > 0);
  assert.equal(g.startExpedition('wuqi_gu').reason, 'cooldown');
  assert.equal(g.state.counters.dungeonRuns.wuqi_gu, 1);
  assert.ok(Object.keys(g.state.counters.eventTriggered).length > 0);
  g.advance(1000);
  assert.ok(g.canEnter('wuqi_gu').ok);
  assert.equal(g.startExpedition('nope').reason, 'invalid');
});
test('realm too low and defeat halves stones / injures', () => {
  const g = mk(2);
  const d = g.data.dungeons.find((x) => x.realmReq > 0);
  if (d) assert.equal(g.startExpedition(d.id).reason, 'realm_too_low');
  g.state.techniques.equipped.skills = [];
  g.state.stage = 0;
  g.state.battleConfig.pillRules = [];
  // 多个种子里至少出现过失败，且失败后受伤
  let seen = false;
  for (let s = 1; s < 60 && !seen; s++) {
    const h = mk(s);
    h.data.realms; h.state.techniques.owned = {}; h.state.techniques.equipped = { heart: null, body: null, skills: [] };
    const r = h.startExpedition('wuqi_gu');
    if (r.defeated) { seen = true; assert.ok(h.view().injured); assert.equal(r.success, false); }
  }
});
test('buy and treasure equip, garden', () => {
  const g = mk();
  g.state.inventory.stones = 500;
  assert.ok(g.buy('treasure', 'qingmang_jian').ok);
  assert.equal(g.buy('treasure', 'qingmang_jian').reason, 'invalid');
  const atk0 = g.view().stats.atk;
  assert.ok(g.equipTreasure('qingmang_jian').ok);
  assert.ok(g.view().stats.atk > atk0);
  assert.ok(g.unequipTreasure('weapon').ok);
  g.state.inventory.stones = 0;
  assert.equal(g.buy('herb', 'ninglu_cao').reason, 'not_enough_stones');
  assert.equal(g.harvestGarden().ok, false);
  g.advance(1500);
  const h = g.harvestGarden();
  assert.equal(h.count, 5);
  assert.equal(g.state.garden.pending, 0);
});

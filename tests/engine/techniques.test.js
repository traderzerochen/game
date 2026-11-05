import test from 'node:test';
import assert from 'node:assert/strict';
import { mk } from './helpers.js';
import { affinity } from '../../src/core/techniques.js';

test('affinity', () => {
  assert.equal(affinity({ element: 'none' }, ['fire']), 1);
  assert.equal(affinity({ element: 'fire' }, ['fire']), 1.35);
  assert.equal(affinity({ element: 'fire' }, ['fire', 'wood']), 1.2);
  assert.equal(affinity({ element: 'fire' }, ['wood']), 0.75);
});
test('equip/unequip/order/upgrade', () => {
  const g = mk();
  assert.equal(g.equipTechnique('duanhong_jian', 'skill').reason, 'not_owned');
  g.state.inventory.stones = 1000;
  assert.ok(g.buy('technique', 'duanhong_jian').ok);
  assert.ok(g.equipTechnique('duanhong_jian', 'skill').ok);
  assert.deepEqual(g.state.techniques.equipped.skills, ['fuchen_zhang', 'duanhong_jian']);
  assert.ok(g.setSkillOrder(['duanhong_jian', 'fuchen_zhang']).ok);
  assert.equal(g.equipTechnique('duanhong_jian', 'heart').reason, 'invalid');
  assert.ok(g.unequipTechnique('skill', 0).ok);
  assert.ok(g.upgradeTechnique('guixi_yinqi').ok);
  assert.equal(g.state.techniques.owned.guixi_yinqi, 2);
  g.state.techniques.owned.guixi_yinqi = 3;
  assert.equal(g.upgradeTechnique('guixi_yinqi').reason, 'max_level');
  g.state.inventory.stones = 0; g.state.techniques.owned.fuchen_zhang = 1;
  assert.equal(g.upgradeTechnique('fuchen_zhang').reason, 'not_enough_stones');
});

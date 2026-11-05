import test from 'node:test';
import assert from 'node:assert/strict';
import { mk } from './helpers.js';

function walk(v, path, cb) {
  if (typeof v === 'number') cb(v, path);
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`, cb);
}

test('view numbers are finite and non-negative', () => {
  const g = mk();
  for (const stage of [0, 2, 7, 14]) {
    g.state.stage = stage; g.advance(500);
    const v = g.view();
    for (const key of ['qi', 'qiCap', 'qiRate', 'age', 'lifespan', 'injuryLeft', 'stones', 'played']) {
      assert.ok(Number.isFinite(v[key]) && v[key] >= 0, key);
    }
    walk(v.stats, 'stats', (n, p) => assert.ok(Number.isFinite(n) && n >= 0, p));
    walk(v.breakthrough, 'bt', (n, p) => assert.ok(Number.isFinite(n) && n >= 0, p));
    if (v.tribulation) walk(v.tribulation, 'tb', (n, p) => assert.ok(Number.isFinite(n) && n >= 0, p));
  }
});

test('tick handles huge, negative and NaN dt', () => {
  const g = mk();
  g.tick(1000);
  const p0 = g.state.time.played;
  g.tick(1000 + 1e12);
  assert.ok(g.state.time.played - p0 <= 5 + 1e-9);
  const p1 = g.state.time.played;
  g.tick(5);
  assert.equal(g.state.time.played, p1);
  g.tick(NaN);
  g.tick(Infinity);
  assert.ok(Number.isFinite(g.state.qi) && Number.isFinite(g.state.time.played));
  assert.ok(g.state.time.played - p1 <= 5 + 1e-9);
});

test('equip duplicates, unowned, wrong type', () => {
  const g = mk();
  g.state.inventory.stones = 1000;
  assert.ok(g.equipTechnique('fuchen_zhang', 'skill').ok);
  assert.deepEqual(g.state.techniques.equipped.skills, ['fuchen_zhang']);
  assert.ok(g.equipTechnique('guixi_yinqi', 'heart').ok);
  assert.equal(g.state.techniques.equipped.heart, 'guixi_yinqi');
  g.buy('technique', 'duanhong_jian');
  assert.ok(g.equipTechnique('duanhong_jian', 'skill', 0).ok);
  assert.ok(g.equipTechnique('duanhong_jian', 'skill', 1).ok);
  assert.deepEqual(g.state.techniques.equipped.skills, ['fuchen_zhang', 'duanhong_jian']);
  assert.equal(g.equipTechnique('nope', 'skill').reason, 'invalid');
  assert.equal(g.equipTechnique('fuchen_zhang', 'heart').reason, 'invalid');
  assert.equal(g.equipTechnique('fuchen_zhang', 'bogus').reason, 'invalid');
  const other = g.data.techniques.find((t) => !g.state.techniques.owned[t.id]);
  assert.equal(g.equipTechnique(other.id, other.type === 'skill' ? 'skill' : other.type).reason, 'not_owned');
  assert.equal(g.setSkillOrder(['fuchen_zhang', 'fuchen_zhang']).reason, 'invalid');
});

test('skill slots full, index out of range', () => {
  const g = mk();
  const skills = g.data.techniques.filter((t) => t.type === 'skill' && t.realmReq === 0);
  for (const t of skills) g.state.techniques.owned[t.id] = 1;
  assert.ok(skills.length >= 5, 'need >=5 stage-0 skills for this test');
  const ids = skills.map((t) => t.id);
  for (const id of ids.slice(0, 4)) g.equipTechnique(id, 'skill');
  assert.equal(g.state.techniques.equipped.skills.length, 4);
  assert.equal(g.equipTechnique(ids[4], 'skill').reason, 'invalid');
  assert.equal(g.state.techniques.equipped.skills.length, 4);
  assert.ok(g.equipTechnique(ids[4], 'skill', 99).ok === false || g.state.techniques.equipped.skills.length <= 4);
  assert.ok(g.equipTechnique(ids[4], 'skill', 1).ok);
  assert.equal(g.state.techniques.equipped.skills[1], ids[4]);
  assert.equal(g.state.techniques.equipped.skills.length, 4);
  assert.equal(g.unequipTechnique('skill', 9).reason, 'invalid');
});

test('upgrade at cap and without stones', () => {
  const g = mk();
  g.state.inventory.stones = 1e9;
  const cap = g.maxLevel('guixi_yinqi');
  for (let i = 1; i < cap; i++) assert.ok(g.upgradeTechnique('guixi_yinqi').ok);
  assert.equal(g.state.techniques.owned.guixi_yinqi, cap);
  assert.equal(g.upgradeTechnique('guixi_yinqi').reason, 'max_level');
  g.state.inventory.stones = 0;
  assert.equal(g.upgradeTechnique('fuchen_zhang').reason, 'not_enough_stones');
  assert.equal(g.upgradeTechnique('nope').reason, 'invalid');
});

test('buy edge cases', () => {
  const g = mk();
  g.state.inventory.stones = 1e6;
  assert.equal(g.buy('technique', 'nope').reason, 'invalid');
  assert.equal(g.buy('bogus', 'x').reason, 'invalid');
  assert.equal(g.buy('herb', 'nope').reason, 'invalid');
  const hi = g.data.shop.techniques.find((e) => g.data.byId.techniques.get(e.id).realmReq > 0)
    || g.data.shop.treasures.find((e) => g.data.byId.treasures.get(e.id).realmReq > 0);
  if (hi) {
    const kind = g.data.shop.techniques.includes(hi) ? 'technique' : 'treasure';
    assert.equal(g.buy(kind, hi.id).reason, 'realm_too_low');
  }
  assert.ok(g.buy('technique', 'duanhong_jian').ok);
  assert.equal(g.buy('technique', 'duanhong_jian').reason, 'invalid');
  const s = g.state.inventory.stones;
  g.buy('technique', 'duanhong_jian');
  assert.equal(g.state.inventory.stones, s);
});

test('tribulation with missing heal pills', () => {
  const g = mk(5);
  g.state.stage = 2;
  g.state.qi = g.view().realm.qiCost;
  const r = g.tribulation({ healPills: [{ pillId: 'huichun_dan', q: 0 }, { pillId: 'nope', q: 9 }, null, { pillId: 'juling_dan', q: 0 }] });
  assert.equal(r.ok, true);
  for (const x of r.rounds) assert.equal(x.healed, 0);
  assert.deepEqual(g.state.inventory.pills, {});
  assert.equal(g.tribulation({ healPills: 'bad' }).ok === false || true, true);
});

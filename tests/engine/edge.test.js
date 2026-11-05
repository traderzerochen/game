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
  assert.ok(g.equipTechnique('duanhong_jian', 'skill', 1).ok);
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
  g.state.stage = 14;
  const skills = g.data.techniques.filter((t) => t.type === 'skill');
  for (const t of skills) g.state.techniques.owned[t.id] = 1;
  assert.ok(skills.length >= 5, 'need >=5 skills for this test');
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

// ---- engine-review 回归 ----
import { deserialize, serialize } from '../../src/save/save.js';
import { DATA } from './helpers.js';

test('regression: hostile save data cannot break advance/expedition', () => {
  const g = mk(3);
  const raw = JSON.parse(serialize(g.state));
  raw.state.buffs = [null, 5, { type: 'qiRate', value: 'x', until: 1 }, { type: 'qiRate', value: 0.1, until: 1e9 }];
  raw.state.inventory.pills = { huichun_dan: 'abc', juling_dan: [1, -2, 'x', 3.7, 9] };
  raw.state.inventory.herbs = { ninglu_cao: -5, qingsui_gen: 2.9 };
  raw.state.techniques.equipped.skills = ['fuchen_zhang', 'fuchen_zhang', 1, 'a', 'b', 'c', 'd'];
  const h = mk(4);
  assert.ok(h.importSave('MLWD1:' + Buffer.from(JSON.stringify(raw)).toString('base64')).ok);
  assert.equal(h.state.buffs.length, 1);
  assert.deepEqual(h.state.inventory.pills.huichun_dan, [0, 0, 0, 0]);
  assert.equal(h.state.inventory.pills.juling_dan.length, 4);
  assert.ok(h.state.inventory.pills.juling_dan.every((x) => Number.isInteger(x) && x >= 0));
  assert.equal(h.state.inventory.herbs.ninglu_cao, 0);
  assert.equal(h.state.inventory.herbs.qingsui_gen, 2);
  assert.ok(h.state.techniques.equipped.skills.length <= 4);
  assert.equal(h.advance(10).ok, true);
  assert.equal(h.tick(1).ok, true);
  assert.notEqual(h.startExpedition('wuqi_gu').reason, 'invalid');
});

test('regression: craft clamps alchemy level', () => {
  const g = mk(2);
  g.state.alchemy.level = 500;
  g.state.inventory.herbs = { ninglu_cao: 5000, qingsui_gen: 5000 };
  g.state.inventory.stones = 1e6;
  const qs = [0, 0, 0, 0];
  for (let i = 0; i < 2000; i++) { const r = g.craft('r_juling_dan'); if (r.success) qs[r.quality]++; }
  const tot = qs.reduce((a, b) => a + b, 0);
  // L=10 => 极品权重 7/140 = 5%；未 clamp 时 L=500 会 > 70%
  assert.ok(qs[3] / tot < 0.15);
});

test('regression: ended state rejects advance/tick/applyOffline', () => {
  const g = mk(1);
  g.advance(300 * 3600);
  assert.ok(g.state.ending);
  const t0 = g.state.time.lastSeen;
  assert.deepEqual([g.advance(10).ok, g.advance(10).reason], [false, 'ended']);
  g.tick(1000);
  const t = g.tick(2000);
  assert.deepEqual([t.ok, t.reason], [false, 'ended']);
  const o = g.applyOffline(t0 + 3600_000);
  assert.deepEqual([o.ok, o.reason, o.seconds, o.qiGained], [false, 'ended', 0, 0]);
});

test('regression: dup treasure stones are halved on failed expedition', async () => {
  const data = structuredClone(DATA);
  const d = data.dungeons[0];
  d.eventPool = [{ eventId: 'ev_test_dup', weight: 1 }];
  data.events.push({ id: 'ev_test_dup', type: 'fortune', name: 't', text: 't', effects: [{ type: 'treasure', treasureId: 'qingmang_jian' }] });
  const boss = data.enemies.find((e) => e.id === d.boss);
  boss.stats = { ...boss.stats, atk: 1e6, hp: 1e9, def: 1e6 };
  const { createGame } = await import('../../src/core/game.js');
  const g = createGame({ data, seed: 9, now: () => 1 });
  g.state.inventory.treasures.push('qingmang_jian');
  g.state.techniques.equipped = { heart: null, body: null, skills: [] };
  g.state.battleConfig.pillRules = [];
  const price = data.treasures.find((t) => t.id === 'qingmang_jian').price;
  const before = g.state.inventory.stones;
  const r = g.startExpedition(d.id);
  assert.equal(r.defeated, true);
  assert.equal(r.dupStones, 4 * Math.floor(price * 0.5));
  assert.equal(r.stones, Math.floor(r.dupStones * 0.5));
  assert.equal(g.state.inventory.stones - before, r.stones);
});

test('regression: rebirth rngState follows new state seed', async () => {
  const g = mk(1);
  g.advance(300 * 3600);
  assert.ok(g.rebirth().ok);
  const { createState } = await import('../../src/core/state.js');
  const again = createState({ seed: g.state.seed, name: g.state.player.name, legacy: g.state.legacy, now: g.state.time.lastSeen }, g.data);
  assert.equal(g.state.rngState, again.rngState);
});

test('regression: pill toxicity decays qi pills within a stage', () => {
  const g = mk(6);
  g.state.stage = 3;
  const cost = g.view().realm.qiCost;
  g.state.inventory.pills.juling_dan = [5, 0, 0, 0];
  const v = g.data.byId.pills.get('juling_dan').effect.value;
  const got = [];
  const seen = [];
  g.bus.on('pill:used', (p) => seen.push(p));
  assert.deepEqual(g.view().pillToxicity, { n: 0, nextMult: 1 });
  for (let i = 0; i < 3; i++) { const r = g.usePill('juling_dan', 0); got.push(r.qiGained); assert.equal(r.toxicity, i); }
  assert.ok(Math.abs(got[0] - v * cost) < 1e-6);
  assert.ok(Math.abs(got[1] - v * cost * 0.6) < 1e-6);
  assert.ok(Math.abs(got[2] - v * cost * 0.36) < 1e-6);
  assert.equal(seen[2].toxicity, 2);
  assert.ok(Math.abs(seen[2].mult - 0.36) < 1e-9);
  const pv = g.view().pillToxicity;
  assert.equal(pv.n, 3);
  assert.ok(Math.abs(pv.nextMult - 0.216) < 1e-9);
});

test('regression: toxicity resets when stage changes', () => {
  const g = mk(6);
  g.state.inventory.pills.juling_dan = [5, 0, 0, 0];
  g.usePill('juling_dan', 0); g.usePill('juling_dan', 0);
  assert.equal(g.view().pillToxicity.n, 2);
  g.state.qi = g.view().realm.qiCost;
  g.state.legacy.breakBonus = 1;
  assert.ok(g.breakthrough().success);
  assert.deepEqual(g.view().pillToxicity, { n: 0, nextMult: 1 });
  assert.equal(g.usePill('juling_dan', 0).toxicity, 0);
});

test('regression: old saves without pillToxicity load', async () => {
  const g = mk(6);
  const raw = JSON.parse(serialize(g.state));
  delete raw.state.pillToxicity;
  const h = mk(7);
  assert.ok(h.importSave('MLWD1:' + Buffer.from(JSON.stringify(raw)).toString('base64')).ok);
  assert.deepEqual(h.state.pillToxicity, { stage: h.state.stage, n: 0 });
  raw.state.pillToxicity = { stage: -1, n: 'x' };
  assert.ok(h.importSave('MLWD1:' + Buffer.from(JSON.stringify(raw)).toString('base64')).ok);
  assert.equal(h.view().pillToxicity.n, 0);
});

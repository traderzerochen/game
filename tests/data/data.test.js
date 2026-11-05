import { test } from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../../src/data/index.js';

// 阶段 2 完成后把 PHASE 改为 2，启用完整数量要求（DESIGN §4）。
const PHASE = 2;
const MIN = PHASE >= 2
  ? { techniques: 10, herbs: 12, pills: 6, dungeons: 5, enemies: 8, poolEvents: 4 }
  : { techniques: 3, herbs: 4, pills: 2, dungeons: 1, enemies: 3, poolEvents: 4 };

const ARR = ['realms', 'techniques', 'herbs', 'pills', 'recipes', 'treasures', 'enemies', 'events', 'dungeons', 'endings'];
const ELEMS = ['metal', 'wood', 'water', 'fire', 'earth'];
const ELEMS_N = [...ELEMS, 'none'];
const ids = (k) => new Set(DATA[k].map((x) => x.id));

test('数组表：id 唯一、有 name', () => {
  for (const k of ARR) {
    assert.ok(Array.isArray(DATA[k]), k);
    const seen = new Set();
    for (const x of DATA[k]) {
      assert.ok(typeof x.id === 'string' && /^[a-z0-9_]+$/.test(x.id), `${k}.${x.id}`);
      assert.ok(typeof x.name === 'string' && x.name.length > 0, `${k}.${x.id} name`);
      assert.ok(!seen.has(x.id), `${k} 重复 id ${x.id}`);
      seen.add(x.id);
    }
  }
});

test('realms：15 条且按 stage 排序，渡劫只在 2/5/8/11/14', () => {
  assert.equal(DATA.realms.length, 15);
  DATA.realms.forEach((r, i) => {
    assert.equal(r.stage, i);
    assert.ok(r.qiCost > 0 && r.baseRate > 0 && r.lifespan > 0);
    assert.ok(r.minorChance > 0 && r.minorChance <= 1);
    for (const k of ['hp', 'mp', 'atk', 'def', 'spd', 'crit']) assert.ok(Number.isFinite(r.baseStats[k]), k);
    assert.equal(!!r.tribulation, [2, 5, 8, 11, 14].includes(i));
    if (r.tribulation) assert.ok(r.tribulation.rounds > 0 && r.tribulation.power > 0);
    if (i > 0) assert.ok(r.qiCost > DATA.realms[i - 1].qiCost);
  });
});

test('roots：五档与五行', () => {
  assert.deepEqual(Object.keys(DATA.roots.tiers).sort(), ['1', '2', '3', '4', '5']);
  for (const e of ELEMS) assert.ok(DATA.roots.elementNames[e]);
});

test('techniques：字段与效果', () => {
  for (const t of DATA.techniques) {
    assert.ok(['heart', 'skill', 'body'].includes(t.type), t.id);
    assert.ok(ELEMS_N.includes(t.element), t.id);
    assert.ok(t.rarity >= 1 && t.rarity <= 4);
    assert.ok(t.maxLevel >= 1 && t.upgradeCost > 0 && t.price >= 0 && t.realmReq >= 0);
    assert.ok(t.desc && t.desc.length <= 60, `${t.id} desc`);
    if (t.type === 'heart') assert.ok(t.effect.qiRate > 0 && t.effect.qiRatePerLv >= 0);
    if (t.type === 'skill') {
      assert.ok(['damage', 'heal', 'shield', 'buff', 'drain'].includes(t.effect.kind));
      assert.ok(t.effect.power > 0 && t.effect.mpCost >= 0 && t.effect.powerPerLv >= 0);
    }
    if (t.type === 'body') assert.ok(t.effect.stats && Object.keys(t.effect.stats).length);
  }
  assert.ok(ids('techniques').has('guixi_yinqi') && ids('techniques').has('fuchen_zhang'));
});

test('herbs / pills', () => {
  for (const h of DATA.herbs) {
    assert.ok(ELEMS_N.includes(h.element));
    assert.ok(h.rarity >= 1 && h.rarity <= 4);
    assert.equal(typeof h.garden, 'boolean');
  }
  assert.ok(DATA.herbs.some((h) => h.garden));
  const types = ['qi', 'qiRate', 'breakthrough', 'tribulation', 'heal', 'mp', 'lifespan'];
  for (const p of DATA.pills) {
    assert.ok(types.includes(p.effect.type), p.id);
    assert.ok(p.effect.value > 0);
    if (p.effect.type === 'qiRate') assert.ok(p.effect.duration > 0);
  }
});

test('recipes：引用存在', () => {
  for (const r of DATA.recipes) {
    assert.ok(ids('pills').has(r.pillId), r.id);
    assert.ok(r.tier >= 1 && r.tier <= 4 && r.baseRate > 0 && r.baseRate <= 1 && r.yield >= 1 && r.stones >= 0);
    assert.ok(r.herbs.length > 0);
    for (const h of r.herbs) { assert.ok(ids('herbs').has(h.herbId), r.id); assert.ok(h.count >= 1); }
  }
});

test('treasures', () => {
  for (const t of DATA.treasures) {
    assert.ok(['weapon', 'armor', 'charm'].includes(t.slot));
    assert.ok(t.stats && t.stats.flat && t.stats.pct);
    for (const k of ['tribResist', 'alchemyBonus', 'protect']) if (t[k] !== undefined) assert.ok(t[k] >= 0 && t[k] <= 1);
  }
});

test('enemies：引用与范围', () => {
  const arts = ['wolf', 'spider', 'humanoid', 'puppet', 'toad', 'snake', 'golem', 'bird', 'beast', 'vine'];
  for (const e of DATA.enemies) {
    assert.ok(ELEMS_N.includes(e.element), e.id);
    assert.ok(arts.includes(e.art), e.id);
    for (const k of ['hp', 'mp', 'atk', 'def', 'spd']) assert.ok(e.stats[k] > 0, `${e.id}.${k}`);
    assert.ok(e.stats.crit >= 0 && e.stats.crit <= 0.75);
    for (const s of e.skills) assert.ok(['damage', 'heal', 'shield', 'buff', 'drain'].includes(s.kind));
    assert.ok(e.drops.stones[0] <= e.drops.stones[1]);
    for (const h of e.drops.herbs || []) assert.ok(ids('herbs').has(h.herbId) && h.chance > 0 && h.chance <= 1);
    for (const t of e.drops.treasures || []) assert.ok(ids('treasures').has(t.treasureId));
  }
});

function checkEffect(ef, where) {
  switch (ef.type) {
    case 'stones': assert.ok(ef.min <= ef.max, where); break;
    case 'herb':
      if (ef.herbId) assert.ok(ids('herbs').has(ef.herbId), where);
      else for (const h of ef.pool) assert.ok(ids('herbs').has(h), where);
      assert.ok(ef.count[0] <= ef.count[1]); break;
    case 'qi': assert.ok(ef.ratio > 0); break;
    case 'hp': assert.ok(ef.ratio !== 0 && Math.abs(ef.ratio) <= 1); break;
    case 'battle': if (ef.enemyId) assert.ok(ids('enemies').has(ef.enemyId), where); break;
    case 'treasure': assert.ok(ids('treasures').has(ef.treasureId), where); break;
    case 'technique': assert.ok(ids('techniques').has(ef.techniqueId), where); break;
    case 'pill': assert.ok(ids('pills').has(ef.pillId), where); assert.ok(ef.quality >= 0 && ef.quality <= 3); break;
    case 'buff': assert.ok(ef.value > 0 && ef.duration > 0); break;
    default: assert.fail(`未知 effect ${ef.type} @${where}`);
  }
}

test('events：效果合法', () => {
  for (const ev of DATA.events) {
    assert.ok(['battle', 'fortune', 'trap', 'gather'].includes(ev.type), ev.id);
    assert.ok(ev.text && ev.text.length <= 60, `${ev.id} text`);
    if (ev.textFail) assert.ok(ev.textFail.length <= 60);
    if (ev.check) assert.ok(['hp', 'mp', 'atk', 'def', 'spd'].includes(ev.check.stat) && ev.check.difficulty > 0);
    assert.ok(Array.isArray(ev.effects));
    ev.effects.forEach((e) => checkEffect(e, ev.id));
    (ev.failEffects || []).forEach((e) => checkEffect(e, ev.id));
  }
});

test('dungeons：引用、事件池覆盖', () => {
  let prev = -1;
  for (const d of DATA.dungeons) {
    assert.ok(d.realmReq >= prev, '秘境应按 realmReq 递增'); prev = d.realmReq;
    assert.ok(d.realmReq >= 0 && d.realmReq <= 14 && d.steps >= 2 && d.cooldown > 0);
    assert.ok(ids('enemies').has(d.boss), d.id);
    assert.ok(d.enemyPool.length > 0);
    d.enemyPool.forEach((e) => assert.ok(ids('enemies').has(e), d.id));
    assert.ok(d.eventPool.length >= MIN.poolEvents, d.id);
    const types = new Set();
    for (const p of d.eventPool) {
      const ev = DATA.events.find((x) => x.id === p.eventId);
      assert.ok(ev, `${d.id} 缺事件 ${p.eventId}`);
      assert.ok(p.weight > 0);
      types.add(ev.type);
    }
    if (PHASE >= 2) for (const t of ['battle', 'fortune', 'trap']) assert.ok(types.has(t), `${d.id} 缺 ${t}`);
    assert.ok(d.clearReward.stones[0] <= d.clearReward.stones[1]);
    for (const h of d.clearReward.herbs || []) assert.ok(ids('herbs').has(h.herbId));
    if (d.clearReward.treasure) assert.ok(ids('treasures').has(d.clearReward.treasure.treasureId));
  }
});

test('shop / endings / texts', () => {
  for (const [kind, key] of [['techniques', 'techniques'], ['herbs', 'herbs'], ['treasures', 'treasures']]) {
    for (const it of DATA.shop[kind]) { assert.ok(ids(key).has(it.id), `${kind}.${it.id}`); assert.ok(it.price > 0); }
  }
  for (const e of ['ascend', 'sit', 'fallen']) assert.ok(ids('endings').has(e));
  assert.ok(DATA.texts.intro.length > 0 && DATA.texts.breakthrough.success && DATA.texts.tribulation.strike);
});

test('最低数量', () => {
  for (const k of ['techniques', 'herbs', 'pills', 'dungeons', 'enemies']) {
    assert.ok(DATA[k].length >= MIN[k], `${k} >= ${MIN[k]}`);
  }
});

test('内容完整性：获取途径、丹方、药材', () => {
  assert.equal(DATA.herbs.length, 12);
  assert.equal(DATA.pills.length, 8);
  assert.equal(DATA.techniques.length, 15);
  assert.equal(DATA.treasures.length, 7);
  for (const h of DATA.herbs) if (h.garden) assert.ok(h.rarity <= 2, h.id);
  const shopT = new Set(DATA.shop.techniques.map((x) => x.id));
  const shopR = new Set(DATA.shop.treasures.map((x) => x.id));
  for (const t of DATA.techniques) if (t.price > 0) assert.ok(shopT.has(t.id), `${t.id} 无获取途径`);
  for (const t of DATA.treasures) assert.ok(shopR.has(t.id), `${t.id} 无获取途径`);
  for (const p of DATA.pills) assert.ok(DATA.recipes.some((r) => r.pillId === p.id), `${p.id} 无丹方`);
  // 药材来源：药园 / 坊市 / 秘境事件 / 敌人掉落 / 通关奖励
  const src = new Set(DATA.herbs.filter((h) => h.garden).map((h) => h.id));
  DATA.shop.herbs.forEach((h) => src.add(h.id));
  DATA.enemies.forEach((e) => (e.drops.herbs || []).forEach((h) => src.add(h.herbId)));
  DATA.events.forEach((ev) => ev.effects.forEach((e) => { if (e.herbId) src.add(e.herbId); (e.pool || []).forEach((x) => src.add(x)); }));
  for (const h of DATA.herbs) assert.ok(src.has(h.id), `${h.id} 无来源`);
  // 关卡数据：玩家最高境界要求递增，且全部坊市物品境界不超过 8
  assert.ok(DATA.dungeons.every((d) => d.cooldown >= 90 && d.cooldown <= 300));
  assert.ok(DATA.enemies.length >= 12);
  for (const d of DATA.dungeons) assert.ok(d.eventPool.length >= 6, d.id);
});

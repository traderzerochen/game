// 覆盖测试（lead）：每部功法、每种丹药、每个秘境事件都至少触发一次，并且效果正确。
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../../src/data/index.js';
import { createGame } from '../../src/core/game.js';
import { buildIndex } from '../../src/core/dataIndex.js';
import { createRng } from '../../src/core/rng.js';
import { createBus } from '../../src/core/events.js';
import { resolveEffect } from '../../src/core/expedition.js';
import { makePlayerUnit, makeEnemyUnit, simulateBattle } from '../../src/combat/battle.js';

const fresh = (seed = 1) => {
  const g = createGame({ data: DATA, seed, now: () => 0 });
  g.newGame({ seed });
  return g;
};
const pillTotal = (st, id) => (st.inventory.pills[id] || []).reduce((s, v) => s + v, 0);

// 训练木桩：血厚、攻击低，便于观察技能效果
const dummy = (stage) => {
  const b = DATA.realms[stage].baseStats;
  return { id: 'dummy', name: '木桩', element: 'none', stats: { hp: b.hp * 6, mp: 0, atk: Math.max(1, b.atk * 0.6), def: b.def, spd: 1, crit: 0 }, skills: [] };
};

test('every technique: obtainable, equippable and effective', () => {
  for (const t of DATA.techniques) {
    const g = fresh(11);
    const st = g.state;
    st.stage = Math.min(14, Math.max(t.realmReq, 0));
    st.techniques.owned[t.id] = 1;

    if (t.type === 'heart') {
      g.unequipTechnique('heart');
      const base = g.view().qiRate;
      const r = g.equipTechnique(t.id, 'heart');
      assert.ok(r.ok, `${t.id} equip: ${r.reason}`);
      const aff = g.affinity(t.id);
      const expected = base * (1 + t.effect.qiRate * aff);
      assert.ok(Math.abs(g.view().qiRate - expected) / expected < 1e-6, `${t.id} qiRate ${g.view().qiRate} vs ${expected}`);
    } else if (t.type === 'body') {
      const before = g.view().stats;
      const r = g.equipTechnique(t.id, 'body');
      assert.ok(r.ok, `${t.id} equip: ${r.reason}`);
      const after = g.view().stats;
      for (const [k, v] of Object.entries(t.effect.stats || {})) {
        if (v > 0 && k !== 'crit') assert.ok(after[k] > before[k], `${t.id} should raise ${k}: ${before[k]} -> ${after[k]}`);
      }
    } else {
      // 只装备这一个技能，打木桩
      for (const id of [...st.techniques.equipped.skills]) g.unequipTechnique('skill', 0);
      const r = g.equipTechnique(t.id, 'skill', 0);
      assert.ok(r.ok, `${t.id} equip: ${r.reason}`);
      const index = buildIndex(DATA);
      const ctx = { data: index, rng: createRng(5), bus: createBus() };
      const a = makePlayerUnit(st, ctx);
      if (t.effect.kind === 'heal') a.hp = Math.round(a.maxHp * 0.3);
      const res = simulateBattle(a, makeEnemyUnit(dummy(st.stage)), ctx, { pillRules: [], inventory: st.inventory, counters: st.counters });
      assert.ok((st.counters.techniqueUsed[t.id] || 0) > 0, `${t.id} never used in battle`);
      const uses = res.log.filter((e) => e.actor === 'player' && e.action === 'skill' && e.name === t.name);
      assert.ok(uses.length > 0, `${t.id} not in battle log`);
      const kind = t.effect.kind;
      if (kind === 'damage' || kind === 'drain') assert.ok(uses.every((e) => e.dmg > 0), `${t.id} deals no damage`);
      if (kind === 'heal') assert.ok(uses.some((e) => e.heal > 0), `${t.id} heals nothing`);
      if (kind === 'shield') assert.ok(uses.some((e) => e.shield > 0), `${t.id} gives no shield`);
      if (kind === 'drain') assert.ok(uses.some((e) => e.heal > 0), `${t.id} drains nothing`);
    }
    // 能从坊市或秘境获得
    const inShop = (DATA.shop.techniques || []).some((s) => s.id === t.id);
    const inDrop = JSON.stringify(DATA.events).includes(`"${t.id}"`) || JSON.stringify(DATA.enemies).includes(`"${t.id}"`);
    const starter = ['guixi_yinqi', 'fuchen_zhang'].includes(t.id);
    assert.ok(inShop || inDrop || starter, `${t.id} has no acquisition path`);
  }
});

test('every pill: craftable and has the correct effect', () => {
  for (const p of DATA.pills) {
    assert.ok(DATA.recipes.some((r) => r.pillId === p.id), `${p.id} has no recipe`);
    const g = fresh(21);
    const st = g.state;
    st.stage = Math.max(p.realmReq, 0);
    st.qi = 0;
    st.inventory.pills[p.id] = [2, 0, 0, 0];
    const v0 = g.view();
    const type = p.effect.type;
    if (['qi', 'qiRate', 'breakthrough', 'tribulation', 'lifespan'].includes(type)) {
      const r = g.usePill(p.id, 0);
      assert.ok(r.ok, `${p.id} usePill: ${r.reason}`);
      const v1 = g.view();
      if (type === 'qi') assert.ok(Math.abs(v1.qi - Math.min(v1.qiCap, p.effect.value * v0.realm.qiCost)) < 1e-6, `${p.id} qi ${v1.qi}`);
      if (type === 'qiRate') assert.ok(v1.qiRate > v0.qiRate * (1 + p.effect.value) - 1e-9, `${p.id} qiRate ${v0.qiRate}->${v1.qiRate}`);
      if (type === 'breakthrough') assert.ok(Math.abs(st.pending.breakthroughBonus - Math.min(0.3, p.effect.value)) < 1e-9, `${p.id} bonus`);
      if (type === 'tribulation') assert.ok(Math.abs(st.pending.tribulationResist - Math.min(0.3, p.effect.value)) < 1e-9, `${p.id} resist`);
      if (type === 'lifespan') assert.ok(Math.abs(v1.lifespan - v0.lifespan - p.effect.value) < 1e-9, `${p.id} lifespan`);
    } else {
      // heal / mp：通过战斗丹药规则触发
      const index = buildIndex(DATA);
      const ctx = { data: index, rng: createRng(9), bus: createBus() };
      const a = makePlayerUnit(st, ctx);
      if (type === 'heal') a.hp = Math.round(a.maxHp * 0.2);
      if (type === 'mp') a.mp = 0;
      const res = simulateBattle(a, makeEnemyUnit(dummy(st.stage)), ctx, {
        pillRules: [{ pillId: p.id, below: 0.5 }], inventory: st.inventory, counters: st.counters,
      });
      const used = res.log.filter((e) => e.action === 'pill');
      assert.ok(used.length > 0, `${p.id} never consumed in battle`);
      if (type === 'heal') assert.ok(used[0].heal > 0, `${p.id} heals nothing`);
    }
    assert.ok((st.counters.pillUsed[p.id] || 0) > 0, `${p.id} not counted as used`);
    assert.ok(pillTotal(st, p.id) < 2, `${p.id} not consumed`);
  }
});

test('every dungeon event: effects apply correctly', () => {
  const index = buildIndex(DATA);
  const byId = new Map(DATA.events.map((e) => [e.id, e]));
  let checked = 0;
  for (const d of DATA.dungeons) {
    for (const { eventId } of d.eventPool) {
      const ev = byId.get(eventId);
      assert.ok(ev, `${d.id}: missing event ${eventId}`);
      for (const branch of ['effects', 'failEffects']) {
        for (const eff of ev[branch] || []) {
          const g = fresh(31);
          const st = g.state;
          st.stage = Math.min(14, d.realmReq + 1);
          st.qi = 0;
          const ctx = { data: index, rng: createRng(eventId.length * 97 + checked), bus: createBus() };
          const maxHp = g.view().stats.hp;
          const run = { hp: maxHp, maxHp, dungeon: d, loot: { stones: 0, herbs: {}, pills: [], treasures: [], techniques: [], dupStones: 0 } };
          const herbs0 = { ...st.inventory.herbs };
          // chance 类效果：强制触发
          const e2 = eff.chance != null ? { ...eff, chance: 1 } : eff;
          const out = resolveEffect(st, ctx, e2, run);
          const tag = `${d.id}/${eventId}/${branch}/${eff.type}`;
          switch (eff.type) {
            case 'stones': assert.ok(run.loot.stones >= eff.min && run.loot.stones <= eff.max, tag); break;
            case 'herb': {
              const ids = eff.herbId ? [eff.herbId] : eff.pool;
              const gained = ids.reduce((s, id) => s + (st.inventory.herbs[id] || 0) - (herbs0[id] || 0), 0);
              const min = Array.isArray(eff.count) ? eff.count[0] : (eff.count ?? 1);
              assert.ok(gained >= min, `${tag}: gained ${gained}`);
              break;
            }
            case 'qi': assert.ok(st.qi > 0, `${tag}: qi ${st.qi}`); break;
            case 'hp': assert.ok(eff.ratio < 0 ? run.hp < maxHp : run.hp <= maxHp, `${tag}: hp ${run.hp}`); break;
            case 'battle': assert.ok(out.battle && ['player', 'enemy', 'timeout'].includes(out.battle.winner), tag); break;
            case 'treasure': assert.ok(st.inventory.treasures.includes(eff.treasureId), tag); break;
            case 'technique': assert.ok(st.techniques.owned[eff.techniqueId] >= 1, tag); break;
            case 'pill': assert.ok(pillTotal(st, eff.pillId) >= (eff.count || 1), tag); break;
            case 'buff': assert.ok(st.buffs.some((b) => b.type === 'qiRate'), tag); break;
            default: assert.fail(`${tag}: unknown effect type`);
          }
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 40, `only ${checked} effects checked`);
});

test('every dungeon can be cleared by a prepared character at its entry realm', () => {
  for (const d of DATA.dungeons) {
    let clears = 0;
    const runs = 20;
    for (let i = 0; i < runs; i++) {
      const g = fresh(4000 + i);
      const st = g.state;
      st.stage = d.realmReq;
      // 准备：拥有并装备所有当前境界可用的、适配最好的功法（各 5 级），装备最好的法宝
      for (const t of DATA.techniques) if (t.realmReq <= st.stage) st.techniques.owned[t.id] = 5;
      const skills = DATA.techniques.filter((t) => t.type === 'skill' && t.realmReq <= st.stage && t.effect.kind !== 'heal')
        .sort((a, b) => (b.effect.power + 4 * b.effect.powerPerLv) - (a.effect.power + 4 * a.effect.powerPerLv)).slice(0, 4);
      skills.forEach((t, k) => g.equipTechnique(t.id, 'skill', k));
      const body = DATA.techniques.find((t) => t.type === 'body' && t.realmReq <= st.stage);
      if (body) g.equipTechnique(body.id, 'body');
      for (const slot of ['weapon', 'armor']) {
        const t = DATA.treasures.filter((x) => x.slot === slot && x.realmReq <= st.stage).sort((a, b) => b.rarity - a.rarity)[0];
        if (t) { st.inventory.treasures.push(t.id); g.equipTreasure(t.id); }
      }
      const heal = DATA.pills.find((p) => p.effect.type === 'heal');
      st.inventory.pills[heal.id] = [3, 0, 0, 0];
      const r = g.startExpedition(d.id);
      assert.notEqual(r.ok, false, `${d.id}: ${r.reason}`);
      if (r.success) clears++;
    }
    assert.ok(clears / runs >= 0.5, `${d.id}: prepared clear rate ${clears}/${runs} at stage ${d.realmReq}`);
  }
});

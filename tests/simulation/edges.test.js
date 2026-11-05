// 边界测试（lead）：离线收益、存档读取、结局与转世，全部走 Game 外观。
import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../../src/data/index.js';
import { createGame } from '../../src/core/game.js';
import { OFFLINE_CAP_SEC, OFFLINE_EFFICIENCY, YEAR_SECONDS } from '../../src/core/constants.js';
import { playCharacter } from './policy.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};

function gameAt(nowMs, storage) {
  let t = nowMs;
  const g = createGame({ data: DATA, seed: 5, now: () => t, storage });
  g.newGame({ seed: 5 });
  g.state.time.lastSeen = nowMs;
  return { g, setNow: (x) => { t = x; } };
}

test('offline: zero, negative, NaN and Infinity give nothing', () => {
  const T = 1_700_000_000_000;
  for (const now of [T, T - 3600_000, NaN, Infinity, -Infinity]) {
    const { g } = gameAt(T);
    const qi0 = g.state.qi, age0 = g.state.player.age;
    const r = g.applyOffline(now);
    assert.equal(r.seconds, 0, `now=${now}`);
    assert.equal(g.state.qi, qi0);
    assert.equal(g.state.player.age, age0);
  }
});

test('offline: gain equals rate × seconds × efficiency below cap, and is capped at 8h', () => {
  const T = 1_700_000_000_000;
  const { g } = gameAt(T);
  const rate = g.view().qiRate;
  const r1 = g.applyOffline(T + 60_000);
  assert.equal(r1.seconds, 60);
  assert.equal(r1.capped, false);
  assert.ok(Math.abs(r1.qiGained - rate * 60 * OFFLINE_EFFICIENCY) < 1e-6, `qi ${r1.qiGained}`);

  for (const extra of [OFFLINE_CAP_SEC, OFFLINE_CAP_SEC + 1, 3 * OFFLINE_CAP_SEC, 365 * 86400]) {
    const { g: h } = gameAt(T);
    const age0 = h.state.player.age;
    const r = h.applyOffline(T + extra * 1000);
    assert.equal(r.seconds, OFFLINE_CAP_SEC, `extra=${extra}`);
    assert.equal(r.capped, extra > OFFLINE_CAP_SEC);
    assert.ok(h.state.qi <= h.view().qiCap + 1e-6);
    assert.ok(Math.abs(h.state.player.age - age0 - OFFLINE_CAP_SEC / YEAR_SECONDS) < 1e-6);
    assert.ok(h.state.garden.pending > 0, 'garden should grow offline');
  }
});

test('offline twice in a row does not double count', () => {
  const T = 1_700_000_000_000;
  const { g } = gameAt(T);
  const a = g.applyOffline(T + 3600_000);
  const b = g.applyOffline(T + 3600_000);
  assert.ok(a.seconds > 0);
  assert.equal(b.seconds, 0);
});

test('save: round trip mid-game through storage, export and import', () => {
  const storage = mem();
  const g = createGame({ data: DATA, seed: 99, now: () => 0, storage });
  g.newGame({ seed: 99 });
  playCharacter(g, DATA, { targetStage: 4 });
  const snap = JSON.parse(JSON.stringify(g.state));
  assert.ok(g.save().ok);

  const g2 = createGame({ data: DATA, seed: 1, now: () => 0, storage });
  assert.equal(g2.load(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(g2.state)), snap);

  const str = g.exportSave();
  assert.equal(typeof str, 'string');
  const g3 = createGame({ data: DATA, seed: 2, now: () => 0 });
  const r = g3.importSave(typeof str === 'string' ? str : str.data);
  assert.ok(r === true || r?.ok, 'import ok');
  assert.deepEqual(JSON.parse(JSON.stringify(g3.state)), snap);

  // 读档后继续游玩应当与原存档的继续游玩一致（确定性）
  playCharacter(g, DATA, { targetStage: 5 });
  playCharacter(g2, DATA, { targetStage: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(g2.state)), JSON.parse(JSON.stringify(g.state)));
});

test('save: corrupted or empty data is rejected and keeps current state', () => {
  for (const bad of ['', 'not json', '{"version":1}', 'MLWD1:@@@', '{"version":1,"state":{"qi":"NaN"}}', 'null']) {
    const storage = mem();
    storage.setItem('minglan_save_v1', bad);
    const g = createGame({ data: DATA, seed: 3, now: () => 0, storage });
    g.newGame({ seed: 3 });
    const before = JSON.stringify(g.state);
    let ok;
    assert.doesNotThrow(() => { ok = g.load(); }, `load(${bad}) threw`);
    assert.equal(ok, false, `load(${bad}) should fail`);
    assert.equal(JSON.stringify(g.state), before);
    let r;
    assert.doesNotThrow(() => { r = g.importSave(bad); });
    assert.ok(r === false || r?.ok === false, `import(${bad}) should fail`);
  }
});

test('save: missing fields in an old save are filled in', () => {
  const storage = mem();
  const g = createGame({ data: DATA, seed: 8, now: () => 0, storage });
  g.newGame({ seed: 8 });
  g.save();
  const key = [...storage._m.keys()][0];
  const raw = JSON.parse(storage.getItem(key));
  const st = raw.state ?? raw;
  delete st.garden; delete st.counters; delete st.buffs; delete st.battleConfig;
  storage.setItem(key, JSON.stringify(raw));
  const g2 = createGame({ data: DATA, seed: 9, now: () => 0, storage });
  assert.equal(g2.load(), true);
  assert.ok(g2.state.garden && g2.state.counters && Array.isArray(g2.state.buffs));
  assert.doesNotThrow(() => { g2.advance(600); g2.view(); });
});

test('endings: lifespan → 坐化, then rebirth with legacy', () => {
  const g = createGame({ data: DATA, seed: 12, now: () => 0 });
  g.newGame({ seed: 12 });
  g.state.player.age = g.view().lifespan - 0.001;
  g.advance(3600);
  assert.equal(g.state.ending?.id, 'sit');
  assert.equal(g.breakthrough().reason, 'ended');
  assert.equal(g.startExpedition(DATA.dungeons[0].id).reason, 'ended');
  const r = g.rebirth();
  assert.ok(r.ok, r.reason);
  assert.equal(g.state.ending, null);
  assert.equal(g.state.stage, 0);
  assert.equal(g.state.legacy.lives, 1);
  assert.ok(g.state.legacy.qiBonus > 0);
  // 下一世仍然可以玩到金丹
  const res = playCharacter(g, DATA, { targetStage: 6 });
  assert.ok(res.reached, `second life stuck at ${res.stage}`);
});

// 充分准备：拥有全部功法（指定等级），装备最好的护体和所有槽位上稀有度最高的法宝
export function prepare(g, lv) {
  const st = g.state;
  for (const t of DATA.techniques) if (t.realmReq <= st.stage) st.techniques.owned[t.id] = lv;
  const bodies = DATA.techniques.filter((t) => t.type === 'body' && t.realmReq <= st.stage);
  const best = bodies.sort((a, b) => (b.effect.stats.hp || 0) + (b.effect.stats.def || 0) - (a.effect.stats.hp || 0) - (a.effect.stats.def || 0))[0];
  if (best) g.equipTechnique(best.id, 'body');
  for (const slot of ['weapon', 'armor', 'charm']) {
    const cand = DATA.treasures.filter((x) => x.slot === slot && x.realmReq <= st.stage)
      .sort((a, b) => (b.tribResist || 0) - (a.tribResist || 0) || b.rarity - a.rarity)[0];
    if (cand) { st.inventory.treasures.push(cand.id); g.equipTreasure(cand.id); }
  }
}

test('endings: 化神后期 passing 登穹雷劫 → 飞升', () => {
  let ascended = false;
  for (let s = 0; s < 30 && !ascended; s++) {
    const g = createGame({ data: DATA, seed: 300 + s, now: () => 0 });
    g.newGame({ seed: 300 + s });
    const st = g.state;
    st.stage = 14;
    prepare(g, 10);
    st.qi = g.view().qiCap;
    st.pending.tribulationResist = 0.3;
    const heal = DATA.pills.find((p) => p.effect.type === 'heal');
    st.inventory.pills[heal.id] = [0, 0, 0, 3];
    const r = g.tribulation({ healPills: [0, 1, 2].map(() => ({ pillId: heal.id, q: 3 })) });
    assert.ok(r.ok, r.reason);
    if (r.success) { assert.equal(g.state.ending?.id, 'ascend'); ascended = true; }
    else if (r.death) assert.equal(g.state.ending?.id, 'fallen');
  }
  assert.ok(ascended, 'no seed managed to ascend');
});

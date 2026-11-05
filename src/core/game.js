// Game 外观 —— 接口见 DESIGN.md §6.3
import { createRng } from './rng.js';
import { createBus } from './events.js';
import { TICK_MAX_SEC } from './constants.js';
import { buildIndex } from './dataIndex.js';
import { createState } from './state.js';
import { breakthroughInfo, attemptBreakthrough } from './realm.js';
import { qiRate, qiCap, advance as advanceFn, applyOffline as applyOfflineFn } from './cultivation.js';
import * as tech from './techniques.js';
import * as inv from './inventory.js';
import * as exp from './expedition.js';
import { lifespan, checkEnding, rebirth as rebirthFn } from './ending.js';
import { computeStats } from '../combat/stats.js';
import { createSaveManager } from '../save/save.js';
import { num, clamp } from './util.js';
import * as ext from './gameExt.js';

export function createGame({ data, storage, seed, now = () => Date.now() } = {}) {
  const index = buildIndex(data);
  const bus = createBus();
  const rng = createRng(1);
  const ctx = { data: index, rng, bus };
  const saver = storage ? createSaveManager(storage) : null;
  let state = createState({ seed: seed ?? now(), now: now() }, index);
  let lastTick = null;

  // 在 rng 状态与 state 同步的前提下执行
  function run(fn, { mutating = true } = {}) {
    if (mutating && state.ending) return { ok: false, reason: 'ended' };
    try {
      rng.setState(state.rngState);
      const before = state;
      const r = fn();
      if (state === before) state.rngState = rng.getState();
      checkEnding(state, ctx);
      return r === undefined ? { ok: true } : r;
    } catch (e) {
      state.rngState = rng.getState();
      return { ok: false, reason: 'invalid', error: String(e?.message || e) };
    }
  }

  const game = {
    bus,
    get state() { return state; },
    get data() { return index; },

    view() {
      const realm = index.realm(state.stage);
      const next = state.stage + 1 < index.realms.length ? index.realm(state.stage + 1) : null;
      const rootTier = index.roots.tiers[state.player.roots.length];
      const lf = lifespan(state, ctx);
      return {
        stage: state.stage, realm, nextRealm: next,
        qi: state.qi, qiCap: qiCap(state, ctx), qiRate: qiRate(state, ctx),
        stats: computeStats(state, ctx),
        breakthrough: breakthroughInfo(state, ctx),
        tribulation: ext.tribulationInfoSafe(state, ctx),
        age: state.player.age, lifespan: lf,
        injured: state.injury.until > state.time.played,
        injuryLeft: Math.max(0, state.injury.until - state.time.played),
        buffs: state.buffs.filter((b) => b.until > state.time.played),
        roots: [...state.player.roots], rootTier, rootMult: num(rootTier?.mult, 1),
        stones: state.inventory.stones, played: state.time.played,
        gardenPending: state.garden.pending,
        ending: state.ending, legacy: state.legacy, name: state.player.name,
      };
    },

    newGame({ seed: s, name } = {}) {
      state = createState({ seed: s ?? now(), name, now: now() }, index);
      lastTick = null;
      return { ok: true };
    },
    tick(nowMs) {
      nowMs = num(nowMs, now());
      if (lastTick == null) { lastTick = nowMs; return { ok: true, dt: 0 }; }
      const dt = clamp((nowMs - lastTick) / 1000, 0, TICK_MAX_SEC);
      lastTick = nowMs;
      state.time.lastSeen = nowMs;
      if (state.ending) return { ok: false, reason: 'ended', dt: 0, ended: state.ending.id };
      if (dt <= 0) return { ok: true, dt: 0 };
      return run(() => ({ ok: true, dt, ...advanceFn(state, ctx, dt) }));
    },
    advance(sec) {
      return run(() => ({ ok: true, ...advanceFn(state, ctx, sec) }));
    },
    applyOffline(nowMs) {
      if (state.ending) return { ok: false, reason: 'ended', seconds: 0, capped: false, qiGained: 0 };
      const r = run(() => applyOfflineFn(state, ctx, nowMs));
      return r.ok === false ? { ok: false, reason: r.reason, seconds: 0, capped: false, qiGained: 0 } : { ok: true, ...r };
    },
    breakthroughInfo() { return breakthroughInfo(state, ctx); },
    tribulationInfo() { return ext.tribulationInfoSafe(state, ctx); },
    affinity(id) { const t = index.byId.techniques.get(id); return t ? tech.affinity(t, state.player.roots) : 1; },
    maxLevel(id) { return tech.maxLevel(state, ctx, id); },
    breakthrough() { return run(() => attemptBreakthrough(state, ctx)); },
    tribulation(opts) { return run(() => ext.tribulation(state, ctx, opts)); },

    equipTechnique(id, slot, index_) { return run(() => tech.equip(state, ctx, id, slot, index_)); },
    unequipTechnique(slot, index_) { return run(() => tech.unequip(state, ctx, slot, index_)); },
    setSkillOrder(ids) { return run(() => tech.setSkillOrder(state, ctx, ids)); },
    upgradeTechnique(id) { return run(() => tech.upgrade(state, ctx, id)); },

    craft(id) { return run(() => ext.craft(state, ctx, id)); },
    craftInfo(id) { return run(() => ext.craftInfo(state, ctx, id), { mutating: false }); },
    usePill(id, q) { return run(() => ext.usePill(state, ctx, id, q)); },
    harvestGarden() { return run(() => inv.harvestGarden(state, ctx)); },
    buy(kind, id) { return run(() => inv.buy(state, ctx, kind, id)); },
    equipTreasure(id) { return run(() => inv.equipTreasure(state, ctx, id)); },
    unequipTreasure(slot) { return run(() => inv.unequipTreasure(state, ctx, slot)); },
    setPillRules(rules) {
      return run(() => {
        if (!Array.isArray(rules)) return { ok: false, reason: 'invalid' };
        const clean = [];
        for (const r of rules) {
          if (!r || !index.byId.pills.has(r.pillId) || !Number.isFinite(r.below)) return { ok: false, reason: 'invalid' };
          clean.push({ pillId: r.pillId, below: clamp(r.below, 0, 1) });
        }
        state.battleConfig.pillRules = clean;
        return { ok: true };
      });
    },
    canEnter(id) { return run(() => exp.canEnter(state, ctx, id), { mutating: false }); },
    startExpedition(id) { return run(() => exp.runExpedition(state, ctx, id)); },

    rebirth() {
      return run(() => {
        if (!state.ending) return { ok: false, reason: 'invalid' };
        const s = rebirthFn(state, ctx, { seed: rng.int(1, 0x7fffffff) });
        state = s;
        lastTick = null;
        return { ok: true };
      }, { mutating: false });
    },

    save() {
      if (!saver) { bus.emit('save', { ok: false }); return { ok: false, reason: 'invalid' }; }
      state.time.lastSeen = now();
      const r = saver.save(state);
      bus.emit('save', { ok: r.ok });
      return r;
    },
    load() {
      if (!saver) return false;
      try {
        const s = saver.load();
        if (!s) { bus.emit('load', { ok: false }); return false; }
        state = s;
        lastTick = null;
        bus.emit('load', { ok: true });
        return true;
      } catch {
        bus.emit('load', { ok: false });
        return false;
      }
    },
    reset() {
      saver?.clear();
      return game.newGame({});
    },
    exportSave() {
      return saver ? saver.exportString(state) : createSaveManager({}).exportString(state);
    },
    importSave(str) {
      try {
        const s = (saver || createSaveManager({})).importString(str);
        state = s;
        lastTick = null;
        bus.emit('load', { ok: true });
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: 'invalid', error: String(e?.message || e) };
      }
    },
  };
  return game;
}

// 存档：序列化、校验、迁移、导入导出 —— DESIGN §6.2
import { emptyLegacy, emptyCounters } from '../core/state.js';
import { MAX_SKILL_SLOTS } from '../core/constants.js';

export const SAVE_KEY = 'minglan_save_v1';
export const SAVE_VERSION = 1;
const EXPORT_PREFIX = 'MLWD1:';

export class SaveError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'SaveError';
  }
}

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const fin = (x, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

function checkFinite(v, path = '') {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new SaveError(`非法数值 ${path}`);
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) checkFinite(v[k], `${path}.${k}`);
  }
}

export function serialize(state) {
  return JSON.stringify({ v: SAVE_VERSION, state });
}

function migrate(raw) {
  // 目前只有 v1；未来版本在此按 raw.v 逐级迁移
  if (!isObj(raw) || !isObj(raw.state)) throw new SaveError('存档格式错误');
  if (fin(raw.v, 0) > SAVE_VERSION) throw new SaveError('存档版本过新');
  return raw.state;
}

export function normalize(s) {
  if (!isObj(s)) throw new SaveError('存档内容错误');
  if (!isObj(s.player) || !Array.isArray(s.player.roots) || !s.player.roots.length) throw new SaveError('缺少角色数据');
  if (!isObj(s.time) || !isObj(s.inventory) || !isObj(s.techniques)) throw new SaveError('存档缺少必要字段');
  checkFinite(s);
  const st = s;
  st.version = SAVE_VERSION;
  st.seed = fin(st.seed, 1);
  st.rngState = fin(st.rngState, st.seed) >>> 0;
  st.stage = Math.max(0, Math.floor(fin(st.stage)));
  st.qi = Math.max(0, fin(st.qi));
  st.player = { name: '无名修士', lifespanBonus: 0, age: 16, pillLifespanUses: {}, ...st.player };
  st.time = { played: 0, lastSeen: 0, ...st.time };
  const t = st.techniques;
  t.owned = isObj(t.owned) ? t.owned : {};
  t.equipped = { heart: null, body: null, skills: [], ...(isObj(t.equipped) ? t.equipped : {}) };
  t.equipped.skills = (Array.isArray(t.equipped.skills) ? t.equipped.skills : [])
    .filter((x, i, a) => typeof x === 'string' && a.indexOf(x) === i).slice(0, MAX_SKILL_SLOTS);
  for (const k of Object.keys(t.owned)) t.owned[k] = Math.max(1, Math.floor(fin(t.owned[k], 1)));
  const inv = st.inventory;
  inv.stones = Math.max(0, fin(inv.stones));
  inv.stones = Math.floor(inv.stones);
  const herbs = {};
  for (const [k, v] of Object.entries(isObj(inv.herbs) ? inv.herbs : {})) herbs[k] = Math.max(0, Math.floor(fin(v)));
  inv.herbs = herbs;
  const pills = {};
  for (const [k, v] of Object.entries(isObj(inv.pills) ? inv.pills : {})) {
    pills[k] = Array.isArray(v) && v.length === 4 ? v.map((x) => Math.max(0, Math.floor(fin(x)))) : [0, 0, 0, 0];
  }
  inv.pills = pills;
  inv.treasures = (Array.isArray(inv.treasures) ? inv.treasures : []).filter((x) => typeof x === 'string');
  st.treasures = { weapon: null, armor: null, charm: null, ...(isObj(st.treasures) ? st.treasures : {}) };
  st.alchemy = { level: 1, xp: 0, ...(isObj(st.alchemy) ? st.alchemy : {}) };
  st.buffs = (Array.isArray(st.buffs) ? st.buffs : [])
    .filter((b) => isObj(b) && typeof b.type === 'string' && Number.isFinite(b.value) && Number.isFinite(b.until))
    .map((b) => ({ type: b.type, value: b.value, until: b.until }));
  st.pending = { breakthroughBonus: 0, tribulationResist: 0, ...(isObj(st.pending) ? st.pending : {}) };
  {
    const pt = st.pillToxicity;
    st.pillToxicity = isObj(pt) && Number.isInteger(pt.stage) && pt.stage >= 0 && Number.isInteger(pt.n) && pt.n >= 0
      ? { stage: pt.stage, n: pt.n } : { stage: st.stage, n: 0 };
  }
  st.injury = { until: 0, ...(isObj(st.injury) ? st.injury : {}) };
  st.expeditions = { readyAt: {}, cleared: {}, ...(isObj(st.expeditions) ? st.expeditions : {}) };
  st.garden = { acc: 0, pending: 0, ...(isObj(st.garden) ? st.garden : {}) };
  st.battleConfig = { pillRules: [], ...(isObj(st.battleConfig) ? st.battleConfig : {}) };
  st.battleConfig.pillRules = (Array.isArray(st.battleConfig.pillRules) ? st.battleConfig.pillRules : [])
    .filter((r) => isObj(r) && typeof r.pillId === 'string' && Number.isFinite(r.below));
  st.ending = isObj(st.ending) ? st.ending : null;
  st.legacy = { ...emptyLegacy(), ...(isObj(st.legacy) ? st.legacy : {}) };
  const c = { ...emptyCounters(), ...(isObj(st.counters) ? st.counters : {}) };
  for (const k of ['techniqueUsed', 'pillUsed', 'eventTriggered', 'enemyDefeated', 'dungeonRuns']) if (!isObj(c[k])) c[k] = {};
  st.counters = c;
  st.log = Array.isArray(st.log) ? st.log.slice(-100) : [];
  return st;
}

export function deserialize(str) {
  if (typeof str !== 'string' || !str) throw new SaveError('存档为空');
  let raw;
  try {
    raw = JSON.parse(str);
  } catch {
    throw new SaveError('存档损坏，无法解析');
  }
  return normalize(migrate(raw));
}

function toB64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createSaveManager(storage) {
  return {
    save(state) {
      try {
        storage.setItem(SAVE_KEY, serialize(state));
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: 'invalid', error: String(e?.message || e) };
      }
    },
    /** 无存档返回 null；存档损坏抛 SaveError */
    load() {
      const s = storage.getItem(SAVE_KEY);
      if (s == null || s === '') return null;
      return deserialize(s);
    },
    clear() {
      try { storage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    },
    exportString(state) {
      return EXPORT_PREFIX + toB64(serialize(state));
    },
    importString(str) {
      if (typeof str !== 'string') throw new SaveError('导入内容无效');
      const t = str.trim();
      if (!t.startsWith(EXPORT_PREFIX)) throw new SaveError('导入内容无效');
      let json;
      try { json = fromB64(t.slice(EXPORT_PREFIX.length)); } catch { throw new SaveError('导入内容无法解码'); }
      return deserialize(json);
    },
  };
}

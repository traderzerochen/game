// 初始状态 —— DESIGN §5
import { createRng } from './rng.js';
import { START_AGE, ELEMENTS } from './constants.js';
import { num } from './util.js';

export function emptyLegacy() {
  return { lives: 0, qiBonus: 0, breakBonus: 0, lifespanBonus: 0, startStones: 0, inheritTechnique: null };
}
export function emptyCounters() {
  return {
    techniqueUsed: {}, pillUsed: {}, eventTriggered: {}, enemyDefeated: {}, dungeonRuns: {},
    breakthroughs: 0, breakthroughFails: 0, tribulations: 0, tribulationFails: 0,
    battles: 0, battlesWon: 0, crafts: 0,
  };
}

function rollRoots(rng, data) {
  const tiers = data.roots.tiers;
  const items = Object.keys(tiers).map((n) => ({ n: Number(n), weight: tiers[n].weight }));
  const n = rng.weighted(items).n;
  const pool = [...ELEMENTS];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out;
}

export function createState({ seed = 1, name = '无名修士', legacy, now = 0 } = {}, data) {
  const rng = createRng(seed);
  const lg = { ...emptyLegacy(), ...(legacy || {}) };
  let roots = rollRoots(rng, data);
  if (lg.lives >= 1) {
    const b = rollRoots(rng, data);
    if (b.length < roots.length) roots = b;
  }
  const owned = { guixi_yinqi: 1, fuchen_zhang: 1 };
  const equipped = { heart: 'guixi_yinqi', body: null, skills: ['fuchen_zhang'] };
  const inh = lg.inheritTechnique && data.byId?.techniques.get(lg.inheritTechnique);
  if (inh) {
    owned[inh.id] = 1;
    if (inh.type === 'heart') equipped.heart = inh.id;
  }
  const state = {
    version: 1,
    seed: num(seed) >>> 0 || 1,
    rngState: 0,
    player: { name, roots, lifespanBonus: 0, age: START_AGE, pillLifespanUses: {} },
    stage: 0,
    qi: 0,
    time: { played: 0, lastSeen: num(now) },
    techniques: { owned, equipped },
    inventory: { stones: Math.max(0, num(lg.startStones)), herbs: {}, pills: {}, treasures: [] },
    treasures: { weapon: null, armor: null, charm: null },
    alchemy: { level: 1, xp: 0 },
    buffs: [],
    pending: { breakthroughBonus: 0, tribulationResist: 0 },
    injury: { until: 0 },
    expeditions: { readyAt: {}, cleared: {} },
    garden: { acc: 0, pending: 0 },
    battleConfig: { pillRules: [{ pillId: 'huichun_dan', below: 0.4 }] },
    ending: null,
    legacy: lg,
    counters: emptyCounters(),
    log: [],
  };
  state.rngState = rng.getState();
  return state;
}

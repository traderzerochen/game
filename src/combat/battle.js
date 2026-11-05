// 回合制自动战斗 —— DESIGN §3.7 / §3.8
import { MAX_BATTLE_ROUNDS, MAX_PILLS_PER_BATTLE, CRIT_MULT, QUALITY_MULT } from '../core/constants.js';
import { affinity } from '../core/techniques.js';
import { clamp, inc, num } from '../core/util.js';
import { elemMult } from './elements.js';
import { computeStats } from './stats.js';

function mkUnit(side, name, element, s, skills) {
  const hp = Math.max(1, Math.round(num(s.hp, 1)));
  const mp = Math.max(0, Math.round(num(s.mp, 0)));
  return {
    side, name, element: element || 'none', maxHp: hp, hp, maxMp: mp, mp,
    atk: Math.max(1, num(s.atk, 1)), def: Math.max(0, num(s.def, 0)), spd: num(s.spd, 1),
    crit: clamp(num(s.crit, 0), 0, 1), skills, ptr: 0, shield: 0, atkBuff: 0, buffTurns: 0, justCast: false,
  };
}

export function makePlayerUnit(state, ctx) {
  const S = computeStats(state, ctx);
  const skills = [];
  for (const id of state.techniques.equipped.skills) {
    const t = ctx.data.byId.techniques.get(id);
    if (!t || t.type !== 'skill') continue;
    const lv = num(state.techniques.owned[id], 1);
    const e = t.effect || {};
    skills.push({
      techId: id, name: t.name, kind: e.kind || 'damage', element: t.element || 'none',
      power: (num(e.power) + num(e.powerPerLv) * (lv - 1)) * affinity(t, state.player.roots), mpCost: num(e.mpCost),
    });
  }
  return mkUnit('player', state.player.name, S.element, S, skills);
}

export function makeEnemyUnit(enemy) {
  const skills = (enemy.skills || []).map((s) => ({
    techId: null, name: s.name, kind: s.kind || 'damage', element: s.element || enemy.element || 'none',
    power: num(s.power, 1), mpCost: num(s.mpCost),
  }));
  return mkUnit('enemy', enemy.name, enemy.element, enemy.stats || {}, skills);
}

function pickSkill(u) {
  const n = u.skills.length;
  for (let i = 0; i < n; i++) {
    const idx = (u.ptr + i) % n;
    const s = u.skills[idx];
    if (u.mp < s.mpCost) continue;
    if (s.kind === 'heal' && u.hp >= 0.7 * u.maxHp) continue;
    if (s.kind === 'shield' && u.shield > 0) continue;
    if (s.kind === 'buff' && u.atkBuff > 0) continue;
    u.ptr = (idx + 1) % n;
    return s;
  }
  return null;
}

/** a = 玩家单位，b = 敌方单位。opts: {pillRules, inventory, counters} —— 药丹从 inventory.pills 扣除 */
export function simulateBattle(a, b, ctx, opts = {}) {
  const rng = ctx.rng;
  const log = [];
  const pillsUsed = [];
  const rules = Array.isArray(opts.pillRules) ? opts.pillRules : [];
  const inv = opts.inventory;
  const counters = opts.counters;
  let winner = null;
  let round = 0;
  let rounds = 0;
  const ev = (o) => log.push({ round, ...o, hpA: a.hp, hpB: b.hp });

  const hit = (att, def, skill) => {
    const sp = skill ? skill.power : 1;
    const elem = skill ? skill.element : 'none';
    const raw = (sp * att.atk * att.atk) / Math.max(1, att.atk + def.def);
    const crit = rng.chance(att.crit);
    const mult = elemMult(elem, def.element) * (crit ? CRIT_MULT : 1) * rng.range(0.9, 1.1) * (1 + att.atkBuff);
    const dmg = Math.max(1, Math.round(num(raw * mult)));
    let rest = dmg;
    if (def.shield > 0) {
      const ab = Math.min(def.shield, rest);
      def.shield -= ab;
      rest -= ab;
    }
    def.hp = Math.max(0, def.hp - rest);
    return { dmg, crit, elem, mult: elemMult(elem, def.element) };
  };

  const usePills = (u) => {
    if (u.side !== 'player' || !inv) return;
    for (const rule of rules) {
      if (pillsUsed.length >= MAX_PILLS_PER_BATTLE) return;
      const pill = ctx.data.byId.pills.get(rule.pillId);
      const arr = inv.pills?.[rule.pillId];
      if (!pill || !arr) continue;
      const type = pill.effect?.type;
      let ratio;
      if (type === 'heal') ratio = u.hp / u.maxHp;
      else if (type === 'mp') ratio = u.maxMp > 0 ? u.mp / u.maxMp : 1;
      else continue;
      if (!(ratio < num(rule.below))) continue;
      const q = arr.findIndex((c) => c > 0);
      if (q < 0) continue;
      arr[q] -= 1;
      const amt = num(pill.effect.value) * QUALITY_MULT[q];
      if (type === 'heal') u.hp = Math.min(u.maxHp, u.hp + Math.round(amt * u.maxHp));
      else u.mp = Math.min(u.maxMp, u.mp + Math.round(amt * u.maxMp));
      pillsUsed.push({ pillId: rule.pillId, q });
      if (counters) inc(counters.pillUsed, rule.pillId);
      ev({ actor: 'player', action: 'pill', name: pill.name, heal: type === 'heal' ? Math.round(amt * u.maxHp) : 0 });
    }
  };

  const act = (u, o) => {
    u.mp = Math.min(u.maxMp, u.mp + Math.round(0.05 * u.maxMp));
    usePills(u);
    const skill = pickSkill(u);
    if (skill && counters && u.side === 'player' && skill.techId) inc(counters.techniqueUsed, skill.techId);
    if (!skill) {
      const r = hit(u, o, null);
      ev({ actor: u.side, action: 'attack', name: '普通攻击', dmg: r.dmg, crit: r.crit, elem: 'none', mult: r.mult });
      return;
    }
    u.mp -= skill.mpCost;
    if (skill.kind === 'heal') {
      const h = Math.round(skill.power * u.maxHp * 0.3);
      const real = Math.min(h, u.maxHp - u.hp);
      u.hp += real;
      ev({ actor: u.side, action: 'skill', name: skill.name, heal: real });
    } else if (skill.kind === 'shield') {
      u.shield = Math.round(skill.power * u.maxHp * 0.25);
      ev({ actor: u.side, action: 'skill', name: skill.name, shield: u.shield });
    } else if (skill.kind === 'buff') {
      u.atkBuff = skill.power * 0.3;
      u.buffTurns = 3;
      u.justCast = true;
      ev({ actor: u.side, action: 'skill', name: skill.name });
    } else {
      const r = hit(u, o, skill);
      let heal;
      if (skill.kind === 'drain') {
        heal = Math.min(Math.round(r.dmg * 0.3), u.maxHp - u.hp);
        u.hp += heal;
      }
      ev({ actor: u.side, action: 'skill', name: skill.name, dmg: r.dmg, crit: r.crit, elem: r.elem, mult: r.mult, heal });
    }
  };

  for (round = 1; round <= MAX_BATTLE_ROUNDS && !winner; round++) {
    rounds = round;
    const order = a.spd >= b.spd ? [a, b] : [b, a];
    for (const u of order) {
      if (a.hp <= 0 || b.hp <= 0) break;
      const o = u === a ? b : a;
      act(u, o);
      if (u.buffTurns > 0) {
        if (u.justCast) u.justCast = false;
        else if (--u.buffTurns === 0) u.atkBuff = 0;
      }
      if (o.hp <= 0) break;
    }
    if (b.hp <= 0) winner = 'player';
    else if (a.hp <= 0) winner = 'enemy';
  }
  if (!winner) winner = 'timeout';
  return { winner, rounds, log, playerHpEnd: a.hp, pillsUsed };
}

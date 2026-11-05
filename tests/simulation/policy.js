// 自动游玩策略（lead）—— 只通过 Game 外观操作，用于批量模拟。
// 策略刻意保持「普通玩家」水平：贪心装备、能炼就炼、灵气满即突破。

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

export function bestHeart(game, data) {
  const st = game.state;
  const roots = st.player.roots;
  let best = null, bestV = -1;
  for (const [id, lv] of Object.entries(st.techniques.owned)) {
    const t = data.techniques.find((x) => x.id === id);
    if (!t || t.type !== 'heart') continue;
    const aff = t.element === 'none' ? 1 : roots.includes(t.element) ? (roots.length === 1 ? 1.35 : 1.2) : 0.75;
    const v = (t.effect.qiRate + t.effect.qiRatePerLv * (lv - 1)) * aff;
    if (v > bestV) { bestV = v; best = id; }
  }
  return best;
}

function techScore(t, lv, roots) {
  const aff = t.element === 'none' ? 1 : roots.includes(t.element) ? 1.2 : 0.75;
  const e = t.effect;
  if (e.kind === 'heal') return 50;
  if (e.kind === 'shield') return 40;
  return ((e.power || 1) + (e.powerPerLv || 0) * (lv - 1)) * aff * 10 + (e.kind === 'buff' ? 5 : 0);
}

export function configure(game, data) {
  const st = game.state;
  const roots = st.player.roots;
  const heart = bestHeart(game, data);
  if (heart && st.techniques.equipped.heart !== heart) game.equipTechnique(heart, 'heart');

  const owned = Object.entries(st.techniques.owned)
    .map(([id, lv]) => ({ t: data.techniques.find((x) => x.id === id), lv }))
    .filter((x) => x.t);
  const bodies = owned.filter((x) => x.t.type === 'body');
  if (bodies.length) {
    const b = bodies.sort((a, c) => Object.values(c.t.effect.stats || {}).reduce((s, v) => s + v, 0) - Object.values(a.t.effect.stats || {}).reduce((s, v) => s + v, 0))[0];
    if (st.techniques.equipped.body !== b.t.id) game.equipTechnique(b.t.id, 'body');
  }
  const skills = owned.filter((x) => x.t.type === 'skill').sort((a, c) => techScore(c.t, c.lv, roots) - techScore(a.t, a.lv, roots)).slice(0, 4);
  // 伤害技能在前，治疗、护盾放在后面（技能指针会跳过不满足条件的技能）
  const order = [...skills.filter((x) => !['heal', 'shield'].includes(x.t.effect.kind)), ...skills.filter((x) => ['heal', 'shield'].includes(x.t.effect.kind))].map((x) => x.t.id);
  const cur = st.techniques.equipped.skills || [];
  if (order.join() !== cur.join()) {
    order.forEach((id, i) => { if (cur[i] !== id) game.equipTechnique(id, 'skill', i); });
    game.setSkillOrder(order);
  }

  const healPill = data.pills.find((p) => p.effect.type === 'heal');
  const mpPill = data.pills.find((p) => p.effect.type === 'mp');
  const rules = [];
  if (healPill) rules.push({ pillId: healPill.id, below: 0.4 });
  if (mpPill) rules.push({ pillId: mpPill.id, below: 0.2 });
  game.setPillRules(rules);
}

function pillCount(st, id) {
  const arr = st.inventory.pills[id];
  return arr ? arr.reduce((s, v) => s + v, 0) : 0;
}

function lowestQ(st, id) {
  const arr = st.inventory.pills[id] || [];
  return arr.findIndex((v) => v > 0);
}

export function shopping(game, data) {
  const st = game.state;
  const roots = st.player.roots;
  // 买功法：先买能用、适配的，再买其余的
  const techs = (data.shop.techniques || [])
    .map((s) => ({ s, t: data.techniques.find((x) => x.id === s.id) }))
    .filter((x) => x.t && !st.techniques.owned[x.t.id] && x.t.realmReq <= st.stage)
    .sort((a, b) => (roots.includes(b.t.element) ? 1 : 0) - (roots.includes(a.t.element) ? 1 : 0) || a.s.price - b.s.price);
  for (const { s } of techs) if (st.inventory.stones >= s.price + 20) game.buy('technique', s.id);
  // 买法宝：每个槽位都没有时就买
  for (const s of data.shop.treasures || []) {
    const t = data.treasures.find((x) => x.id === s.id);
    if (!t || t.realmReq > st.stage || st.inventory.treasures.includes(t.id)) continue;
    if (st.inventory.stones >= s.price + 30) game.buy('treasure', s.id);
  }
  // 法宝装备：每个槽位选 rarity 最高的
  const bySlot = {};
  for (const id of st.inventory.treasures) {
    const t = data.treasures.find((x) => x.id === id);
    if (!t || t.realmReq > st.stage) continue;
    if (!bySlot[t.slot] || t.rarity > bySlot[t.slot].rarity) bySlot[t.slot] = t;
  }
  for (const t of Object.values(bySlot)) if (st.treasures[t.slot] !== t.id) game.equipTreasure(t.id);
}

export function upgrades(game, data) {
  const st = game.state;
  const eq = st.techniques.equipped;
  const ids = [eq.heart, eq.body, ...(eq.skills || [])].filter(Boolean);
  for (let guard = 0; guard < 10; guard++) {
    let did = false;
    for (const id of ids) {
      const t = data.techniques.find((x) => x.id === id);
      const lv = st.techniques.owned[id];
      const cost = Math.round(t.upgradeCost * Math.pow(lv, 1.5));
      if (st.inventory.stones >= cost * 1.5) {
        const r = game.upgradeTechnique(id);
        if (r.ok) did = true;
      }
    }
    if (!did) break;
  }
}

export function alchemy(game, data) {
  const st = game.state;
  for (const r of data.recipes) {
    if (r.realmReq > st.stage) continue;
    const pill = data.pills.find((p) => p.id === r.pillId);
    if (!pill) continue;
    const cap = pill.effect.type === 'lifespan' ? 1 : 6;
    for (let k = 0; k < 4 && pillCount(st, r.pillId) < cap; k++) {
      const res = game.craft(r.id);
      if (!res.ok) break;
    }
  }
}

export function usePills(game, data, { beforeMinor = false, beforeMajor = false } = {}) {
  const st = game.state;
  for (const p of data.pills) {
    if (p.realmReq > st.stage) continue;
    const q = lowestQ(st, p.id);
    if (q < 0) continue;
    const t = p.effect.type;
    const v = game.view();
    if (t === 'qi' && num(v.qi) < num(v.qiCap) * 0.4) game.usePill(p.id, q);
    else if (t === 'qiRate' && !(st.buffs || []).some((b) => b.type === 'qiRate')) game.usePill(p.id, q);
    else if (t === 'breakthrough' && beforeMinor && num(st.pending.breakthroughBonus) < 0.1) game.usePill(p.id, q);
    else if (t === 'tribulation' && beforeMajor && num(st.pending.tribulationResist) < 0.3) game.usePill(p.id, q);
    else if (t === 'lifespan' && num(v.lifespan) - num(v.age) < 20) game.usePill(p.id, q);
  }
}

export function expeditions(game, data, opts = {}) {
  const st = game.state;
  const avail = data.dungeons.filter((d) => d.realmReq <= st.stage).sort((a, b) => b.realmReq - a.realmReq);
  const reports = [];
  // 优先最高级秘境；探索模式下所有冷却完的秘境都进
  const list = opts.explore ? avail : avail.slice(0, 2);
  for (const d of list) {
    const r = game.startExpedition(d.id);
    if (r && r.ok !== false) reports.push(r);
  }
  return reports;
}

export function tribulationPills(game, data) {
  const st = game.state;
  const out = [];
  for (const p of data.pills) {
    if (p.effect.type !== 'heal') continue;
    const arr = st.inventory.pills[p.id] || [];
    arr.forEach((c, q) => { for (let i = 0; i < c && out.length < 3; i++) out.push({ pillId: p.id, q }); });
  }
  return out;
}

/**
 * 跑一个角色直到 targetStage 或时间上限。
 * 返回 {reached, stage, played, ending, steps, tribulations, fails, error}
 */
export function playCharacter(game, data, { targetStage = 6, maxPlayed = 200 * 3600, explore = false, onStep } = {}) {
  let steps = 0;
  const maxSteps = 20000;
  while (steps++ < maxSteps) {
    const st = game.state;
    if (st.ending) break;
    if (st.stage >= targetStage) break;
    if (st.time.played >= maxPlayed) break;

    game.harvestGarden();
    shopping(game, data);
    configure(game, data);
    upgrades(game, data);
    alchemy(game, data);
    usePills(game, data);
    expeditions(game, data, { explore });

    const v = game.view();
    const b = v.breakthrough || {};
    if (b.canAttempt) {
      if (b.isMajor) {
        usePills(game, data, { beforeMajor: true });
        game.tribulation({ healPills: tribulationPills(game, data) });
      } else {
        usePills(game, data, { beforeMinor: true });
        game.breakthrough();
      }
      onStep && onStep(game);
      continue;
    }
    // 推进时间：直到灵气满或下一个冷却结束，限制在 [5, 600] 秒
    const rate = Math.max(1e-9, num(v.qiRate));
    const need = Math.max(0, num(v.breakthrough?.cost ?? v.qiCap / 2) - num(v.qi)) / rate;
    let step = Math.min(600, Math.max(5, need + 1));
    const ready = Object.values(st.expeditions.readyAt || {}).map((t) => t - st.time.played).filter((d) => d > 0);
    if (ready.length) step = Math.min(step, Math.max(5, Math.min(...ready) + 0.01));
    game.advance(step);
    onStep && onStep(game);
  }
  const st = game.state;
  return { reached: st.stage >= targetStage, stage: st.stage, played: st.time.played, ending: st.ending, steps };
}

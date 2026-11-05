// 背包、坊市、药园
import { GARDEN_CAP } from './constants.js';
import { clamp, fail, inc, num } from './util.js';

const MAXN = Number.MAX_SAFE_INTEGER;

export function addStones(state, ctx, n) {
  n = Math.floor(num(n));
  state.inventory.stones = clamp(state.inventory.stones + n, 0, MAXN);
  if (n > 0) ctx?.bus?.emit('item:gained', { kind: 'stones', count: n });
}
export function addHerb(state, ctx, id, count = 1) {
  count = Math.floor(num(count));
  if (count <= 0) return;
  inc(state.inventory.herbs, id, count);
  ctx?.bus?.emit('item:gained', { kind: 'herb', id, count });
}
export function addPill(state, ctx, id, q, count = 1) {
  count = Math.floor(num(count));
  if (count <= 0) return;
  const qi = clamp(Math.floor(num(q)), 0, 3);
  const arr = state.inventory.pills[id] || (state.inventory.pills[id] = [0, 0, 0, 0]);
  arr[qi] += count;
  ctx?.bus?.emit('item:gained', { kind: 'pill', id: `${id}`, count, q: qi });
}
export function ownsTreasure(state, id) {
  return state.inventory.treasures.includes(id) || Object.values(state.treasures).includes(id);
}
/** 获得法宝；已拥有折算灵石。返回 {dup, stones} */
export function giveTreasure(state, ctx, id) {
  const t = ctx.data.byId.treasures.get(id);
  if (!t) return { dup: false, stones: 0 };
  if (ownsTreasure(state, id)) {
    const s = Math.floor(num(t.price) * 0.5);
    addStones(state, ctx, s);
    return { dup: true, stones: s };
  }
  state.inventory.treasures.push(id);
  ctx?.bus?.emit('item:gained', { kind: 'treasure', id, count: 1 });
  return { dup: false, stones: 0 };
}
export function giveTechnique(state, ctx, id) {
  const t = ctx.data.byId.techniques.get(id);
  if (!t) return { dup: false, stones: 0 };
  if (state.techniques.owned[id]) {
    const s = Math.floor(num(t.price) * 0.5);
    addStones(state, ctx, s);
    return { dup: true, stones: s };
  }
  state.techniques.owned[id] = 1;
  ctx.bus.emit('item:gained', { kind: 'technique', id, count: 1 });
  ctx.bus.emit('technique:changed', { id, level: 1 });
  return { dup: false, stones: 0 };
}

const KINDS = { technique: 'techniques', techniques: 'techniques', herb: 'herbs', herbs: 'herbs', treasure: 'treasures', treasures: 'treasures' };

export function buy(state, ctx, kind, id) {
  const k = KINDS[kind];
  if (!k) return fail('invalid');
  const entry = (ctx.data.shop[k] || []).find((e) => e.id === id);
  if (!entry) return fail('invalid');
  const price = Math.max(0, Math.floor(num(entry.price)));
  if (k === 'techniques') {
    const t = ctx.data.byId.techniques.get(id);
    if (!t) return fail('invalid');
    if (state.techniques.owned[id]) return fail('invalid');
    if (num(t.realmReq) > state.stage) return fail('realm_too_low');
  } else if (k === 'treasures') {
    const t = ctx.data.byId.treasures.get(id);
    if (!t) return fail('invalid');
    if (ownsTreasure(state, id)) return fail('invalid');
    if (num(t.realmReq) > state.stage) return fail('realm_too_low');
  } else if (!ctx.data.byId.herbs.get(id)) return fail('invalid');
  if (state.inventory.stones < price) return fail('not_enough_stones');
  state.inventory.stones -= price;
  if (k === 'techniques') giveTechnique(state, ctx, id);
  else if (k === 'treasures') giveTreasure(state, ctx, id);
  else addHerb(state, ctx, id, 1);
  return { ok: true, price };
}

export function equipTreasure(state, ctx, id) {
  const t = ctx.data.byId.treasures.get(id);
  if (!t) return fail('invalid');
  const i = state.inventory.treasures.indexOf(id);
  if (i < 0) return fail('not_owned');
  if (num(t.realmReq) > state.stage) return fail('realm_too_low');
  state.inventory.treasures.splice(i, 1);
  const old = state.treasures[t.slot];
  if (old) state.inventory.treasures.push(old);
  state.treasures[t.slot] = id;
  return { ok: true };
}
export function unequipTreasure(state, ctx, slot) {
  const id = state.treasures[slot];
  if (!id) return fail('invalid');
  state.treasures[slot] = null;
  state.inventory.treasures.push(id);
  return { ok: true };
}

export function harvestGarden(state, ctx) {
  const n = Math.min(Math.floor(num(state.garden.pending)), GARDEN_CAP);
  if (n <= 0) return fail('invalid');
  const pool = ctx.data.herbs.filter((h) => h.garden === true).map((h) => ({ id: h.id, weight: 1 / Math.max(1, num(h.rarity, 1)) }));
  if (!pool.length) return fail('invalid');
  const got = {};
  for (let i = 0; i < n; i++) inc(got, ctx.rng.weighted(pool).id);
  for (const [id, c] of Object.entries(got)) addHerb(state, ctx, id, c);
  state.garden.pending = 0;
  return { ok: true, herbs: got, count: n };
}

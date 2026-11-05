// 结局与转世 —— DESIGN §3.14
import { createState } from './state.js';
import { addLog, num, clamp, fail } from './util.js';

export function lifespan(state, ctx) {
  return num(ctx.data.realm(state.stage).lifespan, 100) + num(state.player.lifespanBonus) + num(state.legacy.lifespanBonus);
}

export function setEnding(state, ctx, id) {
  if (state.ending) return state.ending;
  state.ending = { id, at: state.time.played };
  const e = ctx.data.byId.endings.get(id);
  addLog(state, ctx, id === 'ascend' ? 'rare' : 'bad', e ? e.name : id);
  ctx.bus.emit('ending', { id });
  return state.ending;
}

export function checkEnding(state, ctx) {
  if (state.ending) return state.ending;
  if (state.player.age >= lifespan(state, ctx)) return setEnding(state, ctx, 'sit');
  return null;
}

export function rebirth(state, ctx, { seed } = {}) {
  if (!state.ending) return null;
  const lg = { ...state.legacy };
  lg.lives = num(lg.lives) + 1;
  lg.qiBonus = clamp(num(lg.qiBonus) + (state.ending.id === 'ascend' ? 0.2 : 0.1), 0, 1);
  lg.breakBonus = clamp(num(lg.breakBonus) + 0.02, 0, 0.1);
  lg.lifespanBonus = clamp(num(lg.lifespanBonus) + 10, 0, 50);
  lg.startStones = 100 * lg.lives;
  lg.inheritTechnique = state.techniques.equipped.heart || null;
  return createState({ seed: seed ?? state.seed + 1, name: state.player.name, legacy: lg, now: state.time.lastSeen }, ctx.data);
}
export { fail };

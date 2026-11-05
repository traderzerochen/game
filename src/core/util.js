// 通用小工具：数值防御、计数、日志
import { LOG_MAX } from './constants.js';

export function num(x, d = 0) {
  return typeof x === 'number' && Number.isFinite(x) ? x : d;
}
export function clamp(x, lo, hi) {
  x = num(x, lo);
  return x < lo ? lo : x > hi ? hi : x;
}
export function inc(obj, key, n = 1) {
  obj[key] = num(obj[key], 0) + n;
}
export function fail(reason) {
  return { ok: false, reason };
}
export function addLog(state, ctx, kind, text) {
  const e = { t: num(state.time?.played, 0), kind, text };
  state.log.push(e);
  if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
  ctx?.bus?.emit('log', { kind, text });
}
export function isEnded(state) {
  return !!state.ending;
}

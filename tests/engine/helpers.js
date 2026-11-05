import DATA from '../../src/data/index.js';
import { createGame } from '../../src/core/game.js';
export function mem() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
export const mk = (seed = 7, extra = {}) => createGame({ data: DATA, seed, now: () => 1000000, ...extra });
export { DATA };

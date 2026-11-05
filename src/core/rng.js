// 可复现随机数（mulberry32）—— 见 DESIGN.md §6.1
function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const s = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed = 1) {
  let a = hashSeed(seed);
  const rng = {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** 闭区间整数 [min, max] */
    int(min, max) {
      return min + Math.floor(rng.next() * (max - min + 1));
    },
    /** 半开区间浮点 [min, max) */
    range(min, max) {
      return min + rng.next() * (max - min);
    },
    chance(p) {
      return rng.next() < p;
    },
    pick(arr) {
      return arr.length ? arr[Math.floor(rng.next() * arr.length)] : undefined;
    },
    weighted(items, key = 'weight') {
      const total = items.reduce((s, it) => s + Math.max(0, it[key] || 0), 0);
      if (total <= 0) return items[0];
      let r = rng.next() * total;
      for (const it of items) {
        r -= Math.max(0, it[key] || 0);
        if (r < 0) return it;
      }
      return items[items.length - 1];
    },
    getState() {
      return a >>> 0;
    },
    setState(s) {
      a = s >>> 0;
    },
  };
  return rng;
}

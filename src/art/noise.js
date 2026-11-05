// 种子化 value noise / fbm —— 用于晕染、山脊、手绘抖动（ART_GUIDE §4）

/** 字符串或数字 → 32 位无符号种子 */
export function hashSeed(v) {
  const s = String(v);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 伪随机数，返回 () → [0,1) */
export function seededRandom(seed) {
  let a = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lattice(seed, x, y) {
  let h = (seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** 1D value noise，返回 [0,1] */
export function noise1(seed, x) {
  const xi = Math.floor(x), xf = x - xi;
  const a = lattice(seed, xi, 0), b = lattice(seed, xi + 1, 0);
  return a + (b - a) * smooth(xf);
}

/** 2D value noise，返回 [0,1] */
export function noise2(seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = lattice(seed, xi, yi), b = lattice(seed, xi + 1, yi);
  const c = lattice(seed, xi, yi + 1), d = lattice(seed, xi + 1, yi + 1);
  const top = a + (b - a) * xf, bot = c + (d - c) * xf;
  return top + (bot - top) * yf;
}

/** 分形布朗运动，返回 [0,1]；y 省略时为 1D */
export function fbm(seed, x, y, { octaves = 4, lacunarity = 2, gain = 0.5 } = {}) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const s = (seed + i * 1013) >>> 0;
    sum += amp * (y === undefined ? noise1(s, x * freq) : noise2(s, x * freq, y * freq));
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** 便捷工厂：createNoise(seed) → {n1, n2, fbm, rand} */
export function createNoise(seed) {
  const s = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return {
    seed: s,
    n1: (x) => noise1(s, x),
    n2: (x, y) => noise2(s, x, y),
    fbm: (x, y, o) => fbm(s, x, y, o),
    rand: seededRandom(s),
  };
}

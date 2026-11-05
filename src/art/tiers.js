// 特效档位 —— ART_GUIDE §6
export const TIERS = Object.freeze({
  low: Object.freeze({ key: 'low', name: '简', particles: 40, blur: false, layers: 2, bolts: 1, inkBloom: false }),
  mid: Object.freeze({ key: 'mid', name: '中', particles: 150, blur: true, layers: 4, bolts: 3, inkBloom: false }),
  high: Object.freeze({ key: 'high', name: '繁', particles: 400, blur: true, layers: 5, bolts: 6, inkBloom: true }),
});
export const TIER_ORDER = ['low', 'mid', 'high'];

export function tier(key) {
  return TIERS[key] || TIERS.mid;
}

export function lowerTier(key) {
  const i = TIER_ORDER.indexOf(key);
  return i > 0 ? TIER_ORDER[i - 1] : null;
}

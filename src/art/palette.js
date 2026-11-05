// 色板 —— ART_GUIDE.md §2（CSS 变量同名，见 styles/main.css）
export const PALETTE = Object.freeze({
  paper: '#f3ecdc',
  paperDeep: '#e6dcc4',
  ink0: '#1d1b19',
  ink1: '#3b3833',
  ink2: '#6b665d',
  ink3: '#a39d90',
  ink4: '#cfc8b8',
  cinnabar: '#b8432f',
  azurite: '#3d6f8a',
  malachite: '#4f7d5c',
  gamboge: '#c99a2e',
  ochre: '#9a6b3f',
  glowGold: 'rgba(255,214,120,.85)',
  glowCyan: 'rgba(140,220,230,.85)',
  glowRed: 'rgba(240,120,90,.85)',
});

export const ELEMENT_COLORS = Object.freeze({
  metal: PALETTE.gamboge,
  wood: PALETTE.malachite,
  water: PALETTE.azurite,
  fire: PALETTE.cinnabar,
  earth: PALETTE.ochre,
  none: PALETTE.ink2,
});

export const ELEMENT_NAMES = Object.freeze({ metal: '金', wood: '木', water: '水', fire: '火', earth: '土', none: '无' });

// 品质：0 下品 / 1 中品 / 2 上品 / 3 极品
export const QUALITY_COLORS = Object.freeze([PALETTE.ink2, PALETTE.malachite, PALETTE.azurite, PALETTE.gamboge]);
export const QUALITY_NAMES = Object.freeze(['下品', '中品', '上品', '极品']);

export function elementColor(el) {
  return ELEMENT_COLORS[el] || ELEMENT_COLORS.none;
}

export function qualityColor(q) {
  const i = Math.max(0, Math.min(3, (q | 0)));
  return QUALITY_COLORS[i];
}

// 稀有度 1–4 映射到品质色（功法、法宝、药材共用）
export function rarityColor(rarity) {
  return qualityColor((rarity || 1) - 1);
}

/** 解析 #rrggbb → [r,g,b] */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 带透明度的颜色字符串 */
export function withAlpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** 两色线性混合（t=0 → a，t=1 → b） */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// 图标 —— 阶段 1 占位版（ART_GUIDE §8）：元素色圆角矩形 + 名称首字。
// 接口与正式版一致：全部返回 64×64 viewBox 的 SVG 字符串，由数据字段派生。
import { PALETTE, elementColor, qualityColor, rarityColor, withAlpha, ELEMENT_NAMES } from './palette.js';
import { hashSeed } from './noise.js';

const FONT = `'STKaiti','KaiTi','Kaiti SC','楷体','AR PL UKai CN','Noto Serif SC','Songti SC','SimSun',serif`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * 通用占位图标生成器 —— 所有占位图标共用。
 * @param {{label:string, color:string, border?:string, shape?:'rect'|'circle'|'diamond', sub?:string, glow?:boolean, seed?:any, size?:number, title?:string}} o
 */
export function placeholderIcon({ label, color, border, shape = 'rect', sub = '', glow = false, seed = 0, size = 64, title = '' }) {
  const h = hashSeed(seed);
  const rot = ((h % 7) - 3) * 0.6; // 轻微手绘倾斜
  const ch = esc(String(label || '?').slice(0, 1));
  const bd = border || PALETTE.ink0;
  let body;
  if (shape === 'circle') body = `<circle cx="32" cy="32" r="27" fill="${color}" stroke="${bd}" stroke-width="2.5"/>`;
  else if (shape === 'diamond') body = `<path d="M32 4 L60 32 L32 60 L4 32 Z" fill="${color}" stroke="${bd}" stroke-width="2.5" stroke-linejoin="round"/>`;
  else body = `<rect x="5" y="5" width="54" height="54" rx="10" fill="${color}" stroke="${bd}" stroke-width="2.5"/>`;
  const glowDef = glow
    ? `<defs><filter id="g${h}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs>` +
      `<circle cx="32" cy="32" r="28" fill="${PALETTE.glowGold}" filter="url(#g${h})"/>`
    : '';
  const subTxt = sub
    ? `<circle cx="52" cy="52" r="10" fill="${PALETTE.paper}" stroke="${PALETTE.ink0}" stroke-width="1.5"/>` +
      `<text x="52" y="52.5" font-size="13" text-anchor="middle" dominant-baseline="central" fill="${PALETTE.ink0}" font-family="${FONT}">${esc(sub)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" class="icon">` +
    (title ? `<title>${esc(title)}</title>` : '') +
    glowDef +
    `<g transform="rotate(${rot.toFixed(1)} 32 32)">${body}</g>` +
    `<text x="32" y="33" font-size="30" text-anchor="middle" dominant-baseline="central" fill="${PALETTE.paper}" font-family="${FONT}" font-weight="bold">${ch}</text>` +
    subTxt + `</svg>`;
}

const TECH_TYPE = { heart: '心', skill: '技', body: '体' };

export function techniqueIcon(tech, opts = {}) {
  if (!tech) return placeholderIcon({ label: '?', color: PALETTE.ink3, ...opts });
  return placeholderIcon({
    label: tech.name, color: elementColor(tech.element), border: rarityColor(tech.rarity) === PALETTE.ink2 ? PALETTE.ink0 : rarityColor(tech.rarity),
    sub: TECH_TYPE[tech.type] || '', glow: tech.rarity >= 4, seed: tech.id, title: tech.name, ...opts,
  });
}

export function herbIcon(herb, opts = {}) {
  if (!herb) return placeholderIcon({ label: '?', color: PALETTE.ink3, ...opts });
  return placeholderIcon({ label: herb.name, color: elementColor(herb.element), shape: 'circle', glow: herb.rarity >= 4, seed: herb.id, title: herb.name, ...opts });
}

export function pillIcon(pill, q = 0, opts = {}) {
  if (!pill) return placeholderIcon({ label: '?', color: PALETTE.ink3, ...opts });
  return placeholderIcon({ label: pill.name, color: qualityColor(q), shape: 'circle', glow: q >= 3, seed: pill.id, title: pill.name, ...opts });
}

const SLOT_SUB = { weapon: '兵', armor: '甲', charm: '佩' };
export function treasureIcon(t, opts = {}) {
  if (!t) return placeholderIcon({ label: '?', color: PALETTE.ink3, ...opts });
  return placeholderIcon({ label: t.name, color: rarityColor(t.rarity), shape: 'diamond', sub: SLOT_SUB[t.slot] || '', glow: t.rarity >= 4, seed: t.id, title: t.name, ...opts });
}

export function rootIcon(el, opts = {}) {
  return placeholderIcon({ label: ELEMENT_NAMES[el] || '?', color: elementColor(el), shape: 'circle', seed: el, title: `${ELEMENT_NAMES[el] || ''}灵根`, ...opts });
}

export function enemyPortrait(enemy, opts = {}) {
  if (!enemy) return placeholderIcon({ label: '?', color: PALETTE.ink3, ...opts });
  return placeholderIcon({ label: enemy.name, color: withAlpha(elementColor(enemy.element), 0.9), border: enemy.boss ? PALETTE.cinnabar : PALETTE.ink0, sub: enemy.boss ? '首' : '', seed: enemy.id, title: enemy.name, ...opts });
}

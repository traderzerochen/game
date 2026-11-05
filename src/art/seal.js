// 印章 —— sealSVG(text, {color, shape, mode})，ART_GUIDE §4/§7
import { PALETTE } from './palette.js';
import { hashSeed, seededRandom } from './noise.js';

const FONT = `'STKaiti','KaiTi','Kaiti SC','楷体','AR PL UKai CN','Noto Serif SC','SimSun',serif`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {string} text  1–4 字
 * @param {{color?:string, shape?:'square'|'round'|'oval', mode?:'yin'|'yang', size?:number}} o
 *   yin 阴刻：朱底白字；yang 阳刻：白底朱字朱框
 */
export function sealSVG(text, { color = PALETTE.cinnabar, shape = 'square', mode = 'yin', size = 48 } = {}) {
  const chars = [...String(text || '印')].slice(0, 4);
  const seed = hashSeed(text);
  const rand = seededRandom(seed);
  const j = () => ((rand() - 0.5) * 2).toFixed(1);
  const fill = mode === 'yin' ? color : 'none';
  const ink = mode === 'yin' ? PALETTE.paper : color;
  let frame;
  if (shape === 'round') frame = `<circle cx="32" cy="32" r="28" fill="${fill}" stroke="${color}" stroke-width="3"/>`;
  else if (shape === 'oval') frame = `<ellipse cx="32" cy="32" rx="22" ry="29" fill="${fill}" stroke="${color}" stroke-width="3"/>`;
  else frame = `<path d="M${4 + +j()} ${4 + +j()} L${60 + +j()} ${4 + +j()} L${60 + +j()} ${60 + +j()} L${4 + +j()} ${60 + +j()} Z" fill="${fill}" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`;
  let txt = '';
  if (chars.length === 1) {
    txt = t(chars[0], 32, 33, 36);
  } else if (chars.length === 2) {
    txt = t(chars[0], 32, 19, 24) + t(chars[1], 32, 45, 24);
  } else {
    // 3–4 字：右起竖排两列
    const pos = [[44, 19], [44, 45], [20, 19], [20, 45]];
    chars.forEach((c, i) => { txt += t(c, pos[i][0], pos[i][1], 22); });
  }
  function t(c, x, y, fs) {
    return `<text x="${x}" y="${y}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="${ink}" font-family="${FONT}" font-weight="bold">${esc(c)}</text>`;
  }
  // 边缘斑驳：随机小缺口
  let wear = '';
  for (let i = 0; i < 5; i++) {
    wear += `<circle cx="${(6 + rand() * 52).toFixed(1)}" cy="${(rand() < 0.5 ? 5 : 59).toFixed(1)}" r="${(0.6 + rand() * 1.4).toFixed(1)}" fill="${PALETTE.paper}" opacity="0.8"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" class="seal">${frame}${txt}${wear}</svg>`;
}

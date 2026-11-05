// 图标 —— 正式水墨版（ART_GUIDE §4）。全部返回 64×64 viewBox 的 SVG 字符串，由数据字段派生：
// 元素色、稀有度 / 品质、名称关键字与 id 哈希决定形态与变体；描边为带种子抖动的墨线与毛笔笔触。
// 接口与阶段 1 占位版一致：techniqueIcon(tech, {size}) / herbIcon / pillIcon(pill, q, {size}) / treasureIcon / rootIcon(el) / enemyPortrait / placeholderIcon。
import { PALETTE, elementColor, qualityColor, rarityColor, withAlpha, mix, ELEMENT_NAMES } from './palette.js';
import { hashSeed, seededRandom } from './noise.js';
import { jitterPath } from './brush.js';
import { silhouetteSVG, enemySilhouette, inkStrokeD, smoothD } from './silhouette.js';

const FONT = `'STKaiti','KaiTi','Kaiti SC','楷体','AR PL UKai CN','Noto Serif SC','Songti SC','SimSun',serif`;
const P = PALETTE;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n1 = (v) => Math.round(v * 10) / 10;
let UID = 0;
const uid = (p = 'ic') => `${p}${(++UID).toString(36)}`;
const firstChar = (s) => esc([...String(s || '?')][0]);

// ---------------------------------------------------------------- 通用笔墨片段

/** 每个图标一个画稿：收集 defs 与图层 */
class Icon {
  constructor(seed) {
    this.h = hashSeed(seed);
    this.r = seededRandom(this.h);
    this.k = 0;
    this.defs = [];
    this.out = [];
  }
  j(a) { return (this.r() * 2 - 1) * a; }
  add(s) { this.out.push(s); return this; }
  def(s) { this.defs.push(s); }
  /** 抖动墨线（ART_GUIDE：描边 2–3px、带种子化手绘抖动） */
  line(pts, { w = 2.2, c = P.ink0, a = 1, amp = 0.5, closed = false, fill = 'none', fa = 1 } = {}) {
    const d = jitterPath(pts, { seed: this.h + ++this.k * 131, amp, closed });
    return this.add(`<path d="${d}" fill="${fill}"${fa < 1 && fill !== 'none' ? ` fill-opacity="${fa}"` : ''} stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${a < 1 ? ` stroke-opacity="${a}"` : ''}/>`);
  }
  /** 毛笔笔触（变宽、起收笔） */
  brush(pts, w, { c = P.ink0, a = 1, ...o } = {}) {
    return this.add(`<path d="${inkStrokeD(pts, w, { seed: this.h + ++this.k * 977, ...o })}" fill="${c}"${a < 1 ? ` fill-opacity="${a}"` : ''}/>`);
  }
  /** 平滑墨块 */
  blob(pts, { c, a = 1, stroke = null, w = 1.6 } = {}) {
    return this.add(`<path d="${smoothD(pts)}" fill="${c}"${a < 1 ? ` fill-opacity="${a}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"` : ''}/>`);
  }
  /** 径向渐变，返回 url(#id) */
  radial(stops, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) {
    const id = uid('r');
    this.def(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`);
    return `url(#${id})`;
  }
  linear(stops, [x1, y1, x2, y2] = [0, 0, 0, 1]) {
    const id = uid('l');
    this.def(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`);
    return `url(#${id})`;
  }
  /** 宣纸底上的淡墨晕（每个图标的底） */
  wash(cx = 32, cy = 34, r = 29, c = P.ink4, a = 0.55) {
    return this.add(`<circle cx="${n1(cx + this.j(1.5))}" cy="${n1(cy + this.j(1.5))}" r="${r}" fill="${this.radial([[0, c, a], [0.7, c, a * 0.45], [1, c, 0]])}"/>`);
  }
  /** 柔光（极品 / 高稀有度） */
  glow(c, r = 28, a = 0.85, cx = 32, cy = 32) {
    return this.add(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${this.radial([[0, c, a], [0.55, c, a * 0.45], [1, c, 0]])}"/>`);
  }
  /** 四芒星光点 */
  spark(x, y, r, c = P.gamboge, a = 0.95) {
    const q = r * 0.28;
    return this.add(`<path d="M${n1(x)} ${n1(y - r)}Q${n1(x + q)} ${n1(y - q)} ${n1(x + r)} ${n1(y)}Q${n1(x + q)} ${n1(y + q)} ${n1(x)} ${n1(y + r)}Q${n1(x - q)} ${n1(y + q)} ${n1(x - r)} ${n1(y)}Q${n1(x - q)} ${n1(y - q)} ${n1(x)} ${n1(y - r)}Z" fill="${c}" fill-opacity="${a}"/>`);
  }
  text(ch, x, y, size, c = P.ink0, extra = '') {
    return this.add(`<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="${c}" font-family="${FONT}"${extra}>${ch}</text>`);
  }
  svg({ size = 64, title = '' } = {}) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" class="icon">` +
      (title ? `<title>${esc(title)}</title>` : '') +
      (this.defs.length ? `<defs>${this.defs.join('')}</defs>` : '') + this.out.join('') + `</svg>`;
  }
}

/** 矩形轮廓点（边上加点，jitterPath 平滑后棱角仍在） */
function rectPts(x, y, w, h) {
  const pts = [];
  const C = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  for (let i = 0; i < 4; i++) {
    const a = C[i], b = C[(i + 1) % 4];
    pts.push(a, [a[0] + (b[0] - a[0]) * 0.03, a[1] + (b[1] - a[1]) * 0.03], [a[0] + (b[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * 0.5], [a[0] + (b[0] - a[0]) * 0.97, a[1] + (b[1] - a[1]) * 0.97]);
  }
  pts.push(C[0], [x + w * 0.03, y]);
  return pts;
}
const circ = (cx, cy, r, n = 16, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});
const elColor = (el) => (el && el !== 'none' ? elementColor(el) : mix(P.ink2, P.azurite, 0.25));

/** 名称 / 描述关键字 → 形态；都不中时按 id 哈希 */
function pickForm(item, table, fallback) {
  const name = String(item.name || ''), desc = String(item.desc || '');
  for (const [re, form] of table) if (re.test(name)) return form;
  for (const [re, form] of table) if (re.test(desc)) return form;
  return fallback[hashSeed(item.id || name) % fallback.length];
}

// ---------------------------------------------------------------- 占位（保留：历练结算「灵石」等仍在使用）

/**
 * 通用占位图标：元素色圆角块 + 首字。
 * @param {{label:string, color:string, border?:string, shape?:'rect'|'circle'|'diamond', sub?:string, glow?:boolean, seed?:any, size?:number, title?:string}} o
 */
export function placeholderIcon({ label, color, border, shape = 'rect', sub = '', glow = false, seed = 0, size = 64, title = '' }) {
  const h = hashSeed(seed);
  const rot = ((h % 7) - 3) * 0.6;
  const ch = firstChar(label);
  const bd = border || P.ink0;
  let body;
  if (shape === 'circle') body = `<circle cx="32" cy="32" r="27" fill="${color}" stroke="${bd}" stroke-width="2.5"/>`;
  else if (shape === 'diamond') body = `<path d="M32 4 L60 32 L32 60 L4 32 Z" fill="${color}" stroke="${bd}" stroke-width="2.5" stroke-linejoin="round"/>`;
  else body = `<rect x="5" y="5" width="54" height="54" rx="10" fill="${color}" stroke="${bd}" stroke-width="2.5"/>`;
  const gid = uid('g');
  const glowDef = glow
    ? `<defs><filter id="${gid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs>` +
      `<circle cx="32" cy="32" r="28" fill="${P.glowGold}" filter="url(#${gid})"/>`
    : '';
  const subTxt = sub
    ? `<circle cx="52" cy="52" r="10" fill="${P.paper}" stroke="${P.ink0}" stroke-width="1.5"/>` +
      `<text x="52" y="52.5" font-size="13" text-anchor="middle" dominant-baseline="central" fill="${P.ink0}" font-family="${FONT}">${esc(sub)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" class="icon">` +
    (title ? `<title>${esc(title)}</title>` : '') + glowDef +
    `<g transform="rotate(${rot.toFixed(1)} 32 32)">${body}</g>` +
    `<text x="32" y="33" font-size="30" text-anchor="middle" dominant-baseline="central" fill="${P.paper}" font-family="${FONT}" font-weight="bold">${ch}</text>` +
    subTxt + `</svg>`;
}

function unknownIcon(opts = {}) {
  const I = new Icon('unknown');
  I.wash();
  I.line(circ(32, 32, 20, 18), { w: 2.2, c: P.ink3, closed: true });
  I.text('？', 32, 33, 22, P.ink2);
  return I.svg(opts);
}

// ---------------------------------------------------------------- 功法：线装书

const TECH_TAG = { heart: ['心', 'round', P.cinnabar], skill: ['术', 'square', P.cinnabar], body: ['护', 'square', P.azurite] };

/** 封面暗纹（按元素） */
function coverMotif(I, el, x, y) {
  const o = { w: 0.8, c: P.paper, a: 0.4, amp: 0.3 };
  if (el === 'water') for (let i = 0; i < 3; i++) I.line([[x, y + i * 3.5], [x + 4, y - 2 + i * 3.5], [x + 8, y + i * 3.5], [x + 12, y - 2 + i * 3.5], [x + 16, y + i * 3.5]], o);
  else if (el === 'fire') for (let i = 0; i < 3; i++) I.line([[x + i * 6, y + 8], [x + 2 + i * 6, y + 3], [x + i * 6, y - 1], [x + 3 + i * 6, y - 4]], o);
  else if (el === 'wood') { I.line([[x, y + 8], [x + 16, y - 4]], o); for (let i = 1; i < 4; i++) I.line([[x + i * 4, y + 8 - i * 3], [x + i * 4 - 1, y + 2 - i * 3]], o); }
  else if (el === 'earth') I.line([[x, y + 7], [x + 5, y], [x + 8, y + 4], [x + 12, y - 2], [x + 17, y + 7]], o);
  else if (el === 'metal') { I.line([[x, y + 7], [x + 16, y - 3]], o); I.line([[x + 3, y + 8], [x + 17, y + 1]], o); }
  else I.line([[x, y + 4], [x + 4, y], [x + 8, y + 3], [x + 6, y + 6], [x + 3, y + 4], [x + 9, y + 1], [x + 15, y + 4]], o);
}

export function techniqueIcon(tech, opts = {}) {
  if (!tech) return unknownIcon(opts);
  const I = new Icon(tech.id || tech.name);
  const el = tech.element, base = elColor(el);
  const cover = mix(base, P.paper, 0.12);
  const rar = tech.rarity || 1;
  I.wash();
  if (rar >= 4) I.glow(P.glowGold, 31, 0.9);
  else if (rar === 3) I.glow(withAlpha(rarityColor(rar), 1), 30, 0.22);
  const rot = n1(I.j(4));
  I.add(`<g transform="rotate(${rot} 32 32)">`);
  // 书页（错层露边）
  I.line(rectPts(17, 10, 36, 46), { w: 1.2, c: P.ink1, fill: P.paper, amp: 0.3 });
  I.line([[19, 55.2], [52, 55.2]], { w: 0.5, c: P.ink3, amp: 0.1 });
  I.line([[52.2, 12], [52.2, 54]], { w: 0.5, c: P.ink3, amp: 0.1 });
  // 封面
  I.add(`<rect x="14" y="7" width="36" height="46" fill="${cover}"/>`);
  I.add(`<rect x="14" y="7" width="36" height="46" fill="${I.linear([[0, P.ink0, 0], [1, P.ink0, 0.28]], [0, 0, 1, 1])}"/>`);
  coverMotif(I, el, 19, 44);
  if (rar >= 2) I.line(rectPts(16.5, 9.5, 31, 41), { w: 0.8, c: rar >= 4 ? P.gamboge : mix(rarityColor(rar), P.paper, 0.3), amp: 0.2, a: 0.9 });
  // 右侧线装：针眼 + 缝线
  I.line([[45, 8], [45, 52]], { w: 0.7, c: P.paper, a: 0.75, amp: 0.15 });
  for (const y of [11, 20, 30, 40, 49]) { I.line([[45, y], [50, y]], { w: 1, c: P.paper, a: 0.85, amp: 0.1 }); I.add(`<circle cx="45" cy="${y}" r="0.9" fill="${P.ink0}" fill-opacity=".6"/>`); }
  // 题签 + 书名首字
  I.add(`<rect x="18.5" y="11" width="12.5" height="27" fill="${P.paper}"/>`);
  I.line(rectPts(19.6, 12.1, 10.3, 24.8), { w: 0.6, c: P.ink1, a: 0.7, amp: 0.15 });
  I.text(firstChar(tech.name), 24.8, 22, 11.5, P.ink0, ' font-weight="bold"');
  const tail = [...String(tech.name || '')].slice(1, 2).join('');
  if (tail) I.text(esc(tail), 24.8, 32, 7.5, P.ink1);
  I.line(rectPts(14, 7, 36, 46), { w: 2.3, c: P.ink0, amp: 0.45 });
  I.add('</g>');
  // 类型角标：心法圆印、术法方印、护体石青方印
  const [ch, shape, col] = TECH_TAG[tech.type] || ['卷', 'square', P.ink1];
  I.add(`<g transform="rotate(${n1(-6 + I.j(4))} 49 50)">`);
  if (shape === 'round') I.add(`<circle cx="49" cy="50" r="7.5" fill="${col}" stroke="${P.paper}" stroke-width="1"/>`);
  else I.add(`<rect x="41.5" y="42.5" width="15" height="15" rx="1.5" fill="${col}" stroke="${P.paper}" stroke-width="1"/>`);
  I.text(ch, 49, 50.5, 10, P.paper, ' font-weight="bold"');
  I.add('</g>');
  return I.svg({ title: tech.name, ...opts });
}

// ---------------------------------------------------------------- 药材：草 / 芝 / 兰 / 莲 / 果 / 根 / 石乳 / 叶 / 藤 / 苔 / 蕈

const HERB_FORMS = [[/蕈|菇/, 'mushroom'], [/芝/, 'zhi'], [/莲/, 'lotus'], [/兰|花/, 'orchid'], [/果|实/, 'fruit'], [/根|参/, 'root'], [/乳|髓液/, 'milk'], [/叶/, 'leaf'], [/藤/, 'vine'], [/苔|藓/, 'moss'], [/草/, 'grass']];

const HERB_DRAW = {
  grass(I, c, item) {
    const leaf = mix(c, P.ink1, 0.3);
    const tips = [[-17, 18], [-10, 10], [-3, 6], [5, 8], [12, 12], [18, 20]];
    tips.forEach(([dx, ty], i) => I.brush([[32 + dx * 0.15, 55], [32 + dx * 0.55 + I.j(1.5), 38], [32 + dx + I.j(1.5), ty]], 3.4, { c: i % 2 ? leaf : c, head: 0.05, tail: 0.7 }));
    if (item.element === 'metal') { I.spark(16, 17, 3.2); I.spark(47, 12, 2.6); I.spark(36, 6, 2); }
    else for (const [x, y] of [[15, 19], [29, 8], [50, 21]]) { I.add(`<circle cx="${x}" cy="${y}" r="2.3" fill="${mix(c, P.paper, 0.35)}" stroke="${P.ink1}" stroke-width=".7"/>`); I.add(`<circle cx="${x - 0.7}" cy="${y - 0.8}" r=".7" fill="${P.paper}"/>`); }
  },
  zhi(I, c) {
    I.brush([[33, 56], [31, 46], [33, 34]], 4.2, { c: P.ochre, head: 0.1, tail: 0.2, taper: 0.4 });
    const cap = (cx, cy, rx, ry) => {
      const pts = [[cx - rx, cy + ry * 0.4], [cx - rx * 0.8, cy - ry * 0.6], [cx - rx * 0.2, cy - ry], [cx + rx * 0.4, cy - ry * 0.9], [cx + rx, cy - ry * 0.1], [cx + rx * 0.7, cy + ry * 0.6], [cx, cy + ry * 0.35], [cx - rx * 0.6, cy + ry * 0.7]];
      I.blob(pts, { c: I.radial([[0, mix(c, P.paper, 0.25)], [1, mix(c, P.ink0, 0.3)]], { cy: 0.3 }), stroke: P.ink0, w: 1.8 });
      for (let k = 1; k <= 2; k++) I.line(circ(cx, cy + ry * 0.35, rx * (1 - k * 0.25), 10, Math.PI * 1.05, Math.PI * 1.95), { w: 0.8, c: P.paper, a: 0.6, amp: 0.3 });
      for (let k = 0; k < 4; k++) { const a = Math.PI * (1.15 + k * 0.22); I.line([[cx + Math.cos(a) * rx * 0.3, cy + Math.sin(a) * ry * 0.3], [cx + Math.cos(a) * rx * 0.85, cy + Math.sin(a) * ry * 0.85]], { w: 0.6, c: P.ink0, a: 0.4, amp: 0.2 }); }
    };
    cap(20, 44, 9, 6);
    cap(34, 28, 17, 11);
  },
  orchid(I, c) {
    const lc = P.ink1;
    I.brush([[30, 56], [20, 40], [10, 26]], 2.8, { c: lc, head: 0.08, tail: 0.6 });
    I.brush([[32, 56], [38, 36], [54, 22]], 2.6, { c: lc, head: 0.08, tail: 0.6 });
    I.brush([[31, 56], [28, 42], [34, 30], [46, 32]], 2.2, { c: lc, head: 0.08, tail: 0.6 });
    const fx = 33, fy = 19;
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.75, L = 10;
      const tip = [fx + Math.cos(a) * L, fy + Math.sin(a) * L + 2], s = [Math.cos(a + 1.57) * 3, Math.sin(a + 1.57) * 3];
      I.blob([[fx, fy + 1], [fx + (tip[0] - fx) * 0.5 + s[0], fy + (tip[1] - fy) * 0.5 + s[1]], tip, [fx + (tip[0] - fx) * 0.5 - s[0], fy + (tip[1] - fy) * 0.5 - s[1]]],
        { c: I.radial([[0, mix(c, P.paper, 0.2)], [1, P.paper]], { r: 0.7 }), stroke: P.ink1, w: 0.9 });
    }
    I.add(`<circle cx="${fx}" cy="${fy + 1}" r="2.4" fill="${c}"/>`);
    I.spark(fx + 1, fy + 0.5, 2, P.paper);
    I.brush([[32, 36], [33, 28], [33, 22]], 1.4, { c: P.ink1, head: 0.05, tail: 0.3 });
  },
  lotus(I, c) {
    I.blob([[8, 52], [20, 46], [36, 47], [52, 50], [44, 56], [22, 57]], { c: mix(P.malachite, P.ink1, 0.35), stroke: P.ink0, w: 1.4 });
    I.line([[30, 52], [18, 50]], { w: 0.6, c: P.paper, a: 0.5 }); I.line([[30, 52], [42, 50]], { w: 0.6, c: P.paper, a: 0.5 });
    const petal = (bx, by, tx, ty, wd, back) => {
      const m = [(bx + tx) / 2, (by + ty) / 2], dx = ty - by, dy = bx - tx, l = Math.hypot(dx, dy) || 1;
      I.blob([[bx, by], [m[0] + (dx / l) * wd, m[1] + (dy / l) * wd], [tx, ty], [m[0] - (dx / l) * wd, m[1] - (dy / l) * wd]],
        { c: I.linear([[0, back ? mix(P.paper, c, 0.25) : P.paper], [1, mix(c, P.paper, back ? 0.35 : 0.55)]], [0, 0, 0, 1]), stroke: P.ink1, w: 1 });
    };
    petal(32, 46, 14, 22, 6, true); petal(32, 46, 50, 22, 6, true); petal(32, 46, 32, 10, 6.5, true);
    petal(32, 47, 21, 22, 6.5); petal(32, 47, 43, 22, 6.5); petal(32, 48, 32, 18, 7);
    for (const [x, y] of [[29, 27], [32, 25], [35, 27], [32, 29]]) I.add(`<circle cx="${x}" cy="${y}" r="1.1" fill="${P.gamboge}"/>`);
  },
  fruit(I, c, item) {
    const fc = /紫/.test(item.name) ? mix(P.cinnabar, P.azurite, 0.5) : c;
    I.brush([[6, 14], [22, 12], [40, 16], [58, 12]], 3, { c: P.ink1, head: 0.1, tail: 0.5 });
    I.blob([[40, 16], [48, 6], [56, 9], [50, 16]], { c: mix(P.malachite, P.ink1, 0.3), stroke: P.ink0, w: 1 });
    I.blob([[20, 13], [12, 5], [8, 9], [14, 15]], { c: mix(P.malachite, P.ink1, 0.3), stroke: P.ink0, w: 1 });
    for (const [x, y, r] of [[22, 36, 11], [40, 42, 12.5]]) {
      I.line([[x + 1, 15], [x, y - r]], { w: 1.2, c: P.ink1 });
      I.add(`<circle cx="${x}" cy="${y}" r="${r}" fill="${I.radial([[0, mix(fc, P.paper, 0.45)], [0.6, fc], [1, mix(fc, P.ink0, 0.4)]], { cx: 0.35, cy: 0.3, r: 0.75 })}"/>`);
      I.line([[x - r * 0.5, y - r * 0.2], [x, y - r * 0.75], [x + r * 0.55, y - r * 0.15], [x, y + r * 0.5], [x - r * 0.5, y - r * 0.2]], { w: 0.6, c: P.paper, a: 0.5, amp: 0.2 });
      I.line(circ(x, y, r, 16), { w: 1.8, c: P.ink0, closed: true, amp: 0.35 });
      I.add(`<ellipse cx="${n1(x - r * 0.4)}" cy="${n1(y - r * 0.45)}" rx="${n1(r * 0.22)}" ry="${n1(r * 0.13)}" fill="${P.paper}" fill-opacity=".8" transform="rotate(-35 ${n1(x - r * 0.4)} ${n1(y - r * 0.45)})"/>`);
    }
  },
  root(I, c) {
    const body = mix(P.ochre, P.paper, 0.15);
    for (const [a, b] of [[[24, 40], [12, 54]], [[30, 46], [26, 60]], [[38, 44], [46, 58]], [[42, 36], [56, 44]], [[22, 32], [8, 36]]]) I.brush([a, [(a[0] + b[0]) / 2 + I.j(2), (a[1] + b[1]) / 2], b], 2, { c: P.ink1, head: 0.05, tail: 0.8 });
    I.blob([[22, 22], [32, 18], [42, 24], [44, 34], [36, 46], [28, 48], [20, 40], [18, 30]], { c: I.radial([[0, mix(body, P.paper, 0.3)], [1, mix(body, P.ink0, 0.25)]], { cx: 0.4, cy: 0.35 }), stroke: P.ink0, w: 1.8 });
    for (let k = 0; k < 3; k++) I.line([[22 + k * 2, 28 + k * 6], [30 + k * 3, 27 + k * 6]], { w: 0.7, c: P.ink0, a: 0.4 });
    I.add(`<ellipse cx="37" cy="31" rx="5" ry="4.2" fill="${P.paper}" stroke="${P.ink1}" stroke-width=".8"/>`);
    I.add(`<ellipse cx="37" cy="31" rx="2.6" ry="2.2" fill="${c}"/>`);
    I.brush([[30, 19], [28, 10], [22, 4]], 2.2, { c: mix(P.malachite, P.ink1, 0.3), head: 0.05, tail: 0.7 });
    I.brush([[32, 19], [36, 9], [42, 5]], 2.2, { c: mix(P.malachite, P.ink1, 0.3), head: 0.05, tail: 0.7 });
  },
  milk(I, c) {
    const rock = [[4, 57], [6, 34], [9, 20], [18, 11], [30, 7], [44, 9], [55, 17], [59, 30], [50, 33], [40, 30], [33, 31], [24, 31], [17, 38], [16, 57], [4, 57]];
    I.line(rock, { w: 2, c: P.ink0, fill: I.linear([[0, P.ink3], [1, P.ink2]]), amp: 0.3 });
    I.line([[12, 22], [18, 18], [22, 24]], { w: 0.8, c: P.paper, a: 0.5 });
    I.line([[36, 12], [46, 14]], { w: 0.8, c: P.paper, a: 0.45 });
    I.line([[24, 14], [28, 22], [25, 28]], { w: 0.8, c: P.ink1, a: 0.6 });
    I.line([[44, 15], [41, 24]], { w: 0.8, c: P.ink1, a: 0.6 });
    const milk = mix(P.paper, c, 0.12);
    I.blob([[26, 30], [32, 29], [38, 31], [35, 36], [32, 41], [29, 36]], { c: milk, stroke: P.ink1, w: 0.9 });
    I.blob([[32, 43], [34.5, 47.5], [32, 50], [29.5, 47.5]], { c: milk, stroke: P.ink1, w: 0.9 });
    I.add(`<ellipse cx="34" cy="56" rx="14" ry="3.6" fill="${milk}" stroke="${P.ink1}" stroke-width="1"/>`);
    I.add(`<ellipse cx="28" cy="55" rx="5" ry="1.2" fill="${P.paper}"/>`);
    I.add(`<circle cx="31" cy="46.5" r=".8" fill="${P.paper}"/>`);
  },
  leaf(I, c) {
    I.add('<g transform="rotate(-30 32 34)">');
    I.blob([[32, 58], [18, 44], [16, 26], [26, 12], [32, 4], [38, 12], [48, 26], [46, 44]], { c: I.linear([[0, mix(c, P.paper, 0.25)], [1, mix(c, P.ink0, 0.25)]]), stroke: P.ink0, w: 2 });
    I.line([[32, 60], [32, 8]], { w: 1.3, c: P.paper, a: 0.9, amp: 0.2 });
    for (let k = 0; k < 4; k++) { const y = 46 - k * 9; I.line([[32, y], [22 + k, y - 6]], { w: 0.8, c: P.paper, a: 0.8, amp: 0.2 }); I.line([[32, y], [42 - k, y - 6]], { w: 0.8, c: P.paper, a: 0.8, amp: 0.2 }); }
    I.add('</g>');
    I.spark(50, 14, 2.4, P.paper);
  },
  vine(I, c) {
    I.blob([[12, 56], [16, 46], [30, 42], [44, 46], [50, 56]], { c: P.ink3, stroke: P.ink1, w: 1.2 });
    I.blob([[28, 50], [34, 48], [40, 52], [36, 57], [28, 56]], { c: mix(P.ochre, P.paper, 0.1), stroke: P.ink0, w: 1.2 });
    I.brush([[32, 50], [22, 40], [36, 30], [24, 20], [34, 12], [44, 8]], 2.6, { c: P.ink1, head: 0.05, tail: 0.5 });
    for (const [x, y, a] of [[22, 38, -40], [38, 28, 30], [24, 18, -30], [44, 8, 20]]) {
      I.add(`<g transform="rotate(${a} ${x} ${y})">`);
      I.blob([[x, y], [x - 5, y - 4], [x - 4, y - 8], [x, y - 6], [x + 4, y - 8], [x + 5, y - 4]], { c: mix(c, P.malachite, 0.3), stroke: P.ink0, w: 0.9 });
      I.add('</g>');
    }
  },
  moss(I, c) {
    I.add('<g transform="rotate(-8 32 34)">');
    I.line(rectPts(9, 12, 46, 42), { w: 2, c: P.ink0, fill: mix(P.ochre, P.ink1, 0.35), amp: 0.5 });
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5 - (row % 2); col++) {
      const x = 15 + col * 9 + (row % 2) * 4.5, y = 20 + row * 8.5;
      I.add(`<path d="M${x - 4.5} ${y}A4.5 4.5 0 0 0 ${x + 4.5} ${y}Z" fill="${row % 2 ? c : mix(c, P.paper, 0.25)}" stroke="${P.ink0}" stroke-width=".8"/>`);
      I.line([[x - 2, y + 1.6], [x + 1.5, y + 2.5]], { w: 0.5, c: P.paper, a: 0.6, amp: 0.1 });
    }
    I.add('</g>');
  },
  mushroom(I, c) {
    const capC = mix(P.azurite, P.paper, 0.45);
    I.glow(P.glowCyan, 20, 0.45, 32, 26);
    I.brush([[32, 57], [30, 44], [32, 30]], 4, { c: P.paper, head: 0.1, tail: 0.1, taper: 0.3 });
    I.brush([[30.2, 57], [28.3, 44], [30.3, 30]], 1, { c: P.ink1, head: 0.1, tail: 0.3 });
    I.add(`<path d="M10 31Q14 8 32 7Q50 8 54 31Q32 37 10 31Z" fill="${capC}" fill-opacity=".55" stroke="${P.ink0}" stroke-width="1.6"/>`);
    for (const [x, y, r] of [[22, 20, 2.2], [36, 14, 1.8], [44, 24, 2]]) I.add(`<circle cx="${x}" cy="${y}" r="${r}" fill="${P.paper}" fill-opacity=".8"/>`);
    I.line([[14, 30], [32, 33], [50, 30]], { w: 0.7, c: P.ink1, a: 0.6 });
    I.line([[44, 50], [50, 46], [56, 48]], { w: 0.8, c: P.ink3, a: 0.8 });
    I.line([[8, 46], [14, 42], [20, 44]], { w: 0.8, c: P.ink3, a: 0.8 });
    void c;
  },
};

export function herbIcon(herb, opts = {}) {
  if (!herb) return unknownIcon(opts);
  const I = new Icon(herb.id || herb.name);
  const c = elColor(herb.element);
  const form = pickForm(herb, HERB_FORMS, ['grass', 'zhi', 'orchid', 'fruit', 'root', 'leaf']);
  const rar = herb.rarity || 1;
  I.wash();
  if (rar >= 4) I.glow(P.glowGold, 31, 0.8);
  if (!['milk', 'moss', 'vine'].includes(form)) {
    I.add(`<ellipse cx="32" cy="56.5" rx="20" ry="3.5" fill="${I.radial([[0, P.ink2, 0.45], [1, P.ink2, 0]])}"/>`);
    I.brush([[14, 56.5], [32, 55.5], [50, 56.8]], 2, { c: P.ink2, a: 0.7, head: 0.2, tail: 0.5 });
  }
  HERB_DRAW[form](I, c, herb);
  if (rar >= 3) { I.spark(10, 10, 2.6, rar >= 4 ? P.gamboge : mix(c, P.paper, 0.2)); I.spark(55, 40, 1.8, rar >= 4 ? P.gamboge : mix(c, P.paper, 0.2)); }
  return I.svg({ title: herb.name, ...opts });
}

// ---------------------------------------------------------------- 丹药：丹丸 + 丹瓶 / 葫芦；品质 → 光晕

const PILL_COLOR = {
  qi: P.azurite, qiRate: P.malachite, breakthrough: P.cinnabar, tribulation: P.gamboge,
  heal: mix(P.cinnabar, P.paper, 0.2), mp: mix(P.azurite, P.malachite, 0.35), lifespan: mix(P.gamboge, P.ochre, 0.35),
};

export function pillIcon(pill, q = 0, opts = {}) {
  if (!pill) return unknownIcon(opts);
  const qq = Math.max(0, Math.min(3, q | 0));
  const I = new Icon(pill.id || pill.name);
  const type = pill.effect?.type;
  const c = PILL_COLOR[type] || [P.azurite, P.malachite, P.cinnabar, P.gamboge, P.ochre][I.h % 5];
  const qc = qualityColor(qq);
  I.wash();
  if (qq === 3) I.glow(P.glowGold, 31, 0.9);
  // 容器
  if (I.h % 2 === 0) {
    // 青花瓷瓶 + 朱砂布塞
    const vase = [[19, 12], [25, 12], [24.5, 18], [32, 26], [34, 37], [29, 47], [15, 47], [10, 37], [12, 26], [19.5, 18]];
    I.blob(vase, { c: I.linear([[0, P.paper], [1, P.paperDeep]], [0, 0, 1, 0]), stroke: P.ink0, w: 1.8 });
    I.line([[13, 30], [31, 30]], { w: 1.2, c: P.azurite, a: 0.85, amp: 0.2 });
    I.line([[12.5, 40], [31.5, 40]], { w: 1, c: P.azurite, a: 0.85, amp: 0.2 });
    I.line([[16, 35.5], [19, 32.5], [22, 35], [25, 32.5], [28, 35.5]], { w: 0.9, c: P.azurite, a: 0.85, amp: 0.2 });
    I.blob([[17, 12], [22, 6], [27, 12], [22, 14]], { c: P.cinnabar, stroke: P.ink0, w: 1 });
    I.line([[17.5, 13], [26.5, 13]], { w: 1, c: P.ink0, amp: 0.1 });
    I.brush([[26, 13], [29, 17], [28, 21]], 1.2, { c: P.cinnabar, head: 0.05, tail: 0.6 });
  } else {
    // 葫芦 + 红绳
    const gc = I.radial([[0, mix(P.gamboge, P.paper, 0.35)], [1, mix(P.ochre, P.ink0, 0.2)]], { cx: 0.35, cy: 0.35, r: 0.75 });
    I.add(`<circle cx="21" cy="37" r="11" fill="${gc}" stroke="${P.ink0}" stroke-width="1.8"/>`);
    I.add(`<circle cx="21" cy="21" r="7" fill="${gc}" stroke="${P.ink0}" stroke-width="1.8"/>`);
    I.line([[15.5, 27.5], [26.5, 27.5]], { w: 2, c: P.cinnabar, amp: 0.2 });
    I.brush([[25, 28], [29, 33], [27, 38]], 1.4, { c: P.cinnabar, head: 0.05, tail: 0.6 });
    I.brush([[21, 14.5], [22, 10], [26, 8]], 1.8, { c: P.ink1, head: 0.1, tail: 0.6 });
    I.add(`<ellipse cx="17" cy="33" rx="2.5" ry="1.5" fill="${P.paper}" fill-opacity=".6" transform="rotate(-35 17 33)"/>`);
  }
  // 品质光晕
  const halo = [0.14, 0.32, 0.42, 0.6][qq];
  I.glow(qq === 3 ? P.glowGold : withAlpha(qc, 1), 13 + qq * 3, halo, 42, 44);
  if (qq >= 2) I.line(circ(42, 44, 13 + qq, 20), { w: 0.7, c: qc, a: 0.7, closed: true, amp: 0.4 });
  // 丹丸
  const pillDraw = (x, y, r) => {
    I.add(`<circle cx="${x}" cy="${y}" r="${r}" fill="${I.radial([[0, mix(c, P.paper, 0.55)], [0.55, c], [1, mix(c, P.ink0, 0.4)]], { cx: 0.35, cy: 0.32, r: 0.75 })}"/>`);
    if (qq >= 1) I.line(circ(x, y, r * 0.55, 8, Math.PI * 0.9, Math.PI * 2.1), { w: 0.6, c: P.paper, a: 0.55, amp: 0.15 });
    if (qq >= 2) I.line(circ(x, y, r * 0.3, 6, Math.PI * 1.9, Math.PI * 3), { w: 0.5, c: P.paper, a: 0.55, amp: 0.1 });
    I.line(circ(x, y, r, 16), { w: 1.5, c: P.ink0, closed: true, amp: 0.25 });
    I.add(`<ellipse cx="${n1(x - r * 0.38)}" cy="${n1(y - r * 0.4)}" rx="${n1(r * 0.28)}" ry="${n1(r * 0.16)}" fill="${P.paper}" fill-opacity=".85" transform="rotate(-35 ${n1(x - r * 0.38)} ${n1(y - r * 0.4)})"/>`);
  };
  I.add(`<ellipse cx="40" cy="55" rx="13" ry="2.6" fill="${I.radial([[0, P.ink1, 0.4], [1, P.ink1, 0]])}"/>`);
  pillDraw(46, 44, 8.5);
  pillDraw(34, 49.5, 6);
  if (qq === 3) { I.spark(56, 30, 3.4); I.spark(30, 34, 2.2); I.spark(57, 54, 1.8); }
  return I.svg({ title: pill.name, ...opts });
}

// ---------------------------------------------------------------- 法宝：飞剑 / 法衣 / 符 / 玉佩 / 小鼎

const TREASURE_FORMS = [[/剑|刃/, 'sword'], [/衣|袍|甲/, 'robe'], [/符|箓/, 'talisman'], [/佩|玉|璧/, 'pendant'], [/鼎|炉/, 'cauldron']];
const MATERIAL = [[/青|翠/, P.malachite], [/霜|寒|冰|雪/, P.azurite], [/赤|炎|火/, mix(P.ochre, P.cinnabar, 0.45)], [/玄|墨|夜/, P.ink1], [/金/, P.gamboge], [/云/, P.azurite], [/木|雷/, P.ochre], [/玉|魂/, P.malachite]];

const TREASURE_DRAW = {
  sword(I, c) {
    // 剑光尾迹
    I.line([[8, 48], [20, 40], [30, 30]], { w: 2.2, c, a: 0.35, amp: 0.4 });
    I.line([[10, 56], [22, 46], [34, 34]], { w: 1.2, c, a: 0.3, amp: 0.4 });
    I.add('<g transform="rotate(45 32 32)">');
    I.add(`<path d="M32 3L35.2 9L35.2 40L28.8 40L28.8 9Z" fill="${I.linear([[0, P.paper], [0.5, mix(P.paper, c, 0.25)], [1, P.ink3]], [0, 0, 1, 0])}"/>`);
    I.line([[32, 6], [32, 39]], { w: 0.7, c: P.ink2, amp: 0.1 });
    I.line([[34.6, 10], [34.6, 39]], { w: 0.8, c, a: 0.9, amp: 0.1 });
    I.line([[32, 3], [35.2, 9], [35.2, 40], [28.8, 40], [28.8, 9], [32, 3]], { w: 1.6, c: P.ink0, amp: 0.2 });
    I.blob([[23, 41.5], [32, 39.5], [41, 41.5], [32, 44.5]], { c: P.ink1, stroke: P.ink0, w: 1 });
    I.add(`<circle cx="32" cy="42" r="1.5" fill="${c}"/>`);
    I.add(`<rect x="30.4" y="44" width="3.2" height="10" fill="${P.ink0}"/>`);
    for (const y of [46, 48.5, 51]) I.line([[30.4, y], [33.6, y + 1.2]], { w: 0.5, c: P.paper, a: 0.6, amp: 0 });
    I.add(`<circle cx="32" cy="56" r="2.2" fill="none" stroke="${P.ink0}" stroke-width="1.3"/>`);
    I.add('</g>');
    // 剑穗（朱砂）
    I.brush([[21.5, 50], [17, 54], [12, 53], [8, 58]], 2.4, { c: P.cinnabar, head: 0.05, tail: 0.7 });
    I.brush([[21.5, 50], [18, 56], [14, 61]], 1.6, { c: P.cinnabar, head: 0.05, tail: 0.7, a: 0.8 });
    I.spark(48, 10, 3, mix(c, P.paper, 0.3));
  },
  robe(I, c, t) {
    const dark = /玄|墨/.test(t.name);
    const cloth = dark ? P.ink1 : mix(c, P.paper, 0.45);
    const pts = [[32, 10], [44, 12], [58, 22], [58, 34], [50, 36], [46, 30], [47, 56], [17, 56], [18, 30], [14, 36], [6, 34], [6, 22], [20, 12]];
    I.add(`<path d="M${pts.map((p) => p.join(' ')).join('L')}Z" fill="${I.linear([[0, mix(cloth, P.paper, dark ? 0.1 : 0.2)], [1, mix(cloth, P.ink0, 0.2)]])}"/>`);
    if (dark) for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const x = 22 + col * 6.5 + (row % 2) * 3, y = 32 + row * 5.5;
      I.add(`<path d="M${x - 3} ${y}A3 3 0 0 0 ${x + 3} ${y}" fill="none" stroke="${P.paper}" stroke-opacity=".35" stroke-width=".7"/>`);
    }
    else for (const [x, y] of [[24, 42], [38, 48], [12, 26]]) I.line([[x, y], [x + 3, y - 3], [x + 6, y - 1], [x + 4, y + 1], [x + 2, y], [x + 4, y - 2], [x + 9, y - 1]], { w: 0.8, c: P.paper, a: 0.75, amp: 0.15 });
    I.line([[20, 12], [32, 30], [44, 12]], { w: 1.4, c: dark ? P.paper : P.ink0, a: dark ? 0.6 : 1, amp: 0.2 });
    I.line([[32, 30], [38, 22]], { w: 1, c: dark ? P.paper : P.ink0, a: 0.6, amp: 0.2 });
    I.add(`<rect x="18" y="31" width="28" height="4" fill="${dark ? mix(c, P.ink0, 0.2) : P.ink1}"/>`);
    I.blob([[30, 33], [32, 31], [34, 33], [32, 35]], { c: dark ? P.cinnabar : c });
    I.brush([[31, 35], [29, 42], [30, 47]], 1.5, { c: dark ? P.cinnabar : c, head: 0.05, tail: 0.6 });
    I.line([[6, 34], [14, 36]], { w: 2.4, c: P.ink0, amp: 0.2 });
    I.line([[50, 36], [58, 34]], { w: 2.4, c: P.ink0, amp: 0.2 });
    I.line([...pts, pts[0]], { w: 2.2, c: P.ink0, amp: 0.4 });
  },
  talisman(I, c, t) {
    const wood = /木/.test(t.name);
    const thunder = /雷/.test(t.name);
    I.add(`<g transform="rotate(${n1(8 + I.j(3))} 32 32)">`);
    const bg = wood ? I.linear([[0, mix(P.ochre, P.paper, 0.25)], [1, mix(P.ochre, P.ink0, 0.15)]], [0, 0, 1, 0]) : mix(P.gamboge, P.paper, 0.15);
    I.line(rectPts(22, 8, 20, 48), { w: 2, c: P.ink0, fill: bg, amp: 0.35 });
    if (wood) for (const x of [26, 33, 38]) I.line([[x, 10], [x + I.j(1.2), 30], [x + I.j(1.2), 54]], { w: 0.6, c: P.ink0, a: 0.35, amp: 0.3 });
    I.brush([[32, 12], [32, 18]], 2.4, { c: P.cinnabar, head: 0.1, tail: 0.4 });
    I.brush([[26, 18], [38, 18]], 2, { c: P.cinnabar, head: 0.1, tail: 0.4 });
    I.brush([[27, 23], [37, 24], [28, 30], [37, 31], [29, 38], [36, 40]], 1.8, { c: P.cinnabar, head: 0.05, tail: 0.4 });
    I.brush([[32, 40], [31, 46], [33, 52]], 2, { c: P.cinnabar, head: 0.1, tail: 0.6 });
    I.add(`<circle cx="32" cy="10.5" r="1.2" fill="${P.ink0}"/>`);
    I.add('</g>');
    I.brush([[31.5, 9], [28, 4], [22, 3]], 1.4, { c: P.cinnabar, head: 0.05, tail: 0.6 });
    if (thunder) {
      I.glow(P.glowGold, 12, 0.5, 51, 20);
      I.line([[54, 6], [47, 17], [53, 18], [46, 30]], { w: 2, c: P.gamboge, amp: 0.2 });
      I.line([[54, 6], [47, 17], [53, 18], [46, 30]], { w: 0.7, c: P.paper, amp: 0.2 });
    }
    void c;
  },
  pendant(I, c) {
    I.brush([[32, 3], [31, 12], [32, 21]], 1.6, { c: P.cinnabar, head: 0.05, tail: 0.1, taper: 0.3 });
    I.blob([[29, 13], [32, 10.5], [35, 13], [32, 15.5]], { c: P.cinnabar, stroke: P.ink0, w: 0.8 });
    const jade = mix(c, P.paper, 0.4);
    I.add(`<path d="M32 21A16 16 0 1 1 31.99 21ZM32 32A5 5 0 1 0 32.01 32Z" fill-rule="evenodd" transform="translate(0 0)" fill="${I.radial([[0, mix(jade, P.paper, 0.5)], [0.7, jade], [1, mix(c, P.ink0, 0.2)]], { cx: 0.38, cy: 0.35, r: 0.7 })}"/>`);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3, x = 32 + Math.cos(a) * 10.5, y = 37 + Math.sin(a) * 10.5; I.line([[x - 1.5, y], [x, y - 1.5], [x + 1.5, y], [x, y + 1]], { w: 0.6, c: P.ink0, a: 0.35, amp: 0.1 }); }
    I.line(circ(32, 37, 16, 22), { w: 2, c: P.ink0, closed: true, amp: 0.35 });
    I.line(circ(32, 37, 5, 10), { w: 1.4, c: P.ink0, closed: true, amp: 0.2 });
    I.add(`<path d="M22 30Q26 25 31 25" fill="none" stroke="${P.paper}" stroke-opacity=".8" stroke-width="1.4" stroke-linecap="round"/>`);
    I.brush([[32, 53], [31, 58], [30, 63]], 2, { c: P.cinnabar, head: 0.05, tail: 0.8 });
    I.brush([[33, 53], [35, 58], [37, 62]], 1.5, { c: P.cinnabar, head: 0.05, tail: 0.8, a: 0.8 });
  },
  cauldron(I, c) {
    const bronze = c;
    I.line([[26, 12], [24, 7], [28, 3]], { w: 1.2, c: P.ink3, amp: 0.4 });
    I.line([[36, 12], [38, 6], [35, 2]], { w: 1, c: P.ink3, amp: 0.4 });
    I.brush([[20, 44], [15, 56]], 3.5, { c: P.ink0, head: 0.05, tail: 0.3, taper: 0.5 });
    I.brush([[44, 44], [49, 56]], 3.5, { c: P.ink0, head: 0.05, tail: 0.3, taper: 0.5 });
    I.brush([[32, 47], [32, 58]], 3.5, { c: P.ink1, head: 0.05, tail: 0.3, taper: 0.5 });
    I.line(rectPts(17, 10, 5, 9), { w: 1.6, c: P.ink0, amp: 0.2 });
    I.line(rectPts(42, 10, 5, 9), { w: 1.6, c: P.ink0, amp: 0.2 });
    I.add(`<path d="M12 20Q12 48 32 48Q52 48 52 20Z" fill="${I.radial([[0, mix(bronze, P.paper, 0.35)], [0.7, bronze], [1, mix(bronze, P.ink0, 0.35)]], { cx: 0.35, cy: 0.3, r: 0.8 })}" stroke="${P.ink0}" stroke-width="2" stroke-linejoin="round"/>`);
    I.add(`<ellipse cx="32" cy="20" rx="20" ry="4" fill="${mix(bronze, P.ink0, 0.45)}" stroke="${P.ink0}" stroke-width="1.6"/>`);
    I.line([[15, 30], [49, 30]], { w: 0.8, c: P.paper, a: 0.5, amp: 0.2 });
    I.line([[17, 36], [21, 33], [25, 36], [29, 33], [33, 36], [37, 33], [41, 36], [45, 33], [48, 35]], { w: 0.8, c: P.paper, a: 0.5, amp: 0.15 });
    I.glow(P.glowRed, 9, 0.7, 32, 58);
    I.brush([[29, 61], [30, 56], [32, 53]], 2.4, { c: P.cinnabar, head: 0.1, tail: 0.7 });
    I.brush([[35, 61], [34.5, 57], [36, 54]], 1.8, { c: P.gamboge, head: 0.1, tail: 0.7 });
  },
};

export function treasureIcon(t, opts = {}) {
  if (!t) return unknownIcon(opts);
  const I = new Icon(t.id || t.name);
  const rar = t.rarity || 1;
  const slotFallback = t.slot === 'weapon' ? ['sword'] : t.slot === 'armor' ? ['robe'] : ['talisman', 'pendant', 'cauldron'];
  const form = pickForm({ ...t, desc: '' }, TREASURE_FORMS, slotFallback);
  let c = rarityColor(rar);
  for (const [re, col] of MATERIAL) if (re.test(t.name || '')) { c = col; break; }
  I.wash();
  if (rar >= 4) I.glow(P.glowGold, 31, 0.9);
  else if (rar >= 2) I.glow(rarityColor(rar), 29, rar === 3 ? 0.28 : 0.16);
  TREASURE_DRAW[form](I, c, t);
  return I.svg({ title: t.name, ...opts });
}

// ---------------------------------------------------------------- 灵根：五行圆印

export function rootIcon(el, opts = {}) {
  const I = new Icon(`root:${el}`);
  const c = elColor(el);
  const name = ELEMENT_NAMES[el] || '?';
  I.add(`<circle cx="32" cy="32" r="25" fill="${I.radial([[0, mix(c, P.paper, 0.72)], [0.75, mix(c, P.paper, 0.45)], [1, mix(c, P.paper, 0.2)]], { cx: 0.45, cy: 0.4, r: 0.6 })}"/>`);
  // 一笔圆相：起笔重、收笔留口
  const a0 = -2.2 + I.j(0.3);
  const ring = circ(32, 32, 25.5, 28, a0, a0 + Math.PI * 1.86);
  I.brush(ring, 4.6, { c: P.ink0, head: 0.06, tail: 0.3, taper: 0.75, wobble: 0.4 });
  I.line(circ(32, 32, 20.5, 24), { w: 0.7, c: mix(c, P.ink0, 0.3), a: 0.5, closed: true, amp: 0.3 });
  I.text(esc(name), 32, 33.5, 25, mix(c, P.ink0, 0.5), ' font-weight="bold"');
  return I.svg({ title: `${name}灵根`, ...opts });
}

// ---------------------------------------------------------------- 敌人头像：复用剪影

export function enemyPortrait(enemy, opts = {}) {
  if (!enemy) return unknownIcon(opts);
  const I = new Icon(`portrait:${enemy.id || enemy.name}`);
  const sil = enemySilhouette(enemy);
  const c = sil.accent;
  const clip = uid('cp');
  I.def(`<clipPath id="${clip}"><circle cx="32" cy="32" r="28.5"/></clipPath>`);
  I.add(`<circle cx="32" cy="32" r="28.5" fill="${I.radial([[0, P.paper], [0.65, P.paperDeep], [1, mix(c, P.paperDeep, 0.55)]], { cx: 0.5, cy: 0.42, r: 0.62 })}"/>`);
  I.add(`<ellipse cx="32" cy="56" rx="26" ry="9" fill="${I.radial([[0, c, 0.35], [1, c, 0]])}" clip-path="url(#${clip})"/>`);
  const tall = sil.archetype === 'humanoid' || sil.archetype === 'puppet' || sil.archetype === 'wraith';
  const inner = silhouetteSVG(sil.archetype, { ...sil, crop: tall ? 'bust' : 'fit', size: 56, ink: P.ink0, className: 'sil' })
    .replace('<svg ', '<svg x="4" y="5" ');
  I.add(`<g clip-path="url(#${clip})">${inner}</g>`);
  if (enemy.boss) {
    I.line(circ(32, 32, 29.5, 24), { w: 2.6, c: P.cinnabar, closed: true, amp: 0.35 });
    I.line(circ(32, 32, 26.6, 24), { w: 0.8, c: P.cinnabar, closed: true, amp: 0.25, a: 0.8 });
    I.add(`<g transform="rotate(-8 52 52)"><rect x="45" y="45" width="14" height="14" rx="1.5" fill="${P.cinnabar}" stroke="${P.paper}" stroke-width="1"/></g>`);
    I.text('首', 52, 52.5, 10, P.paper, ' font-weight="bold"');
  } else {
    I.line(circ(32, 32, 29, 24), { w: 2, c: P.ink0, closed: true, amp: 0.4 });
  }
  return I.svg({ title: enemy.name, ...opts });
}

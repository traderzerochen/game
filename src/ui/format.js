// 数字、时间、原因文案格式化
import { YEAR_SECONDS } from '../core/constants.js';

export function fmtNum(n) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e8) return (n / 1e8).toFixed(a >= 1e9 ? 1 : 2).replace(/\.0+$/, '') + '亿';
  if (a >= 1e4) return (n / 1e4).toFixed(a >= 1e5 ? 1 : 2).replace(/\.0+$/, '') + '万';
  if (a >= 100) return String(Math.round(n));
  if (a >= 10) return n.toFixed(1).replace(/\.0$/, '');
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
}

export function fmtInt(n) {
  return Number.isFinite(n) ? Math.floor(n).toLocaleString('zh-CN') : '—';
}

export function fmtPct(r, digits = 0) {
  return Number.isFinite(r) ? `${(r * 100).toFixed(digits)}%` : '—';
}

/** 现实秒数 → 「x 小时 y 分」 */
export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  if (hh) return `${hh} 小时 ${mm} 分`;
  if (mm) return `${mm} 分 ${ss} 秒`;
  return `${ss} 秒`;
}

/** 短倒计时 「1:05」 */
export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** 游戏时间（秒）→「x 年 y 月」 */
export function fmtGameTime(sec) {
  const y = Math.floor(sec / YEAR_SECONDS);
  const m = Math.floor(((sec % YEAR_SECONDS) / YEAR_SECONDS) * 12);
  return y ? `${y} 年 ${m} 月` : `${m} 月`;
}

export const REASONS = {
  not_enough_qi: '灵气不足',
  not_enough_stones: '灵石不足',
  missing_herbs: '药材不足',
  realm_too_low: '境界不足',
  cooldown: '秘境尚在恢复',
  ended: '此世已了',
  need_tribulation: '大境界关口，须渡雷劫',
  not_owned: '尚未拥有',
  max_level: '已达当前上限',
  invalid: '无法如此行事',
};

export function reasonText(r) {
  if (!r) return '';
  return REASONS[r] || String(r);
}

/** 文本模板 {key} 替换 */
export function tpl(str, vars) {
  return String(str ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));
}

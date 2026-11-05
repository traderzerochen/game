// 设置：localStorage['minglan_settings']（DECISIONS D11）
export const SETTINGS_KEY = 'minglan_settings';

const DEFAULTS = { quality: 'mid', autoQuality: true, volume: 0.6, muted: false, replaySpeed: 1 };

export function loadSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(SETTINGS_KEY);
    const s = raw ? JSON.parse(raw) : {};
    const out = { ...DEFAULTS, ...s };
    if (!['low', 'mid', 'high'].includes(out.quality)) out.quality = 'mid';
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  try {
    storage && storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* 存储不可用时忽略 */ }
}

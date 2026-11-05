// 数据索引：按 id 查找
const LISTS = ['realms', 'techniques', 'herbs', 'pills', 'recipes', 'treasures', 'enemies', 'events', 'dungeons', 'endings'];

export function buildIndex(DATA) {
  const byId = {};
  for (const k of LISTS) {
    byId[k] = new Map((DATA[k] || []).map((x) => [x.id, x]));
  }
  const realms = DATA.realms || [];
  return {
    ...DATA,
    byId,
    realm(stage) {
      const s = Number.isFinite(stage) ? Math.max(0, Math.min(realms.length - 1, Math.floor(stage))) : 0;
      return realms[s];
    },
  };
}

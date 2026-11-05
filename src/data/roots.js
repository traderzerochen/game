// 灵根 —— DESIGN.md §3.1
export const roots = {
  tiers: {
    1: { name: '天灵根', mult: 2.0, weight: 8 },
    2: { name: '双灵根', mult: 1.6, weight: 22 },
    3: { name: '三灵根', mult: 1.3, weight: 35 },
    4: { name: '四灵根', mult: 1.1, weight: 22 },
    5: { name: '伪灵根', mult: 1.0, weight: 13 },
  },
  elementNames: { metal: '金', wood: '木', water: '水', fire: '火', earth: '土', none: '无' },
  overcomes: { metal: 'wood', wood: 'earth', earth: 'water', water: 'fire', fire: 'metal' },
  generates: { metal: 'water', water: 'wood', wood: 'fire', fire: 'earth', earth: 'metal' },
};

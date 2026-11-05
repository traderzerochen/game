// 敌人 —— 阶段 1 最小集，content 扩展至 ≥8。
// 数值参考：普通敌人 ≈ 对应 stage 的 realm.baseStats × 0.7–0.9；首领 hp ×1.5。
export const enemies = [
  { id: 'wu_lang', name: '雾狼', element: 'wood', tier: 0, art: 'wolf',
    stats: { hp: 90, mp: 20, atk: 11, def: 5, spd: 12, crit: 0.05 },
    skills: [{ name: '扑咬', kind: 'damage', power: 1.3, mpCost: 8 }],
    drops: { stones: [3, 8], herbs: [{ herbId: 'qingsui_gen', chance: 0.4, count: [1, 1] }] } },
  { id: 'yanjia_zhu', name: '岩甲蛛', element: 'earth', tier: 0, art: 'spider',
    stats: { hp: 110, mp: 20, atk: 9, def: 9, spd: 8, crit: 0.03 },
    skills: [{ name: '吐丝', kind: 'damage', power: 1.2, mpCost: 6 }],
    drops: { stones: [4, 9], herbs: [{ herbId: 'shitai_ru', chance: 0.4, count: [1, 1] }] } },
  { id: 'shanfei', name: '剪径散修', element: 'metal', tier: 0, art: 'humanoid',
    stats: { hp: 100, mp: 30, atk: 12, def: 7, spd: 11, crit: 0.06 },
    skills: [{ name: '劈山刀', kind: 'damage', power: 1.4, mpCost: 10 }],
    drops: { stones: [8, 16], herbs: [{ herbId: 'chiwen_zhi', chance: 0.3, count: [1, 1] }] } },
  { id: 'kumu_kui', name: '枯木傀', element: 'wood', tier: 1, boss: true, art: 'puppet',
    stats: { hp: 260, mp: 50, atk: 18, def: 10, spd: 9, crit: 0.05 },
    skills: [{ name: '枯藤鞭', kind: 'damage', power: 1.5, mpCost: 12 }, { name: '木甲', kind: 'shield', power: 0.6, mpCost: 15 }],
    drops: { stones: [20, 40], herbs: [{ herbId: 'qingsui_gen', chance: 0.8, count: [1, 2] }], treasures: [{ treasureId: 'qingmang_jian', chance: 0.15 }] } },
];

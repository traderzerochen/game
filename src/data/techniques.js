// 功法 —— 阶段 1 最小集（lead 骨架），content 扩展至 ≥10。字段见 DESIGN.md §4。
export const techniques = [
  { id: 'guixi_yinqi', name: '归息引气篇', type: 'heart', element: 'none', rarity: 1, realmReq: 0, price: 0, maxLevel: 10, upgradeCost: 30,
    desc: '闻钟子所遗残篇，教人随潮汐呼吸，引岚气入体。', effect: { qiRate: 0.2, qiRatePerLv: 0.05 } },
  { id: 'fuchen_zhang', name: '拂尘掌', type: 'skill', element: 'none', rarity: 1, realmReq: 0, price: 0, maxLevel: 10, upgradeCost: 25,
    desc: '掌风如拂尘，聊胜于赤手。', effect: { kind: 'damage', power: 1.3, powerPerLv: 0.08, mpCost: 8 } },
  { id: 'duanhong_jian', name: '断鸿剑意', type: 'skill', element: 'metal', rarity: 2, realmReq: 0, price: 120, maxLevel: 10, upgradeCost: 40,
    desc: '一剑既出，如孤鸿断影。', effect: { kind: 'damage', power: 1.8, powerPerLv: 0.1, mpCost: 15 } },
];

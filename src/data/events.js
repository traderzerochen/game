// 秘境事件 —— 阶段 1 最小集。效果类型见 DESIGN.md §3.12。
export const events = [
  { id: 'ev_wolf_pack', type: 'battle', name: '雾中狼嚎', text: '浓雾里亮起两点幽绿，一头雾狼低伏而来。', effects: [{ type: 'battle', enemyId: 'wu_lang' }] },
  { id: 'ev_spider_nest', type: 'battle', name: '蛛网横路', text: '石隙间垂下灰白蛛丝，岩甲蛛缓缓爬出。', effects: [{ type: 'battle', enemyId: 'yanjia_zhu' }] },
  { id: 'ev_dew_meadow', type: 'gather', name: '露草坡', text: '一片缓坡上凝露草成片，露珠映着微光。', effects: [{ type: 'herb', pool: ['ninglu_cao', 'qingsui_gen'], count: [1, 3] }] },
  { id: 'ev_old_cairn', type: 'fortune', name: '无名石冢', text: '石冢下压着前人遗落的灵石袋。', effects: [{ type: 'stones', min: 10, max: 25 }] },
  { id: 'ev_rockfall', type: 'trap', name: '落石', text: '头顶碎石簌簌，你及时闪身避过。', textFail: '躲闪不及，被落石擦伤。',
    check: { stat: 'spd', difficulty: 10 }, effects: [], failEffects: [{ type: 'hp', ratio: -0.15 }] },
];

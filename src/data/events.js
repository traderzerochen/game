// 秘境事件 —— 阶段 1 最小集。效果类型见 DESIGN.md §3.12。
export const events = [
  { id: 'ev_wolf_pack', type: 'battle', name: '雾中狼嚎', text: '浓雾里亮起两点幽绿，一头雾狼低伏而来。', effects: [{ type: 'battle', enemyId: 'wu_lang' }] },
  { id: 'ev_spider_nest', type: 'battle', name: '蛛网横路', text: '石隙间垂下灰白蛛丝，岩甲蛛缓缓爬出。', effects: [{ type: 'battle', enemyId: 'yanjia_zhu' }] },
  { id: 'ev_dew_meadow', type: 'gather', name: '露草坡', text: '一片缓坡上凝露草成片，露珠映着微光。', effects: [{ type: 'herb', pool: ['ninglu_cao', 'qingsui_gen'], count: [1, 3] }] },
  { id: 'ev_old_cairn', type: 'fortune', name: '无名石冢', text: '石冢下压着前人遗落的灵石袋。', effects: [{ type: 'stones', min: 10, max: 25 }] },
  { id: 'ev_rockfall', type: 'trap', name: '落石', text: '头顶碎石簌簌，你及时闪身避过。', textFail: '躲闪不及，被落石擦伤。',
    check: { stat: 'spd', difficulty: 10 }, effects: [], failEffects: [{ type: 'hp', ratio: -0.15 }] },
  { id: 'ev_bandit', type: 'battle', name: '林间拦路', text: '松影里跃出一人，横刀喝道：「留下灵石！」', effects: [{ type: 'battle', enemyId: 'shanfei' }] },
  { id: 'ev_pitfall', type: 'trap', name: '藤下陷坑', text: '枯藤覆着暗坑，你足尖一点，掠了过去。', textFail: '脚下一空，跌入浅坑，浑身泥泞。',
    check: { stat: 'spd', difficulty: 9 }, effects: [], failEffects: [{ type: 'hp', ratio: -0.12 }] },
  { id: 'ev_poison_mist', type: 'trap', name: '瘴雾', text: '黄雾贴地漫来，你屏息运气，从容穿过。', textFail: '吸入瘴雾，头晕目眩，胸口发闷。',
    check: { stat: 'def', difficulty: 7 }, effects: [{ type: 'qi', ratio: 0.01 }], failEffects: [{ type: 'hp', ratio: -0.1 }] },
  { id: 'ev_spring_rest', type: 'fortune', name: '石隙清泉', text: '岩缝泉水叮咚，饮之神清气爽，伤势渐愈。', effects: [{ type: 'hp', ratio: 0.3 }, { type: 'qi', ratio: 0.04 }] },
  { id: 'ev_hermit_cave', type: 'fortune', name: '残洞遗物', text: '塌了半边的石洞里，有散修遗下的丹瓶与残卷。',
    effects: [{ type: 'pill', pillId: 'juling_dan', quality: 0, count: 1 }, { type: 'stones', min: 6, max: 14 }, { type: 'technique', techniqueId: 'duanhong_jian', chance: 0.1 }] },
  { id: 'ev_moss_stone', type: 'gather', name: '苔石坡', text: '青苔覆石，缝间生着几株赤纹芝，伞面微红。', effects: [{ type: 'herb', pool: ['chiwen_zhi', 'shitai_ru'], count: [1, 2] }] },
];

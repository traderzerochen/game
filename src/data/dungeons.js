// 秘境 —— 阶段 1 最小集，content 扩展至 ≥5。
export const dungeons = [
  { id: 'wuqi_gu', name: '雾栖谷', realmReq: 0, steps: 5, cooldown: 90, scene: 'mist_valley',
    desc: '潮生村后山的深谷，常年雾气不散，多有低阶妖兽。',
    eventPool: [
      { eventId: 'ev_wolf_pack', weight: 3 }, { eventId: 'ev_spider_nest', weight: 2 },
      { eventId: 'ev_dew_meadow', weight: 3 }, { eventId: 'ev_old_cairn', weight: 2 }, { eventId: 'ev_rockfall', weight: 2 },
    ],
    enemyPool: ['wu_lang', 'yanjia_zhu'], boss: 'kumu_kui',
    clearReward: { stones: [15, 30], herbs: [{ herbId: 'chiwen_zhi', count: 1 }] } },
];

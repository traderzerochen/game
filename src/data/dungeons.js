// 秘境 —— 阶段 1 最小集，content 扩展至 ≥5。
export const dungeons = [
  { id: 'wuqi_gu', name: '雾栖谷', realmReq: 0, steps: 5, cooldown: 90, scene: 'mist_valley',
    desc: '潮生村后山的深谷，常年雾气不散，多有低阶妖兽。',
    eventPool: [
      { eventId: 'ev_wolf_pack', weight: 2 }, { eventId: 'ev_spider_nest', weight: 2 }, { eventId: 'ev_bandit', weight: 1 },
      { eventId: 'ev_dew_meadow', weight: 3 }, { eventId: 'ev_moss_stone', weight: 2 },
      { eventId: 'ev_old_cairn', weight: 2 }, { eventId: 'ev_spring_rest', weight: 2 }, { eventId: 'ev_hermit_cave', weight: 2 },
      { eventId: 'ev_rockfall', weight: 2 }, { eventId: 'ev_pitfall', weight: 2 }, { eventId: 'ev_poison_mist', weight: 1 },
    ],
    enemyPool: ['wu_lang', 'yanjia_zhu', 'shanfei'], boss: 'kumu_kui',
    clearReward: { stones: [15, 30], herbs: [{ herbId: 'chiwen_zhi', count: 1 }] } },
  { id: 'hanyi_dong', name: '寒漪古洞', realmReq: 2, steps: 5, cooldown: 120, scene: 'cold_cave',
    desc: '山腹中的冰窟，水滴成漪，千年不冻，寒蝠与冷血蛇栖于其间。',
    eventPool: [
      { eventId: 'ev_bat_swarm', weight: 2 }, { eventId: 'ev_snake_ledge', weight: 2 }, { eventId: 'ev_frost_lan', weight: 3 }, { eventId: 'ev_snow_stamen', weight: 1 }, { eventId: 'ev_ice_slip', weight: 2 }, { eventId: 'ev_cold_draught', weight: 2 }, { eventId: 'ev_cave_spring', weight: 2 }, { eventId: 'ev_frozen_bones', weight: 2 }, { eventId: 'ev_ice_inscription', weight: 1 },
    ],
    enemyPool: ['hanya_bianfu', 'xueban_she'], boss: 'bingpo_chan',
    clearReward: { stones: [60, 100], herbs: [{ herbId: 'shuangxin_lan', count: 2 }], treasure: { treasureId: 'shuanghen_jian', chance: 0.1 } } },
  { id: 'chenzhong_dian', name: '沉钟古殿', realmReq: 3, steps: 5, cooldown: 150, scene: 'bell_hall',
    desc: '荒山深处的古殿，钟楼塌半，铜钟无风自鸣，殿中机关与石卫尚在。',
    eventPool: [
      { eventId: 'ev_stone_guard', weight: 2 }, { eventId: 'ev_sword_puppet', weight: 2 }, { eventId: 'ev_bell_echo', weight: 2 }, { eventId: 'ev_floor_array', weight: 2 }, { eventId: 'ev_moss_bell', weight: 2 }, { eventId: 'ev_hall_garden', weight: 3 }, { eventId: 'ev_altar_offering', weight: 2 }, { eventId: 'ev_sutra_stand', weight: 2 }, { eventId: 'ev_cracked_bell', weight: 2 },
    ],
    enemyPool: ['shi_wei', 'zhonglou_jiankui', 'shanfei'], boss: 'duodao_xiu',
    clearReward: { stones: [120, 200], herbs: [{ herbId: 'longlin_tai', count: 1 }], treasure: { treasureId: 'xuanjia_fayi', chance: 0.1 } } },
  { id: 'chisha_xia', name: '赤砂火峡', realmReq: 5, steps: 5, cooldown: 180, scene: 'red_gorge',
    desc: '两崖赤砂如火，地脉裂隙中热气蒸腾，焚羽鸦盘旋不去。',
    eventPool: [
      { eventId: 'ev_crow_dive', weight: 2 }, { eventId: 'ev_sand_scorpion', weight: 2 }, { eventId: 'ev_lava_vent', weight: 2 }, { eventId: 'ev_heat_haze', weight: 2 }, { eventId: 'ev_sandslide', weight: 1 }, { eventId: 'ev_fire_fungus', weight: 3 }, { eventId: 'ev_ember_stone', weight: 2 }, { eventId: 'ev_scorched_chest', weight: 2 }, { eventId: 'ev_hot_spring', weight: 2 }, { eventId: 'ev_stone_tablet', weight: 1 },
    ],
    enemyPool: ['huo_ya', 'chisha_xie'], boss: 'yanlin_shou',
    clearReward: { stones: [250, 400], herbs: [{ herbId: 'xingxie_cao', count: 1 }, { herbId: 'zijing_guo', count: 2 }], treasure: { treasureId: 'zhenhun_yupei', chance: 0.1 } } },
  { id: 'chengquan_jing', name: '澄泉秘境', realmReq: 6, steps: 5, cooldown: 240, scene: 'clear_spring',
    desc: '群山环抱的一处灵泉，水清见底，雾气里藏着古兽与缠藤。',
    eventPool: [
      { eventId: 'ev_vine_ambush', weight: 2 }, { eventId: 'ev_turtle', weight: 2 }, { eventId: 'ev_whirlpool', weight: 2 }, { eventId: 'ev_root_snare', weight: 2 }, { eventId: 'ev_spirit_fog', weight: 1 }, { eventId: 'ev_spring_herbs', weight: 3 }, { eventId: 'ev_dream_fungus', weight: 1 }, { eventId: 'ev_spring_blessing', weight: 2 }, { eventId: 'ev_drowned_cache', weight: 2 }, { eventId: 'ev_sunken_scroll', weight: 1 },
    ],
    enemyPool: ['teng_yao', 'qingtan_yuan'], boss: 'yuandi_gushou',
    clearReward: { stones: [500, 800], herbs: [{ herbId: 'xuerui_lian', count: 2 }, { herbId: 'mengxun', count: 1 }], treasure: { treasureId: 'chitong_ding', chance: 0.1 } } },
];

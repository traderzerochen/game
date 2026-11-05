// 法宝 —— 7 件，名称见 LORE.md §9。
export const treasures = [
  { id: 'qingmang_jian', name: '青芒剑', slot: 'weapon', rarity: 1, realmReq: 0, price: 150,
    stats: { flat: { atk: 6 }, pct: {} }, desc: '寻常铁精所铸，剑身泛青芒。' },
  { id: 'yunwen_fayi', name: '云纹法衣', slot: 'armor', rarity: 1, realmReq: 0, price: 200,
    stats: { flat: { def: 5, hp: 40 }, pct: {} }, desc: '素布织云纹，轻软如雾，可挡寻常刀兵。' },
  { id: 'yinlei_mufu', name: '引雷木符', slot: 'charm', rarity: 2, realmReq: 2, price: 800,
    stats: { flat: {}, pct: {} }, tribResist: 0.12, desc: '雷击枯木所制，天雷临身时先引其锋。' },
  { id: 'chitong_ding', name: '赤铜小鼎', slot: 'charm', rarity: 2, realmReq: 2, price: 900,
    stats: { flat: {}, pct: {} }, alchemyBonus: 0.06, desc: '掌心大小的赤铜鼎，炉火不熄，丹成更稳。' },
  { id: 'shuanghen_jian', name: '霜痕飞剑', slot: 'weapon', rarity: 3, realmReq: 3, price: 1500,
    stats: { flat: { atk: 26 }, pct: { crit: 0.02 } }, desc: '剑过处留一线霜痕，久久不散。' },
  { id: 'xuanjia_fayi', name: '玄甲法衣', slot: 'armor', rarity: 3, realmReq: 4, price: 2000,
    stats: { flat: { def: 22, hp: 200 }, pct: {} }, desc: '玄色鳞甲暗纹如夜，刀剑加身，唯闻轻响。' },
  { id: 'zhenhun_yupei', name: '镇魂玉佩', slot: 'charm', rarity: 3, realmReq: 5, price: 2500,
    stats: { flat: { hp: 100 }, pct: {} }, protect: 0.5, desc: '温玉一枚，劫火焚身时护住最后一缕神魂。' },
];

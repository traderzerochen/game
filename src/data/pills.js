// 丹药 —— 8 种，名称见 LORE.md §6。效果类型见 DESIGN.md §3.10。
export const pills = [
  { id: 'juling_dan', name: '聚灵丹', realmReq: 0, effect: { type: 'qi', value: 0.15 }, desc: '服之灵气涌入经脉。' },
  { id: 'peiyuan_dan', name: '培元丹', realmReq: 0, effect: { type: 'qiRate', value: 0.4, duration: 900 }, desc: '药力绵长，一刻钟内吐纳倍觉顺畅。' },
  { id: 'pozhang_dan', name: '破障丹', realmReq: 0, effect: { type: 'breakthrough', value: 0.12 }, desc: '冲关前服下，瓶颈如薄冰将裂。' },
  { id: 'humai_dan', name: '护脉丹', realmReq: 2, effect: { type: 'tribulation', value: 0.12 }, desc: '护住心脉，雷霆加身亦不伤根本。' },
  { id: 'huichun_dan', name: '回春丹', realmReq: 0, effect: { type: 'heal', value: 0.35 }, desc: '危急时服下，可回复伤势。' },
  { id: 'ningshen_dan', name: '凝神丹', realmReq: 0, effect: { type: 'mp', value: 0.4 }, desc: '清心凝神，枯竭的灵力重新涌起。' },
  { id: 'zhuji_dan', name: '固基丹', realmReq: 3, effect: { type: 'tribulation', value: 0.2 }, desc: '药性沉厚，固道基于雷火之前。' },
  { id: 'yanshou_dan', name: '延寿丹', realmReq: 6, effect: { type: 'lifespan', value: 30 }, desc: '夺天地一线生机，延寿三十载。' },
];

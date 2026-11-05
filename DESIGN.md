# DESIGN.md — 《溟岚问道》设计文档

> 单机网页版修仙放置养成游戏。Vite + 原生 JS，运行时无依赖，存档用 localStorage。
> 用词以 LORE.md 为准，美术规范以 ART_GUIDE.md 为准，裁决记录在 DECISIONS.md。
> 接口有变动时：先 SendMessage 通知相关队友，再更新本文件，并在 §11 变更记录追加一行。

---

## 0. 目录与文件归属

| 路径 | 负责人 | 说明 |
|---|---|---|
| `DESIGN.md` `ART_GUIDE.md` `LORE.md` `DECISIONS.md` `README.md` `CREDITS.md` | lead | 文档 |
| `package.json` `vite.config.js` `.gitignore` | lead | 构建配置 |
| `tests/simulation/` | lead | 整体模拟测试 |
| `src/core/` `src/combat/` `src/save/` `tests/engine/` | engine | 逻辑引擎 |
| `src/data/` `tests/data/` | content | 游戏数据与文本 |
| `src/ui/` `src/art/`（除下两行） `assets/` `styles/` `index.html` | ui-art | 界面、场景、特效、集成 |
| `src/art/silhouette.js` `src/art/icons.js` | art-assets | 剪影与图标生成器（阶段 2 新增队友） |
| `src/audio/` | audio | WebAudio 合成音效（阶段 2 新增队友） |

规则：
- 每人只改自己的目录。可以 **读** 别人的文件，**不能改**。
- 需要别人改东西，就 SendMessage 给负责人。
- 依赖方向：`ui → core/combat/save → data`。core 不得引用 ui、art、audio，也不得访问 DOM 和 `window`。data 只能是纯数据（可以有少量纯函数），不得引用 core。
- 所有逻辑代码必须能在 Node 22 中直接 `import`。测试用 `node --test`，不引入测试框架。
- 提交由 lead 统一执行。队友不要执行 `git commit` 或 `git push`，避免多个 agent 同时操作 git 索引产生冲突。

---

## 1. 核心循环

```
修炼（自动积累灵气） → 灵气满 → 破关（小境界）/ 渡劫（大境界）
       ↑                                        ↓
  丹药加速 ← 炼丹 ← 药材 ← 历练秘境（战斗/奇遇/陷阱） → 灵石 → 购买/升级功法
                                                 ↓
                               化神后期渡登穹雷劫 → 飞升；寿元耗尽 → 坐化 → 转世
```

时间模型：
- 所有游戏内计时都用 `state.time.played`（累计游戏秒数）。
- 现实时间只用于离线收益，记在 `state.time.lastSeen`（毫秒时间戳）。
- `game.advance(sec)` 是推进时间的唯一入口。UI 每帧调用 `game.tick(nowMs)`，内部换算成 `advance`。模拟测试直接调用 `advance`。

---

## 2. 常量（`src/core/constants.js`，engine 维护）

```js
YEAR_SECONDS = 3600          // 1 游戏年 = 3600 游戏秒
START_AGE = 16
OFFLINE_CAP_SEC = 8 * 3600   // 离线收益上限 8 小时
OFFLINE_EFFICIENCY = 0.8     // 离线时灵气效率
QI_CAP_MULT = 2              // 灵气上限 = 2 × 当前境界的 qiCost
MAX_SKILL_SLOTS = 4
MAX_BATTLE_ROUNDS = 30
MAX_PILLS_PER_BATTLE = 3
CRIT_MULT = 1.5
CRIT_CAP = 0.75
GARDEN_INTERVAL = 300        // 药园每 300 秒产出 1 株
GARDEN_CAP = 24
INJURY_QI_MULT = 0.5
QUALITY_MULT = [1, 1.25, 1.5, 2]   // 丹药品质 下/中/上/极
ELEMENTS = ['metal','wood','water','fire','earth']
```

---

## 3. 数值公式

### 3.1 灵根

开局随机决定灵根数量 n，权重：`{1:8, 2:22, 3:35, 4:22, 5:13}`。然后从五行里不重复地随机抽 n 个。
`rootMult` 取自 `data.roots.tiers[n].mult`：`{1:2.0, 2:1.6, 3:1.3, 4:1.1, 5:1.0}`。

转世（lives ≥ 1）时随机两次，取灵根数更少的一次。

### 3.2 功法适配

```
affinity(tech, roots) =
  tech.element === 'none'             → 1.0
  roots.includes(tech.element)        → roots.length === 1 ? 1.35 : 1.2
  否则                                → 0.75
```

### 3.3 修炼速度（灵气/秒）

```
heartMult = 1 + (h.effect.qiRate + h.effect.qiRatePerLv × (lv-1)) × affinity(h)   // 未装备心法时为 1
qiRate = realm.baseRate × rootMult × heartMult
       × (1 + Σ buff.value[type='qiRate'且未过期])
       × (1 + legacy.qiBonus)
       × (injured ? INJURY_QI_MULT : 1)
qiCap  = QI_CAP_MULT × realm.qiCost
```

`advance(dt)` 按「下一个 buff 到期 / 伤势结束」的时间点切片，用解析式累加 `qi += qiRate × slice`，不逐秒循环。离线时乘 `OFFLINE_EFFICIENCY`。结果 clamp 到 `[0, qiCap]`。

### 3.4 破关（同一大境界内，stage → stage+1）

```
需要 qi ≥ realm.qiCost，且下一 stage 与当前 stage 属于同一大境界
chance = clamp(realm.minorChance + pending.breakthroughBonus + legacy.breakBonus, 0.05, 1)
成功：qi -= qiCost；stage += 1
失败：qi -= 0.3 × qiCost
无论成败，pending.breakthroughBonus 都清零
```

### 3.5 渡劫（大境界突破：stage 2→3、5→6、8→9、11→12；stage 14 → 飞升）

需要 `qi ≥ realm.qiCost`。渡劫数据取当前 stage 的 `realm.tribulation = {name, rounds, power, lethal}`。

```
S        = computeStats(state)           // 玩家最终属性
refHp    = realm.baseStats.hp
refDef   = realm.baseStats.def
resist   = clamp(S.def / (S.def + 4 × refDef) + Σtreasure.tribResist + pending.tribulationResist, 0, 0.85)
hp       = S.hp
对每一道雷 r = 1..R：
  strike_r = power × refHp / R × (1 + 0.12 × (r-1)) × rng.range(0.8, 1.2)
  dmg_r    = round(strike_r × (1 - resist))
  hp      -= dmg_r
  若 hp ≤ 0 → 失败，跳出
  若 hp < 0.5 × S.hp，且携带回春丹（opts.healPills），且本劫用药次数 < 3 → 回复 effect.value × QUALITY_MULT[q] × S.hp
成功：qi -= qiCost；stage += 1（stage 14 成功 → 结局 ascend）
失败：qi -= 0.5 × qiCost；受伤 600 秒（injury.until = played + 600）
      若 tribulation.lethal 为真：死亡概率 = 0.25 × (1 - Σcharm.protect)，命中则进入结局 fallen
pending.tribulationResist 清零
```

### 3.6 属性

```
final[k] = (realm.baseStats[k] + Σflat[k]) × (1 + Σpct[k])        k ∈ hp, mp, atk, def, spd
final.crit = clamp(realm.baseStats.crit + Σflat.crit + Σpct.crit, 0, CRIT_CAP)
```

- flat 来自法宝 `treasure.stats.flat`。
- pct 来自护体功法 `body.effect.stats` × (1 + 0.1 × (lv-1)) × affinity，以及心法的 `heart.effect.stats`（可选）。
- 最后 round 取整（crit 不取整）。

### 3.7 战斗伤害

```
skillPower = (skill.power + skill.powerPerLv × (lv-1)) × affinity
raw   = skillPower × atk² / (atk + def)
mult  = elemMult(atkElem, defElem) × (crit ? CRIT_MULT : 1) × rng.range(0.9, 1.1) × (1 + atkBuff)
dmg   = max(1, round(raw × mult))       // 先扣护盾，再扣生命
elemMult：攻方克守方 1.3；守方克攻方 0.75；其余 1.0；任一方为 none 时 1.0
```

- 普通攻击：power = 1.0，element = 'none'，不耗灵力。
- 玩家的防御元素 = 已装备心法的 element（未装备则为 none）。
- 敌人的元素 = `enemy.element`。

### 3.8 回合制自动战斗

- 每回合双方按 spd 从高到低行动，同速时玩家先手。最多 MAX_BATTLE_ROUNDS 回合，超时判玩家撤退（`winner = 'timeout'`，视为未胜利，但不算死亡）。
- 行动开始时：先回复 5% maxMp；再检查丹药规则（见下），用药不占行动。
- 选技能：从「技能顺序指针」开始，依次找第一个满足条件的技能：
  - 灵力 ≥ mpCost；
  - heal 技能要求 hp < 70%；
  - shield 技能要求当前无护盾；
  - buff 技能要求当前无增益。
  使用后指针移到下一个技能。都不满足时普通攻击。
- 技能 kind：
  - `damage`：造成伤害。
  - `heal`：回复 power × maxHp × 0.3。
  - `shield`：护盾 = power × maxHp × 0.25，持续到被打破。
  - `buff`：atkBuff = power × 0.3，持续 3 回合。
  - `drain`：造成伤害，并回复伤害的 30%。
- 丹药规则 `battleConfig.pillRules = [{pillId, below}]`：hp/maxHp < below（对 mp 类丹药是 mp/maxMp < below）且背包有该丹药时服用，先用低品质。每场战斗最多 MAX_PILLS_PER_BATTLE 次。
- 敌人用同一套逻辑，技能来自 `enemy.skills`（字段与功法 skill effect 相同），等级固定为 1，affinity 固定为 1。

### 3.9 炼丹

```
L = alchemy.level（1–10）
success = clamp(recipe.baseRate + 0.03 × (L-1) + (roots 含 fire ? 0.05 : 0) + Σtreasure.alchemyBonus, 0.05, 0.98)
材料和灵石在掷骰前扣除
成功时按权重随机品质：q0..q3 = [60, 28 + 2L, 10 + 1.5L, 2 + 0.5L]；获得 recipe.yield 颗
xp：成功 +3 × recipe.tier，失败 +1；xp ≥ 10 × L 时升级（多余部分保留）
```

### 3.10 丹药效果（`pill.effect = {type, value, duration?}`，实际效果 = value × QUALITY_MULT[q]）

| type | 使用方式 | 效果 |
|---|---|---|
| `qi` | usePill | 立即获得 v × realm.qiCost 点灵气（受 qiCap 限制） |
| `qiRate` | usePill | 加 buff：修炼 +v，持续 duration 秒；同类 buff 只刷新，不叠加，保留更高值 |
| `breakthrough` | usePill | pending.breakthroughBonus += v，上限 0.3 |
| `tribulation` | usePill | pending.tribulationResist += v，上限 0.3 |
| `heal` | 战斗规则 / 渡劫 healPills | 回复 v × maxHp |
| `mp` | 战斗规则 | 回复 v × maxMp |
| `lifespan` | usePill | player.lifespanBonus += v 年；每种丹药每一世最多吃 3 次 |

`pill.realmReq` 是最低使用境界（stage）。

### 3.11 功法升级

```
费用 = round(tech.upgradeCost × lv^1.5) 灵石        // lv 为当前等级
等级上限 = min(tech.maxLevel, 3 + 2 × major)        // major = floor(stage / 3)
```

### 3.12 历练（秘境）

- `startExpedition(dungeonId)` 立即结算并返回完整战报；UI 负责逐步播放。
- 冷却结束后才能再次进入：`expeditions.readyAt[id] = played + dungeon.cooldown`。
- 要求 stage ≥ dungeon.realmReq。
- 流程：先进行 `dungeon.steps - 1` 次事件，从 `eventPool` 按权重随机抽取；最后一步是 boss 战。
- 生命值在整个秘境内延续；灵力每场战斗开始时回满。
- 生命值 ≤ 0 时秘境失败：所得灵石只保留 50%，其余收获全部保留，并受伤 300 秒。
- 通关：额外获得 `dungeon.clearReward`，`expeditions.cleared[id] += 1`。
- 事件效果解释器（engine 实现，content 只写数据）：

| effect.type | 字段 | 说明 |
|---|---|---|
| `stones` | min, max | 获得灵石 |
| `herb` | herbId 或 pool:[ids]，count:[min,max] | 获得药材 |
| `qi` | ratio | 获得 ratio × qiCost 点灵气 |
| `hp` | ratio | 负数为扣血、正数为回血，按 maxHp 的比例 |
| `battle` | enemyId?（省略则从 dungeon.enemyPool 随机） | 战斗；胜利后掉落 enemy.drops |
| `treasure` | treasureId, chance? | 获得法宝；已拥有则折算为 price × 0.5 灵石 |
| `technique` | techniqueId, chance? | 获得功法；已拥有则折算为 price × 0.5 灵石 |
| `pill` | pillId, quality, count | 获得丹药 |
| `buff` | value, duration | qiRate buff |

- 判定 `event.check = {stat, difficulty}`：`S[stat] × rng.range(0.7, 1.3) ≥ difficulty` 时执行 `effects`，否则执行 `failEffects`。没有 check 的事件直接执行 `effects`。

### 3.13 药园

每过 GARDEN_INTERVAL 游戏秒，`garden.pending` 增加 1，上限 GARDEN_CAP。`harvestGarden()` 时，每一株从 `herb.garden === true` 的药材里按 `1/rarity` 权重随机抽取。

### 3.14 寿元与结局

```
lifespan = realm.lifespan + player.lifespanBonus + legacy.lifespanBonus
age += dt / YEAR_SECONDS
age ≥ lifespan → ending = 'sit'
```

- 结局一旦确定，除 `rebirth()`、`save()`、`view()` 外的所有操作都返回 `{ok:false, reason:'ended'}`。

转世 `rebirth()` 时更新 legacy：
- `lives += 1`
- `qiBonus += (ending === 'ascend' ? 0.2 : 0.1)`，上限 1.0
- `breakBonus += 0.02`，上限 0.1
- `lifespanBonus += 10`，上限 50
- `startStones = 100 × lives`
- `inheritTechnique` = 上一世装备的心法 id（新一世直接拥有，1 级）

然后用新种子开局，保留 legacy。

---

## 4. 数据结构（`src/data/`，content 维护）

`src/data/index.js` 默认导出：

```js
export const DATA = { realms, roots, techniques, herbs, pills, recipes, treasures,
                      enemies, events, dungeons, endings, shop, texts };
export default DATA;
```

除 `roots`、`shop`、`texts` 外都是数组，元素必须有唯一的 `id`（snake_case 拼音）和 `name`（中文）。

```js
// realms.js —— 15 条，按 stage 排序
{ id:'lianqi_1', stage:0, name:'炼气前期', major:'炼气', majorIndex:0,
  qiCost:600, baseRate:2, minorChance:0.9, lifespan:100,
  baseStats:{hp:120, mp:60, atk:14, def:8, spd:10, crit:0.05},
  tribulation:null | {name:'初雷劫', rounds:3, power:0.9, lethal:false} }   // 只在 stage 2/5/8/11/14 上设置

// roots.js
{ tiers:{1:{name:'天灵根',mult:2.0,weight:8}, …}, elementNames:{metal:'金',…} }

// techniques.js
{ id, name, type:'heart'|'skill'|'body', element:'metal'|…|'none', rarity:1-4,
  realmReq:0, price:0, maxLevel:10, upgradeCost:50, desc,
  effect: heart: {qiRate:0.2, qiRatePerLv:0.05, stats?:{hp:0.05}}
          skill: {kind:'damage'|'heal'|'shield'|'buff'|'drain', power:1.4, powerPerLv:0.08, mpCost:12}
          body:  {stats:{hp:0.1, def:0.1}} }

// herbs.js
{ id, name, element, rarity:1-4, garden:true|false, desc }

// pills.js
{ id, name, effect:{type, value, duration?}, realmReq:0, desc }

// recipes.js
{ id, pillId, name, tier:1-4, realmReq, baseRate:0.7, stones:10,
  herbs:[{herbId, count}], yield:1 }

// treasures.js
{ id, name, slot:'weapon'|'armor'|'charm', rarity, realmReq, price,
  stats:{flat:{atk:10}, pct:{crit:0.03}}, tribResist?:0.1, alchemyBonus?:0.05, protect?:0.5, desc }

// enemies.js
{ id, name, element, tier, boss?:true,
  stats:{hp, mp, atk, def, spd, crit},
  skills:[{name, kind, power, mpCost, element?}],
  drops:{stones:[min,max], herbs:[{herbId, chance, count:[1,2]}], treasures?:[{treasureId, chance}]},
  art:'wolf'|'spider'|'humanoid'|'puppet'|'toad'|'snake'|'golem'|'bird'|'beast'|'vine' }   // 剪影原型，见 ART_GUIDE

// events.js
{ id, type:'battle'|'fortune'|'trap'|'gather', name, text, textFail?,
  check?:{stat, difficulty}, effects:[…], failEffects?:[…] }

// dungeons.js
{ id, name, realmReq, steps:5, cooldown:120, desc, scene:'mist_valley'|…,
  eventPool:[{eventId, weight}], enemyPool:[enemyId], boss:enemyId,
  clearReward:{stones:[min,max], herbs?:[{herbId,count}], treasure?:{treasureId, chance}} }

// endings.js
{ id:'ascend'|'sit'|'fallen', name, text }

// shop.js
{ techniques:[{id, price}], herbs:[{id, price}], treasures:[{id, price}] }

// texts.js
{ intro:[…段落], tips:[…], breakthrough:{success, fail}, tribulation:{start, strike, success, fail}, … }
```

最低数量（完成标准）：功法 ≥ 10，药材 = 12，丹药 ≥ 6，秘境 ≥ 5，敌人 ≥ 8。每个秘境至少 4 个可抽事件，并且至少覆盖 battle、fortune、trap 三种类型。

---

## 5. 存档状态（GameState，engine 维护结构）

```js
{
  version: 1,
  seed: 12345, rngState: 12345,
  player: { name, roots:['fire','wood'], lifespanBonus:0, age:16, pillLifespanUses:{} },
  stage: 0, qi: 0,
  time: { played:0, lastSeen: 0 /* ms */ },
  techniques: { owned:{ guixi_yinqi:1, fuchen_zhang:1 },
                equipped:{ heart:'guixi_yinqi', body:null, skills:['fuchen_zhang'] } },
  inventory: { stones:0, herbs:{}, pills:{ /* pillId: [q0,q1,q2,q3] */ }, treasures:[] },
  treasures: { weapon:null, armor:null, charm:null },
  alchemy: { level:1, xp:0 },
  buffs: [ {type:'qiRate', value:0.3, until:1234} ],
  pending: { breakthroughBonus:0, tribulationResist:0 },
  injury: { until:0 },
  expeditions: { readyAt:{}, cleared:{} },
  garden: { acc:0, pending:0 },
  battleConfig: { pillRules:[ {pillId:'huichun_dan', below:0.4} ] },
  ending: null | { id:'ascend'|'sit'|'fallen', at: played },
  legacy: { lives:0, qiBonus:0, breakBonus:0, lifespanBonus:0, startStones:0, inheritTechnique:null },
  counters: { techniqueUsed:{}, pillUsed:{}, eventTriggered:{}, enemyDefeated:{}, dungeonRuns:{},
              breakthroughs:0, tribulations:0, tribulationFails:0, battles:0, battlesWon:0, crafts:0 },
  log: [ {t:played, kind:'info'|'good'|'bad'|'rare', text} ]   // 最多保留 100 条
}
```

`counters` 供模拟测试检查覆盖率：技能每次在战斗中使用、丹药每次生效、事件每次触发，都要计数。

---

## 6. 模块接口（engine 实现）

### 6.1 基础（lead 已在骨架中实现，engine 接管维护）

- `src/core/rng.js`
  - `createRng(seed) → {next, int(min,max), range(min,max), chance(p), pick(arr), weighted(items, key='weight'), getState, setState}`
  - 算法为 mulberry32，输出确定可复现。
- `src/core/events.js`
  - `createBus() → {on(name, fn) → off, off, emit(name, payload), once}`
- `src/core/constants.js`

### 6.2 纯函数模块（全部为 `(state, ctx, …) → result`，ctx = `{data: index, rng, bus}`）

- `src/core/dataIndex.js`
  - `buildIndex(DATA)`：返回 `{...DATA, byId:{techniques:Map, herbs:Map, …}, realm(stage)}`。
- `src/core/state.js`
  - `createState({seed, name?, legacy?, now?}, data) → GameState`
- `src/core/realm.js`
  - `getRealm(stage, data)`
  - `isMajorBreak(stage, data)`
  - `breakthroughInfo(state, ctx) → {canAttempt, isMajor, chance, cost, reason?}`
  - `attemptBreakthrough(state, ctx) → {ok, success, from, to, chance}`（只处理小境界）
- `src/core/cultivation.js`
  - `qiRate(state, ctx)`
  - `qiCap(state, ctx)`
  - `advance(state, ctx, sec, {offline}) → {qiGained, gardenGained, ended?}`
  - `applyOffline(state, ctx, nowMs) → {seconds, capped, qiGained}`
- `src/core/techniques.js`
  - `affinity(tech, roots)`
  - `equip(state, ctx, techId, slot, index?)`
  - `unequip(state, ctx, slot, index?)`
  - `setSkillOrder(state, ctx, ids)`
  - `upgrade(state, ctx, techId)`
  - `maxLevel(state, ctx, techId)`
- `src/core/alchemy.js`
  - `craftInfo(state, ctx, recipeId) → {can, rate, missing}`
  - `craft(state, ctx, recipeId) → {ok, success, quality, pillId, count}`
  - `usePill(state, ctx, pillId, q)`
- `src/core/inventory.js`
  - `addHerb`、`addPill`、`addStones`、`buy(state, ctx, kind, id)`、`equipTreasure`、`unequipTreasure`、`harvestGarden`
- `src/core/expedition.js`
  - `canEnter(state, ctx, id)`
  - `runExpedition(state, ctx, id) → ExpeditionReport`
  - `resolveEffect(...)`
- `src/core/tribulation.js`
  - `tribulationInfo(state, ctx)`
  - `runTribulation(state, ctx, {healPills:[{pillId, q}]}) → {ok, success, rounds:[{r, strike, dmg, hp, healed}], resist, death, ending?}`
- `src/core/ending.js`
  - `checkEnding(state, ctx)`
  - `rebirth(state, ctx, {seed}) → newState`
- `src/combat/elements.js`
  - `elemMult(atk, def)`
  - `RELATIONS`（相克、相生表）
- `src/combat/stats.js`
  - `computeStats(state, ctx) → {hp, mp, atk, def, spd, crit, element}`
- `src/combat/battle.js`
  - `makePlayerUnit(state, ctx)`
  - `makeEnemyUnit(enemy)`
  - `simulateBattle(a, b, ctx, {pillRules, inventory}) → {winner:'player'|'enemy'|'timeout', rounds, log:[BattleEvent], playerHpEnd, pillsUsed:[{pillId,q}]}`
  - `BattleEvent = {round, actor:'player'|'enemy', action:'skill'|'attack'|'pill', name, dmg?, heal?, crit?, elem?, mult?, hpA, hpB, shield?}`
- `src/save/save.js`
  - `SAVE_KEY = 'minglan_save_v1'`
  - `serialize(state) → string`
  - `deserialize(str) → state`（会校验和迁移，失败时抛出 `SaveError`）
  - `createSaveManager(storage) → {save(state), load() → state|null, clear(), exportString(state), importString(s)}`
  - `storage` 是 `{getItem, setItem, removeItem}`，测试中用内存实现。

### 6.3 Game 外观（`src/core/game.js`，UI 和模拟测试只通过它访问引擎）

```js
import { createGame } from './src/core/game.js';
const game = createGame({ data: DATA, storage?, seed?, now?: () => Date.now() });
game.bus                    // 事件总线
game.state                  // 当前 GameState（UI 只读）
game.view()                 // 派生快照：{realm, nextRealm, qi, qiCap, qiRate, stats, breakthrough, tribulation,
                            //            age, lifespan, injured, buffs, roots, rootTier, ending, …}
game.newGame({seed?, name?})                    // 保留现有 legacy 时用 rebirth
game.tick(nowMs)            // 推进 (nowMs - 上次 tick) 秒，单次上限 5 秒（超过的部分丢弃，防止切后台后暴走）
game.advance(sec)
game.applyOffline(nowMs) → {seconds, capped, qiGained}
game.breakthrough()         // 小境界破关；在大境界关口调用时返回 {ok:false, reason:'need_tribulation'}
game.tribulation(opts)
game.equipTechnique(id, slot, index?) / unequipTechnique(slot, index?) / setSkillOrder(ids) / upgradeTechnique(id)
game.craft(recipeId) / usePill(pillId, q) / harvestGarden()
game.buy(kind, id) / equipTreasure(id) / unequipTreasure(slot)
game.setPillRules(rules)
game.startExpedition(id) → ExpeditionReport
game.rebirth()
game.save() / game.load() → bool / game.reset() / game.exportSave() / game.importSave(str)
```

所有改动类方法统一返回 `{ok:true, ...}` 或 `{ok:false, reason}`，**不抛异常**。reason 的取值：
`'not_enough_qi' | 'not_enough_stones' | 'missing_herbs' | 'realm_too_low' | 'cooldown' | 'ended' | 'need_tribulation' | 'not_owned' | 'max_level' | 'invalid'`。

---

## 7. 事件总线事件名（`game.bus`）

| 事件 | payload |
|---|---|
| `breakthrough` | {success, from, to, chance} |
| `tribulation:start` | {name, rounds} |
| `tribulation:end` | report（UI 根据 report.rounds 播放每道雷） |
| `battle:end` | {winner, enemyId} |
| `expedition:end` | report |
| `alchemy:done` | {success, pillId, quality} |
| `technique:changed` | {id, level?} |
| `item:gained` | {kind:'herb'|'pill'|'treasure'|'technique'|'stones', id?, count} |
| `pill:used` | {pillId, q} |
| `ending` | {id} |
| `offline` | {seconds, qiGained, capped} |
| `log` | {kind, text} |
| `save` | {ok} |
| `load` | {ok} |
| `realm:changed` | {stage} |

---

## 8. UI 结构（ui-art 负责）

- 入口：`index.html` 加载 `/src/ui/main.js`。
- 布局：
  - 左侧是竹简导航：修炼、功法、炼丹、历练、背包、设置。
  - 中间是主舞台：Canvas 视差水墨山水，加角色打坐剪影和灵气粒子。
  - 右侧是卷轴面板：当前页内容。
  - 顶部是境界、灵气条、灵石、寿元。
  - 底部是日志。
- 每帧调用 `game.tick(performance.now 换算后的 Date.now())`。每 30 秒自动存档；`visibilitychange` 切到 hidden 时也存档。
- 启动时：`game.load()`；没有存档就进入开局（展示随机灵根），然后调用 `applyOffline`，弹出离线收益卷轴。
- 特效档位 low/mid/high，默认 mid。帧率连续 3 秒低于 40 时自动降一档。设置存 `localStorage['minglan_settings']`。
- 音频：首次用户交互后才初始化 AudioContext，可以静音。
- 资源全部登记在 `assets/manifest.json`。

---

## 9. 测试

- `npm test` = `node --test "tests/**/*.test.js"`
- `tests/engine/`：每个 engine 模块单元测试（确定性种子）。
- `tests/data/`：字段完整、id 唯一、引用存在、数值范围、最低数量。
- `tests/simulation/`（lead）：
  - 500 个角色用固定种子，从开局按自动策略玩到金丹前期（stage 6）。
  - 不能抛错，不能卡死（每个角色的游戏时间上限 200 小时）。
  - 数值全程有限且非负；突破率始终在 [0,1]。
  - 功法、丹药、事件的覆盖率。
  - 离线边界、存档往返。

---

## 10. 验收清单

- [ ] `npm run build` 通过
- [ ] `npm test` 全部通过
- [ ] 模拟：500 个角色全部到达金丹，无错误
- [ ] 功法 ≥ 10，药材 12，丹药 ≥ 6，秘境 ≥ 5，敌人 ≥ 8
- [ ] 渡劫、炼丹、历练、战斗、结局（≥ 2 种）、转世可用
- [ ] 离线收益（≤ 8 小时）、存档读写
- [ ] 水墨风 UI：视差山水、卷轴面板、印章按钮、粒子、剑光、渡劫闪电、突破汇聚
- [ ] 特效三档，自动降级
- [ ] WebAudio 五声音阶氛围、风声、剑鸣
- [ ] README、CREDITS 完成

---

## 11. 变更记录

| 日期 | 变更 | 通知对象 |
|---|---|---|
| 初版 | lead 建立 | 全员 |
| P2 | 新增队友 art-assets、audio，接手剪影/图标与音频；接口：drawSilhouette/silhouetteSVG、createAudio({bus,getSettings}) | ui-art |
| P1 | engine 实现差异：counters 增加 breakthroughFails；tribulations/tribulationFails 按「尝试/失败」计数 | lead |
| P1 | ExpeditionReport 扩展：{ok,dungeonId,name,success,cleared,defeated,retreat,reason?,steps:[{index,kind,eventId,type('battle'\|'fortune'\|'trap'\|'gather'\|'boss'),name,text,passed,effects,gains:[{kind,id?,count}],hp,hpAfter,battle?}],stones,herbs,pills,treasures,techniques,clearReward,hpStart,hpEnd,maxHp,injured,gains}；battle 内含 playerMaxHp/enemyMaxHp/log/drops；boss 战超时 = retreat（不通关、不受伤、仍冷却） | ui-art |
| P1 | canEnter 冷却中返回 {ok:false,reason:'cooldown',readyIn}；equipTechnique 的 slot 为 heart\|body\|skill；buy 的 kind 单复数均可 | ui-art |
| P1 | 存档导出串前缀 'MLWD1:' + base64；deserialize 补全缺失字段，非有限数值抛 SaveError；rebirth() 仅在已有 ending 时可用 | ui-art |
| P1 | 新增 game.tribulationInfo() → {name, rounds, resist, hp, expectedDmg, canAttempt}；runTribulation 战报 {ok,success,name,rounds:[{r,strike,dmg,hp,healed}],resist,maxHp,death,ending?} | ui-art |

# LORE.md — 《溟岚问道》世界观与用词表

> 全队统一用词的唯一来源。所有名称均为本项目原创。
> 新增名称前先在此登记（content 提交名称后由 lead 合入本表）。
> 禁止使用任何现有小说、游戏、影视作品的专有名词、人物、宗门、地名、法宝名。
> 「炼气、筑基、金丹、元婴、化神、灵根、功法、丹药、渡劫、飞升、坐化、秘境、灵石」属于通用类型词，可以使用。

## 1. 世界

- **世界名**：溟岚界。四海环抱一片大陆，终年云雾。
- **天穹**：溟岚界之上是「上穹」，飞升者要去的地方。两界之间隔着「九霄雷海」。
- **灵气**：天地间流动的「岚气」。修士吐纳后炼化成自身灵气。UI 里统一写作「灵气」。
- **货币**：灵石（下品）。只有一种货币。
- **纪年**：岚历。游戏中 1 年 = 现实 3600 秒（常量 `YEAR_SECONDS`）。
- **主角**：无名散修，出身海边渔村「潮生村」。偶得一卷残篇，从此踏上仙途。
- **引路人**：老道「闻钟子」，只在开场文本和教程提示中出现。
- **默认姓名池**（随机取）：
  - 姓：沈、陆、顾、苏、林、叶、白、温、萧、柳、程、裴
  - 名：砚舟、听澜、照影、怀素、知秋、栖云、长汀、见微、守拙、映雪、闻溪、若渊

## 2. 境界体系（stage 0–14）

| stage | 名称 | 大境界 | 寿元（年） |
|---|---|---|---|
| 0 | 炼气前期 | 炼气 | 100 |
| 1 | 炼气中期 | 炼气 | |
| 2 | 炼气后期 | 炼气 | |
| 3 | 筑基前期 | 筑基 | 220 |
| 4 | 筑基中期 | 筑基 | |
| 5 | 筑基后期 | 筑基 | |
| 6 | 金丹前期 | 金丹 | 500 |
| 7 | 金丹中期 | 金丹 | |
| 8 | 金丹后期 | 金丹 | |
| 9 | 元婴前期 | 元婴（扩展） | 1000 |
| 10 | 元婴中期 | 元婴 | |
| 11 | 元婴后期 | 元婴 | |
| 12 | 化神前期 | 化神（扩展） | 2000 |
| 13 | 化神中期 | 化神 | |
| 14 | 化神后期 | 化神 | |

- 小境界突破叫「破关」，有成功率。
- 大境界突破叫「渡劫」，要扛过天雷。各劫的名称：
  - 炼气→筑基：**初雷劫**（3 道）
  - 筑基→金丹：**三九雷劫**（5 道）
  - 金丹→元婴：**紫霄雷劫**（7 道）
  - 元婴→化神：**九幽心雷劫**（9 道）
  - 化神后期→飞升：**登穹雷劫**（9 道）

## 3. 灵根

五行元素 id：`metal` 金、`wood` 木、`water` 水、`fire` 火、`earth` 土。另有 `none`，表示无属性。

| 灵根数 | 称号 | 修炼倍率 |
|---|---|---|
| 1 | 天灵根 | 2.0 |
| 2 | 双灵根 | 1.6 |
| 3 | 三灵根 | 1.3 |
| 4 | 四灵根 | 1.1 |
| 5 | 伪灵根 | 1.0 |

- 相克：金克木，木克土，土克水，水克火，火克金。
- 相生：金生水，水生木，木生火，火生土，土生金。

## 4. 功法（id → 名称，type，element）

| id | 名称 | 类型 | 元素 |
|---|---|---|---|
| guixi_yinqi | 归息引气篇 | heart 心法 | none（开局赠送） |
| fuchen_zhang | 拂尘掌 | skill 术法 | none（开局赠送） |
| duanhong_jian | 断鸿剑意 | skill | metal |
| ruijin_cuifeng | 锐金淬锋诀 | heart | metal |
| qingteng_chansi | 青藤缠丝手 | skill | wood |
| qixia_tuna | 栖霞吐纳篇 | heart | wood |
| hanyi_ningbing | 寒漪凝冰诀 | skill | water |
| chengxin_guanshui | 澄心观水经 | heart | water |
| chiyu_fentian | 赤羽焚天印 | skill | fire |
| liyan_lianxin | 离焰炼心诀 | heart | fire |
| houkun_zhenyue | 厚坤镇岳功 | body 护体 | earth |
| panshi_budong | 磐石不动身 | skill（护盾） | earth |
| liuyun_bu | 流云步 | body | none |
| wuqi_guiyuan | 五气归元篇 | heart | none（高阶，适配所有灵根） |
| muchun_huisheng | 沐春回生诀 | skill（治疗） | wood |

## 5. 药材（12 种）

| id | 名称 | 元素 | 稀有度 |
|---|---|---|---|
| ninglu_cao | 凝露草 | water | 1 |
| chiwen_zhi | 赤纹芝 | fire | 1 |
| qingsui_gen | 青髓根 | wood | 1 |
| shitai_ru | 石胎乳 | earth | 1 |
| shuangxin_lan | 霜心兰 | water | 2 |
| zijing_guo | 紫晶果 | fire | 2 |
| yumai_ye | 玉脉叶 | wood | 2 |
| huangjing_teng | 黄精藤 | earth | 2 |
| xingxie_cao | 星屑草 | metal | 3 |
| xuerui_lian | 雪蕊莲 | water | 3 |
| longlin_tai | 龙鳞苔 | metal | 3 |
| mengxun | 梦蕈 | none | 4 |

## 6. 丹药

| id | 名称 | 作用 |
|---|---|---|
| juling_dan | 聚灵丹 | 立即获得灵气 |
| peiyuan_dan | 培元丹 | 一段时间内修炼速度提升 |
| pozhang_dan | 破障丹 | 下次破关成功率提升 |
| humai_dan | 护脉丹 | 下次渡劫雷伤减免 |
| huichun_dan | 回春丹 | 战斗、渡劫中回复生命 |
| ningshen_dan | 凝神丹 | 战斗中回复灵力 |
| yanshou_dan | 延寿丹 | 增加寿元 |
| zhuji_dan | 固基丹 | 大幅减免渡劫雷伤（高阶） |

品质分四档：下品、中品、上品、极品（q0–q3）。

## 7. 秘境

| id | 名称 | 推荐境界 |
|---|---|---|
| wuqi_gu | 雾栖谷 | 炼气 |
| hanyi_dong | 寒漪古洞 | 炼气后期 |
| chenzhong_dian | 沉钟古殿 | 筑基 |
| chisha_xia | 赤砂火峡 | 筑基后期 |
| chengquan_jing | 澄泉秘境 | 金丹 |
| xingyun_yuan | 星陨荒原 | 元婴（扩展） |
| guixu_yunhai | 归墟云海 | 化神（扩展） |

## 8. 敌人

| id | 名称 | 元素 | 出没 |
|---|---|---|---|
| wu_lang | 雾狼 | wood | 雾栖谷 |
| yanjia_zhu | 岩甲蛛 | earth | 雾栖谷 |
| shanfei | 剪径散修 | metal | 雾栖谷 / 沉钟古殿 |
| kumu_kui | 枯木傀 | wood | 雾栖谷首领 |
| bingpo_chan | 冰魄蟾 | water | 寒漪古洞 |
| xueban_she | 血斑蛇 | water | 寒漪古洞 |
| shi_wei | 古殿石卫 | earth | 沉钟古殿 |
| duodao_xiu | 堕道修士 | fire | 沉钟古殿首领 |
| huo_ya | 焚羽鸦 | fire | 赤砂火峡 |
| yanlin_shou | 炎鳞兽 | fire | 赤砂火峡首领 |
| teng_yao | 缠藤妖 | wood | 澄泉秘境 |
| yuandi_gushou | 渊底古兽 | water | 澄泉秘境首领 |

## 9. 法宝

| id | 名称 | 槽位 |
|---|---|---|
| shuanghen_jian | 霜痕飞剑 | weapon |
| qingmang_jian | 青芒剑 | weapon |
| yunwen_fayi | 云纹法衣 | armor |
| xuanjia_fayi | 玄甲法衣 | armor |
| yinlei_mufu | 引雷木符 | charm（渡劫减伤） |
| zhenhun_yupei | 镇魂玉佩 | charm（防劫中陨落） |
| chitong_ding | 赤铜小鼎 | charm（炼丹加成） |

## 10. 结局

| id | 名称 | 触发 |
|---|---|---|
| ascend | 飞升上穹 | 化神后期渡过登穹雷劫 |
| sit | 寿尽坐化 | 年龄达到寿元上限 |
| fallen | 劫火陨落 | 元婴及以上的渡劫失败，并且死亡判定命中 |

结局后可以「转世重修」：开启下一世，带传承加成。

## 11. 文风

- 文案用简洁的半文半白，不堆砌辞藻。单条事件文本 ≤ 60 字。
- 数值单位：灵气、灵石、年。
- UI 按钮用两个字：修炼、破关、渡劫、炼丹、历练、功法、背包、设置。

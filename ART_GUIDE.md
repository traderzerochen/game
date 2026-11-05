# ART_GUIDE.md — 水墨国风美术规范

> 全部美术用 SVG / Canvas 程序化绘制，不引入任何外部图片、字体或音频文件。
> 原则：**一个生成函数产出一类素材**，用参数（种子、配色、比例）派生变体。不要为每个单位手写大段路径。

## 1. 观感关键词

留白、晕染、淡彩、层次、宁静、仙气。画面约 60% 是宣纸底色和远景雾气，主体集中在视觉中心偏下的位置。

## 2. 色板（`src/art/palette.js` 导出，CSS 变量同名）

| 变量 | 值 | 用途 |
|---|---|---|
| `--paper` | `#f3ecdc` | 宣纸底 |
| `--paper-deep` | `#e6dcc4` | 面板底、卷轴内衬 |
| `--ink-0` | `#1d1b19` | 浓墨（文字、主线条） |
| `--ink-1` | `#3b3833` | 重墨 |
| `--ink-2` | `#6b665d` | 中墨（次要文字） |
| `--ink-3` | `#a39d90` | 淡墨（远山、分隔） |
| `--ink-4` | `#cfc8b8` | 清墨（最远层、雾） |
| `--cinnabar` | `#b8432f` | 朱砂（印章、警示、火） |
| `--azurite` | `#3d6f8a` | 石青（水、按钮高亮） |
| `--malachite` | `#4f7d5c` | 石绿（木） |
| `--gamboge` | `#c99a2e` | 藤黄（金、品质） |
| `--ochre` | `#9a6b3f` | 赭石（土） |
| `--glow-gold` | `rgba(255,214,120,.85)` | 金色柔光 |
| `--glow-cyan` | `rgba(140,220,230,.85)` | 青色柔光 |
| `--glow-red` | `rgba(240,120,90,.85)` | 赤色柔光 |

五行配色：金→`--gamboge`，木→`--malachite`，水→`--azurite`，火→`--cinnabar`，土→`--ochre`，无→`--ink-2`。
品质色：下品为 ink-2，中品为 malachite，上品为 azurite，极品为 gamboge 并加柔光。

## 3. 字体

```css
font-family: "STKaiti","KaiTi","Kaiti SC","楷体","AR PL UKai CN","Noto Serif SC","Songti SC","SimSun",serif;
```

- 标题、印章用楷体；正文用宋体（serif 兜底）。
- 不加载网络字体。

## 4. 素材生成器（`src/art/`）

| 模块 | 函数 | 说明 |
|---|---|---|
| `palette.js` | 色板常量、`elementColor(el)`、`qualityColor(q)` | |
| `noise.js` | 种子化 value noise / fbm | 晕染、山脊 |
| `brush.js` | `brushStroke(ctx, pts, {width, ink, dry})` | 毛笔线：变宽 + 飞白 |
| `mountains.js` | `drawMountainLayer(ctx, {seed, y, height, ink, blur})` | 远山层，fbm 山脊 + 底部渐隐 |
| `scenery.js` | 云海、松、石、飞瀑、竹 | 组合场景 |
| `scenes.js` | `renderScene(ctx, sceneKey, t, quality)` | 秘境背景：mist_valley / cold_cave / bell_hall / red_gorge / clear_spring / … |
| `silhouette.js` | `drawSilhouette(ctx, archetype, {seed, scale, ink, accent})` | 角色、敌人剪影：按原型（humanoid / wolf / spider / …）参数化 |
| `icons.js` | `techniqueIcon(tech)`、`herbIcon(herb)`、`pillIcon(pill, q)`、`treasureIcon(t)`、`rootIcon(el)` → SVG 字符串 | 由数据字段派生：元素色、稀有度、id 哈希决定形状变体 |
| `seal.js` | `sealSVG(text, {color, shape})` | 印章 |
| `fx.js` | 粒子系统：灵气汇聚、剑光拖尾、法术爆发、雷劫闪电 + 墨晕散、治疗光环 | 受档位控制 |

图标统一 64×64 viewBox，描边 2–3 px 墨色，带轻微手绘抖动（种子化）。

## 5. 视差背景

至少 4 层：
1. 远山（ink-4，模糊 6px）
2. 中山（ink-3，模糊 3px）
3. 云海带，缓慢横移
4. 近景松石（ink-1）

- 层速依次是 0.05、0.15、0.3、0.6。
- 背景层预渲染到离屏 Canvas，按时间平移，不要每帧重绘山形。

## 6. 特效档位

| 档 | 粒子上限 | 模糊 | 视差层 | 闪电分叉 |
|---|---|---|---|---|
| low | 40 | 无（用透明度代替） | 2 | 1 |
| mid（默认） | 150 | 有 | 4 | 3 |
| high | 400 | 有 + 墨晕 | 5 | 6 |

自动降级：FPS 滑动平均连续 3 秒低于 40 时降一档，并提示「已降低特效以保流畅」。

## 7. UI 组件

- **卷轴面板**：上下木轴（赭石渐变圆柱），中间是宣纸。打开时有展开动画。
- **竹简导航**：竖排竹片，选中的竹片墨色加深，并在旁边钤一枚朱砂小印。
- **印章按钮**：朱砂方印，文字白色（阴刻）或朱色（阳刻）。按下时轻微缩放并晕开。
- **进度条**：一道淡墨笔触，被浓墨笔触逐渐填满。
- **弹窗**：小卷轴加半透明宣纸遮罩。

## 8. 占位素材（阶段 1）

色块加文字标签：用元素色圆角矩形，中间写名称首字。保证尺寸、接口与正式素材一致，以后可以直接替换。

## 9. 音效（`src/audio/`）

WebAudio 合成，不加载音频文件：
- **氛围**：五声音阶（宫商角徵羽 = C D E G A），用古琴拨弦感的音色（衰减正弦 + 泛音），慢速随机旋律，加混响（卷积用程序生成的噪声脉冲）。
- **风声**：粉噪声 → 带通滤波，用 LFO 调制。
- **剑鸣**：高频正弦 + 金属泛音，快速起音，长衰减。
- **其他**：突破钟声、雷声（低通噪声爆发）、丹成清响、按钮木鱼声。

## 10. manifest

`assets/manifest.json` 登记每一个生成器或资源：

```json
{ "id": "silhouette.wolf", "type": "procedural", "module": "src/art/silhouette.js", "source": "self-made", "license": "project" }
```

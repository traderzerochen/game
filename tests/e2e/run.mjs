// 《溟岚问道》浏览器端到端测试（qa 负责）
// 运行：npm run test:e2e（先 vite build，再执行本脚本）
// 约定：交互一律通过点击 UI 完成；为避免真实等待，允许通过 window.__minglan 读取状态、
// game.advance() 快进时间，以及直接改写 state 做“前置条件铺设”（灵石、年龄、境界等）。
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 4180;
const URL_BASE = `http://127.0.0.1:${PORT}/`;
const SHOT_DIR = process.env.QA_SHOT_DIR || '/tmp/claude-0/-home-user-game/3e3ed93a-120e-5482-a0f3-7bd66f195918/scratchpad/qa';
mkdirSync(SHOT_DIR, { recursive: true });

// ---------- 加载 playwright（项目内、NODE_PATH 或全局均可） ----------
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 继续 */ }
  const dirs = [];
  if (process.env.NODE_PATH) dirs.push(...process.env.NODE_PATH.split(path.delimiter));
  try { dirs.push(execSync('npm root -g', { encoding: 'utf8' }).trim()); } catch { /* 忽略 */ }
  for (const d of dirs) {
    try { return createRequire(path.join(d, 'noop.js'))('playwright'); } catch { /* 下一个 */ }
  }
  throw new Error('找不到 playwright 模块');
}
const { chromium } = await loadPlaywright();

// ---------- 预览服务 ----------
function startServer() {
  const bin = path.join(ROOT, 'node_modules/.bin/vite');
  const proc = spawn(bin, ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  proc.stdout.on('data', (d) => { out += d; });
  proc.stderr.on('data', (d) => { out += d; });
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = () => {
      http.get(URL_BASE, (res) => { res.resume(); resolve(proc); }).on('error', () => {
        if (proc.exitCode != null) return reject(new Error('vite preview 退出：' + out));
        if (Date.now() - t0 > 20000) return reject(new Error('vite preview 启动超时：' + out));
        setTimeout(poll, 200);
      });
    };
    poll();
  });
}

// ---------- 断言与工具 ----------
class Fail extends Error {}
function check(cond, msg) { if (!cond) throw new Fail(msg); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const warnings = [];
const notes = [];

let browser;
async function newCtx({ viewport = { width: 1440, height: 900 }, label = 'case', storageState } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, storageState });
  const errors = [];
  const page = await context.newPage();
  const hook = (p) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  };
  hook(page);
  context.on('page', hook);
  return { context, page, errors, label };
}

async function open(c) {
  await c.page.goto(URL_BASE);
  await c.page.waitForFunction(() => !!window.__minglan, null, { timeout: 15000 });
  await c.page.waitForSelector('.topbar');
}

async function shot(c, name) {
  await c.page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

/** 在页面里取 app（window.__minglan），fn 内以 (app, game, state) 调用 */
function ev(c, fn, arg) {
  return c.page.evaluate(`(() => { const app = window.__minglan; const game = app.game; const state = game.state; return (${fn.toString()})(app, game, state, ${JSON.stringify(arg ?? null)}); })()`);
}

async function startGame(c, name = '玄机子') {
  await open(c);
  const modal = c.page.locator('.modal-mask');
  await modal.waitFor({ timeout: 5000 });
  const input = modal.locator('input[type=text]');
  if (name) await input.fill(name);
  await modal.getByRole('button', { name: '踏上仙途' }).click();
  await c.page.waitForFunction(() => !document.querySelector('.modal-mask'));
}

async function nav(c, name) {
  await c.page.locator('.nav .slip', { hasText: name }).click();
  await c.page.waitForFunction((n) => document.querySelector('.scroll-title')?.textContent.includes(n), name);
}

const section = (c, h3) => c.page.locator('.panel-wrap .section', { has: c.page.locator('h3', { hasText: h3 }) }).first();
const realmText = (c) => c.page.locator('.topbar .realm').textContent();
const toastText = (c) => c.page.locator('.toast-layer .toast').allTextContents();

async function expectToast(c, re, timeout = 4000) {
  const t0 = Date.now();
  let last = [];
  while (Date.now() - t0 < timeout) {
    last = await toastText(c);
    if (last.some((t) => re.test(t))) return;
    await sleep(100);
  }
  throw new Fail(`未出现提示 ${re}，当前提示：${JSON.stringify(last)}`);
}

/** 给定状态改写（铺设前置条件）后刷新当前页 */
async function setup(c, fn, arg) {
  await ev(c, fn, arg);
  await ev(c, (app) => { app.forceRefresh(); });
}

// ---------- 布局检查 ----------
async function layoutProblems(page, label) {
  return page.evaluate((label) => {
    const out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) out.push(`${label}: 页面出现横向滚动 (${de.scrollWidth} > ${de.clientWidth})`);
    if (document.body.scrollWidth > window.innerWidth + 1) out.push(`${label}: body 横向溢出 (${document.body.scrollWidth} > ${window.innerWidth})`);
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return true;
      }
      return false;
    };
    const desc = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').join('.')}「${(el.textContent || '').trim().slice(0, 12)}」`;
    const seen = new Set();
    for (const el of document.querySelectorAll('.topbar *, .nav *, .panel-wrap *, .log *, .stage *, .modal *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if ((r.right > window.innerWidth + 1 || r.left < -1) && !clipped(el)) {
        const k = desc(el);
        if (!seen.has(k)) { seen.add(k); out.push(`${label}: 元素越出视口 ${k} [${Math.round(r.left)},${Math.round(r.right)}]`); }
      }
    }
    // 按钮遮挡检测：可见区域内启用按钮中心点应命中自身
    for (const b of document.querySelectorAll('button')) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || b.disabled) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== b && !b.contains(top)) {
        // 位于滚动容器之外被裁剪的情况不算遮挡
        out.push(`${label}: 按钮被遮挡 ${desc(b)} 被 ${desc(top)} 覆盖`);
      }
    }
    // 文字截断（可读性）：块级文本被 overflow hidden 且内容更宽
    for (const el of document.querySelectorAll('.topbar *, .nav .slip, .card .name, .seal-btn, .btn')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      if (/(hidden|clip)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !el.classList.contains('ink-bar') && !el.classList.contains('fill')) {
        const k = desc(el);
        if (!seen.has('t' + k)) { seen.add('t' + k); out.push(`${label}: 文字被截断 ${k} (${el.scrollWidth} > ${el.clientWidth})`); }
      }
    }
    return out;
  }, label);
}

// ---------- 用例 ----------
const cases = [];
const test = (name, fn) => cases.push({ name, fn });

test('01 开局：卷轴、灵根、道号、踏上仙途', async () => {
  const c = await newCtx({ label: '01' });
  await open(c);
  const modal = c.page.locator('.modal-mask .modal');
  await modal.waitFor();
  const title = await modal.locator('.scroll-title').textContent();
  check(title.includes('溟岚问道'), `开局卷轴标题异常：${title}`);
  check(await modal.locator('.scroll').count() > 0, '开局弹窗不是卷轴');
  const rootCount = await modal.locator('.intro-roots > *').count();
  check(rootCount >= 1 && rootCount <= 5, `灵根图标数量异常：${rootCount}`);
  const roots = await ev(c, (a, g, s) => s.player.roots.length);
  check(rootCount === roots, `灵根图标数 ${rootCount} 与状态 ${roots} 不一致`);
  const desc = await modal.locator('p.noindent').first().textContent();
  check(desc.trim().length > 2, '灵根说明为空');
  await shot(c, '01-intro');
  const btnBox = await modal.getByRole('button', { name: '踏上仙途' }).boundingBox();
  check(btnBox && btnBox.width > 40, '「踏上仙途」按钮不可见');
  await modal.locator('input[type=text]').fill('云中鹤');
  // 无法通过 Esc 关闭（dismissable:false）
  await c.page.keyboard.press('Escape');
  check(await c.page.locator('.modal-mask').count() === 1, '开局卷轴不应可被 Esc 关闭');
  await modal.getByRole('button', { name: '踏上仙途' }).click();
  await c.page.waitForFunction(() => !document.querySelector('.modal-mask'));
  const name = await ev(c, (a, g, s) => s.player.name);
  check(name === '云中鹤', `道号未生效：${name}`);
  check((await realmText(c)).includes('炼气前期'), '顶栏境界应为炼气前期');
  await expectToast(c, /仙途伊始/);
  await shot(c, '01-started');
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

test('02 修炼：灵气增长、破关、顶栏境界变化', async () => {
  const c = await newCtx();
  await startGame(c);
  const q0 = await ev(c, (a, g, s) => s.qi);
  await sleep(1500);
  const q1 = await ev(c, (a, g, s) => s.qi);
  check(q1 > q0, `灵气未随时间增长 ${q0} -> ${q1}`);
  const barW1 = await c.page.locator('.topbar .qi-bar .fill').evaluate((e) => parseFloat(e.style.width));
  const lbl = await c.page.locator('.topbar .qi-bar .lbl').textContent();
  check(/灵气/.test(lbl), `顶栏灵气条文字异常：${lbl}`);
  // 破关按钮在灵气不足时禁用
  const btn = c.page.locator('.panel-wrap').getByRole('button', { name: '破关', exact: true });
  check(await btn.isDisabled(), '灵气不足时「破关」应禁用');
  await shot(c, '02-cultivate-early');
  // 快进至灵气满
  await ev(c, (a, g, s) => { const cost = g.view().realm.qiCost; let n = 0; while (s.qi < cost && n++ < 500) g.advance(600); });
  await c.page.waitForFunction(() => { const b = [...document.querySelectorAll('.panel-wrap .seal-btn')].find((x) => x.textContent === '破关'); return b && !b.disabled; }, null, { timeout: 5000 });
  const barW2 = await c.page.locator('.topbar .qi-bar .fill').evaluate((e) => parseFloat(e.style.width));
  check(barW2 >= 99 && barW2 > barW1, `灵气条未满：${barW1} -> ${barW2}`);
  await shot(c, '02-cultivate-full');
  const before = await realmText(c);
  let upgraded = false;
  for (let i = 0; i < 8 && !upgraded; i++) {
    await btn.click();
    await sleep(200);
    if ((await realmText(c)) !== before) upgraded = true;
    else {
      // 失败则补满灵气重试
      await ev(c, (a, g, s) => { const cost = g.view().realm.qiCost; let n = 0; while (s.qi < cost && n++ < 500) g.advance(600); });
      await c.page.waitForFunction(() => { const b = [...document.querySelectorAll('.panel-wrap .seal-btn')].find((x) => x.textContent === '破关'); return b && !b.disabled; }, null, { timeout: 5000 });
    }
  }
  check(upgraded, '多次破关后顶栏境界仍未变化');
  const after = await realmText(c);
  check(after.includes('炼气中期'), `顶栏境界应为炼气中期，实为 ${after}`);
  await expectToast(c, /炼气中期|破/);
  await shot(c, '02-breakthrough');
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

test('03 功法页：卸下、装入、调整顺序、升级', async () => {
  const c = await newCtx();
  await startGame(c);
  await setup(c, (a, g, s) => { s.inventory.stones = 5000; s.techniques.owned.duanhong_jian = 1; });
  await nav(c, '功法');
  await shot(c, '03-techniques');
  const eqBox = section(c, '运转中');
  // 卸下技能 1
  await eqBox.locator('.card', { hasText: '技能 1' }).getByRole('button', { name: '卸下' }).click();
  let sk = await ev(c, (a, g, s) => [...s.techniques.equipped.skills]);
  check(sk.length === 0, `卸下后技能槽应为空：${sk}`);
  // 装入两门
  const lib = section(c, '藏经');
  await lib.locator('.card', { hasText: '拂尘掌' }).getByRole('button', { name: '装入' }).click();
  await lib.locator('.card', { hasText: '断鸿剑意' }).getByRole('button', { name: '装入' }).click();
  sk = await ev(c, (a, g, s) => [...s.techniques.equipped.skills]);
  check(sk.join() === 'fuchen_zhang,duanhong_jian', `装入顺序异常：${sk}`);
  // 调整顺序：技能 1 下移
  await section(c, '运转中').locator('.card', { hasText: '技能 1' }).getByRole('button', { name: '↓' }).click();
  sk = await ev(c, (a, g, s) => [...s.techniques.equipped.skills]);
  check(sk.join() === 'duanhong_jian,fuchen_zhang', `顺序调整失败：${sk}`);
  const firstName = await section(c, '运转中').locator('.card', { hasText: '技能 1' }).locator('.name').textContent();
  check(firstName.includes('断鸿剑意'), `UI 上技能 1 应为断鸿剑意：${firstName}`);
  await shot(c, '03-reordered');
  // 上移回来（首项上移按钮应禁用）
  check(await section(c, '运转中').locator('.card', { hasText: '技能 1' }).getByRole('button', { name: '↑' }).isDisabled(), '第一技能的「↑」应禁用');
  // 升级
  const s0 = await ev(c, (a, g, s) => s.inventory.stones);
  const up = section(c, '藏经').locator('.card', { hasText: '拂尘掌' }).getByRole('button', { name: /参悟/ });
  check(await up.isEnabled(), '灵石足够时「参悟」应可点');
  await up.click();
  const lv = await ev(c, (a, g, s) => s.techniques.owned.fuchen_zhang);
  const s1 = await ev(c, (a, g, s) => s.inventory.stones);
  check(lv === 2, `拂尘掌应升至 2 重，实为 ${lv}`);
  check(s1 < s0, '升级未扣灵石');
  await expectToast(c, /精进至第 2 重/);
  const stonesTxt = await c.page.locator('.topbar').textContent();
  check(stonesTxt.includes(String(Math.floor(s1))) || stonesTxt.includes(Math.floor(s1).toLocaleString('zh-CN')), `顶栏灵石未更新：${stonesTxt}`);
  // 灵石不足时升级按钮禁用
  await setup(c, (a, g, s) => { s.inventory.stones = 0; });
  check(await section(c, '藏经').locator('.card', { hasText: '拂尘掌' }).getByRole('button', { name: /参悟|已至/ }).isDisabled(), '灵石为 0 时「参悟」应禁用');
  // 卸下心法
  await section(c, '运转中').locator('.card', { hasText: '心法' }).getByRole('button', { name: '卸下' }).click();
  check(await ev(c, (a, g, s) => s.techniques.equipped.heart) == null, '心法未卸下');
  await section(c, '藏经').locator('.card', { hasText: '归息引气' }).getByRole('button', { name: '运转' }).click();
  check(await ev(c, (a, g, s) => s.techniques.equipped.heart) === 'guixi_yinqi', '心法未重新运转');
  await shot(c, '03-techniques-after');
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

test('04 历练：入雾栖谷、跳过回放、结算卷轴、冷却倒计时', async () => {
  const c = await newCtx();
  await startGame(c);
  await nav(c, '历练');
  await shot(c, '04-expedition-list');
  const card = c.page.locator('.card', { hasText: '雾栖谷' }).first();
  await card.getByRole('button', { name: '入秘境' }).click();
  await c.page.getByRole('button', { name: '跳过' }).waitFor({ timeout: 5000 });
  check((await c.page.locator('.scroll-title').textContent()).includes('历练'), '回放期间标题异常');
  await sleep(1500);
  await shot(c, '04-replay');
  const logCount = await c.page.locator('.replay-log .ev').count();
  check(logCount >= 1, '回放日志为空');
  await c.page.getByRole('button', { name: '跳过' }).click();
  const modal = c.page.locator('.modal-mask .modal');
  await modal.waitFor({ timeout: 5000 });
  const title = await modal.locator('.scroll-title').textContent();
  check(title.includes('雾栖谷'), `结算卷轴标题异常：${title}`);
  await shot(c, '04-settlement');
  const hasGain = await modal.locator('.item').count();
  notes.push(`04 结算卷轴：${title}，奖励项 ${hasGain}`);
  await modal.getByRole('button', { name: '收卷' }).click();
  await c.page.waitForFunction(() => !document.querySelector('.modal-mask'));
  // 冷却倒计时
  const cd = c.page.locator('.card', { hasText: '雾栖谷' }).first();
  await cd.locator('.small.muted', { hasText: '恢复中' }).waitFor({ timeout: 3000 });
  const t1 = await cd.locator('.small.muted', { hasText: '恢复中' }).textContent();
  const m1 = t1.match(/恢复中\s*(\d+):(\d\d)/);
  check(m1, `冷却文字格式异常：${t1}`);
  const sec1 = Number(m1[1]) * 60 + Number(m1[2]);
  const real = await ev(c, (a, g, s) => s.expeditions.readyAt.wuqi_gu - s.time.played);
  check(Math.abs(sec1 - Math.ceil(real)) <= 2, `冷却显示 ${sec1}s 与状态 ${real}s 不符`);
  check(sec1 <= 90 && sec1 >= 80, `雾栖谷冷却应约 90 秒，显示 ${sec1}`);
  check(await cd.getByRole('button', { name: '入秘境' }).isDisabled(), '冷却中「入秘境」应禁用');
  await sleep(2200);
  const t2 = await cd.locator('.small.muted', { hasText: '恢复中' }).textContent();
  const m2 = t2.match(/恢复中\s*(\d+):(\d\d)/);
  const sec2 = Number(m2[1]) * 60 + Number(m2[2]);
  check(sec2 < sec1, `倒计时未减少 ${sec1} -> ${sec2}`);
  // 快进过冷却
  await ev(c, (a, g) => { g.advance(100); });
  await c.page.waitForFunction(() => { const b = [...document.querySelectorAll('.card')].find((x) => x.textContent.includes('雾栖谷')); return b && !b.querySelector('.actions .seal-btn').disabled; }, null, { timeout: 5000 });
  await shot(c, '04-cooldown-over');
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

test('05 背包与坊市：买药材、服丹、装备法宝', async () => {
  const c = await newCtx();
  await startGame(c);
  await setup(c, (a, g, s) => { s.inventory.stones = 1000; });
  await nav(c, '背包');
  await shot(c, '05-bag-initial');
  const shop = section(c, '坊市');
  const herbName = '凝露草';
  const before = await ev(c, (a, g, s) => s.inventory.herbs.ninglu_cao || 0);
  await shop.locator('.card', { hasText: herbName }).getByRole('button', { name: /灵石/ }).click();
  const after = await ev(c, (a, g, s) => s.inventory.herbs.ninglu_cao || 0);
  check(after === before + 1, `买药材后数量应 +1：${before} -> ${after}`);
  check((await section(c, '药材').textContent()).includes(herbName), '药材栏未显示新买药材');
  // 买法宝并祭炼
  const tName = '青芒剑';
  await section(c, '坊市').locator('.card', { hasText: tName }).getByRole('button', { name: /灵石/ }).click();
  check((await ev(c, (a, g, s) => s.inventory.treasures)).includes('qingmang_jian'), '法宝未入包');
  await shot(c, '05-bag-bought');
  await section(c, '法宝').locator('.card', { hasText: tName }).getByRole('button', { name: '祭炼' }).click();
  check(await ev(c, (a, g, s) => s.treasures.weapon) === 'qingmang_jian', '法宝未装备到兵刃');
  check((await section(c, '法宝').locator('.card.equipped').first().textContent()).includes(tName), 'UI 未显示已装备法宝');
  await section(c, '法宝').locator('.card.equipped', { hasText: tName }).getByRole('button', { name: '卸下' }).click();
  check(await ev(c, (a, g, s) => s.treasures.weapon) == null, '法宝未卸下');
  await section(c, '法宝').locator('.card', { hasText: tName }).getByRole('button', { name: '祭炼' }).click();
  // 服用丹药：给一枚聚灵丹
  await setup(c, (a, g, s) => { s.inventory.pills.juling_dan = [2, 0, 0, 0]; });
  const q0 = await ev(c, (a, g, s) => s.qi);
  await shot(c, '05-bag-pills');
  await section(c, '丹药').locator('.item', { hasText: '聚灵丹' }).click();
  const q1 = await ev(c, (a, g, s) => s.qi);
  const left = await ev(c, (a, g, s) => s.inventory.pills.juling_dan[0]);
  check(left === 1, `服丹后应剩 1 枚，实为 ${left}`);
  check(q1 > q0, `服用聚灵丹后灵气未增加 ${q0} -> ${q1}`);
  await expectToast(c, /服下/);
  // 灵石不足时按钮禁用
  await setup(c, (a, g, s) => { s.inventory.stones = 0; });
  check(await section(c, '坊市').locator('.card', { hasText: '凝露草' }).getByRole('button', { name: /灵石/ }).isDisabled(), '灵石不足时购买按钮应禁用');
  await shot(c, '05-bag-final');
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

test('06 炼丹：材料足够炼制，不足时禁用，结果提示', async () => {
  const c = await newCtx();
  await startGame(c);
  await nav(c, '炼丹');
  await shot(c, '06-alchemy-empty');
  const rec = c.page.locator('.card', { hasText: '聚灵丹方' }).first();
  check(await rec.getByRole('button', { name: '炼制' }).isDisabled(), '无材料时「炼制」应禁用');
  await setup(c, (a, g, s) => { s.inventory.stones = 500; s.inventory.herbs.ninglu_cao = 20; s.inventory.herbs.qingsui_gen = 10; });
  await shot(c, '06-alchemy-ready');
  const btn = c.page.locator('.card', { hasText: '聚灵丹方' }).first().getByRole('button', { name: '炼制' });
  check(await btn.isEnabled(), '材料足够时「炼制」应可点');
  let ok = 0, fail = 0;
  for (let i = 0; i < 6; i++) {
    const pills0 = await ev(c, (a, g, s) => (s.inventory.pills.juling_dan || [0, 0, 0, 0]).reduce((x, y) => x + y, 0));
    const herb0 = await ev(c, (a, g, s) => s.inventory.herbs.ninglu_cao);
    await c.page.locator('.card', { hasText: '聚灵丹方' }).first().getByRole('button', { name: '炼制' }).click();
    const pills1 = await ev(c, (a, g, s) => (s.inventory.pills.juling_dan || [0, 0, 0, 0]).reduce((x, y) => x + y, 0));
    const herb1 = await ev(c, (a, g, s) => s.inventory.herbs.ninglu_cao);
    check(herb1 === herb0 - 2, `炼制应消耗 2 凝露草：${herb0} -> ${herb1}`);
    if (pills1 > pills0) { ok++; await expectToast(c, /丹成/); } else { fail++; await expectToast(c, /炉火失控/); }
    await sleep(150);
  }
  notes.push(`06 炼丹 6 次：成功 ${ok}，失败 ${fail}`);
  check(ok + fail === 6, '炼制结果统计异常');
  await shot(c, '06-alchemy-done');
  // 材料耗尽后应禁用
  await setup(c, (a, g, s) => { s.inventory.herbs.ninglu_cao = 1; });
  check(await c.page.locator('.card', { hasText: '聚灵丹方' }).first().getByRole('button', { name: '炼制' }).isDisabled(), '材料不足时「炼制」应禁用');
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

test('07 渡劫：炼气后期灵气满，渡劫界面出现并完成', async () => {
  const c = await newCtx();
  await startGame(c);
  await setup(c, (a, g, s) => { s.stage = 2; s.qi = 0; });
  await c.page.locator('.topbar .realm', { hasText: '炼气后期' }).waitFor();
  const dj = c.page.locator('.panel-wrap').getByRole('button', { name: '渡劫', exact: true });
  await dj.waitFor();
  check(await dj.isDisabled(), '灵气不足时「渡劫」应禁用');
  await shot(c, '07-trib-locked');
  await ev(c, (a, g, s) => { const cost = g.view().realm.qiCost; let n = 0; while (s.qi < cost && n++ < 800) g.advance(600); });
  await c.page.waitForFunction(() => { const b = [...document.querySelectorAll('.panel-wrap .seal-btn')].find((x) => x.textContent === '渡劫'); return b && !b.disabled; }, null, { timeout: 5000 });
  await shot(c, '07-trib-ready');
  const stage0 = await ev(c, (a, g, s) => s.stage);
  await dj.click();
  // 渡劫界面：弹窗或带 trib/jie 字样的覆盖层
  let seen = false, clicked = [];
  const t0 = Date.now();
  let shotDone = 0;
  while (Date.now() - t0 < 60000) {
    const done = await ev(c, (a, g, s) => s.counters.tribulations);
    const overlay = await c.page.evaluate(() => {
      const m = document.querySelector('.modal-mask');
      const t = document.querySelector('[class*=trib], [id*=trib]');
      return { modal: !!m, trib: !!t, text: m ? m.textContent.slice(0, 80) : '' };
    });
    if (overlay.modal || overlay.trib) {
      seen = true;
      if (shotDone < 3) { await shot(c, `07-trib-ui-${shotDone++}`); }
      const btns = c.page.locator('.modal-mask button:not([disabled]), [class*=trib] button:not([disabled])');
      if (await btns.count()) {
        const first = btns.first();
        const txt = (await first.textContent()).trim();
        clicked.push(txt);
        await first.click().catch(() => {});
      }
    } else if (done >= 1) break;
    else {
      const ts = await toastText(c);
      if (ts.some((t) => /尚未开启/.test(t))) throw new Fail(`点击「渡劫」仅提示“${ts.join('|')}”，渡劫界面（app.openTribulation）未实现`);
    }
    await sleep(400);
  }
  check(seen, '点击「渡劫」后未出现渡劫界面（无弹窗/无 trib 元素）');
  await c.page.waitForFunction(() => !document.querySelector('.modal-mask'), null, { timeout: 15000 }).catch(() => { throw new Fail(`渡劫界面未能关闭，已点击按钮：${clicked.join(',')}`); });
  const res = await ev(c, (a, g, s) => ({ stage: s.stage, trib: s.counters.tribulations, fails: s.counters.tribulationFails, ending: s.ending }));
  check(res.trib === 1, `渡劫次数应为 1：${JSON.stringify(res)}`);
  const realm = await realmText(c);
  if (res.fails === 0) check(res.stage === stage0 + 1 && realm.includes('筑基前期'), `渡劫成功后顶栏应为筑基前期，实为 ${realm}`);
  else check(res.stage === stage0 && !!res, `渡劫失败境界不应变化：${JSON.stringify(res)}`);
  notes.push(`07 渡劫结果：${res.fails ? '失败' : '成功'}，顶栏 ${realm}，点击序列 ${clicked.join('>')}`);
  await shot(c, '07-trib-after');
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

test('08 存档：刷新读档一致；离线 2 小时出关卷轴', async () => {
  const c = await newCtx();
  // 离线时间偏移钩子：下次导航时把存档 lastSeen 前移
  await c.context.addInitScript(() => {
    const k = localStorage.getItem('__qa_shift');
    if (k) {
      localStorage.removeItem('__qa_shift');
      const raw = localStorage.getItem('minglan_save_v1');
      if (raw) { const o = JSON.parse(raw); o.state.time.lastSeen -= Number(k); localStorage.setItem('minglan_save_v1', JSON.stringify(o)); }
    }
  });
  await startGame(c, '存档君');
  await setup(c, (a, g, s) => { s.inventory.stones = 777; s.stage = 1; s.inventory.herbs.ninglu_cao = 3; });
  await ev(c, (a, g) => { g.advance(1200); });
  await nav(c, '设置');
  await c.page.getByRole('button', { name: '立即存档' }).click();
  await expectToast(c, /已存档/);
  const snap = await ev(c, (a, g, s) => ({ name: s.player.name, stage: s.stage, stones: s.inventory.stones, qi: Math.floor(s.qi), age: Math.floor(s.player.age * 10), roots: s.player.roots.join(), herbs: s.inventory.herbs.ninglu_cao }));
  await c.page.reload();
  await c.page.waitForFunction(() => !!window.__minglan);
  await sleep(300);
  check(await c.page.locator('.modal-mask').count() === 0, '刷新后不应再弹出开局卷轴/出关卷轴');
  const snap2 = await ev(c, (a, g, s) => ({ name: s.player.name, stage: s.stage, stones: s.inventory.stones, qi: Math.floor(s.qi), age: Math.floor(s.player.age * 10), roots: s.player.roots.join(), herbs: s.inventory.herbs.ninglu_cao }));
  check(snap.name === snap2.name && snap.stage === snap2.stage && snap.stones === snap2.stones && snap.roots === snap2.roots && snap.herbs === snap2.herbs, `读档不一致：${JSON.stringify(snap)} vs ${JSON.stringify(snap2)}`);
  check(Math.abs(snap.qi - snap2.qi) <= Math.max(5, snap.qi * 0.05), `读档灵气偏差过大 ${snap.qi} vs ${snap2.qi}`);
  check((await realmText(c)).includes('炼气中期'), '读档后顶栏境界应为炼气中期');
  check((await c.page.locator('.topbar').textContent()).includes('777'), '读档后顶栏灵石应为 777');
  await shot(c, '08-reload');
  // 离线 2 小时
  const qiBefore = await ev(c, (a, g, s) => s.qi);
  await c.page.evaluate(() => localStorage.setItem('__qa_shift', String(2 * 3600 * 1000)));
  await c.page.reload();
  await c.page.waitForFunction(() => !!window.__minglan);
  const modal = c.page.locator('.modal-mask .modal');
  await modal.waitFor({ timeout: 5000 });
  const title = await modal.locator('.scroll-title').textContent();
  check(title.includes('出关'), `离线弹窗标题应为「出关」：${title}`);
  const body = await modal.textContent();
  check(/2 小时/.test(body), `出关卷轴应提到 2 小时：${body}`);
  check(/灵气/.test(body), `出关卷轴应提到灵气：${body}`);
  await shot(c, '08-offline');
  const qiAfter = await ev(c, (a, g, s) => s.qi);
  check(qiAfter > qiBefore, `离线后灵气应增加 ${qiBefore} -> ${qiAfter}`);
  await modal.getByRole('button', { name: '知晓' }).click();
  await c.page.waitForFunction(() => !document.querySelector('.modal-mask'));
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

test('09 设置：特效档位、导出导入、重置', async () => {
  const c = await newCtx();
  await startGame(c);
  await nav(c, '设置');
  await shot(c, '09-settings');
  for (const [label, key] of [['简（low）', 'low'], ['繁（high）', 'high'], ['中（mid）', 'mid']]) {
    await section(c, '特效').getByRole('button', { name: label }).click();
    const q = await ev(c, (a) => a.settings.quality);
    check(q === key, `档位应为 ${key}，实为 ${q}`);
    check(await section(c, '特效').getByRole('button', { name: label }).evaluate((b) => b.classList.contains('on')), `档位按钮 ${label} 未高亮`);
    const stored = await c.page.evaluate(() => JSON.parse(localStorage.getItem('minglan_settings')).quality);
    check(stored === key, `档位未持久化：${stored}`);
    await sleep(300);
  }
  // 导出
  await setup(c, (a, g, s) => { s.inventory.stones = 4321; });
  await c.page.getByRole('button', { name: '导出', exact: true }).click();
  const text = await c.page.locator('textarea').inputValue();
  check(text.startsWith('MLWD1:') && text.length > 100, `导出文本异常：${text.slice(0, 30)}`);
  // 改变状态后导入，应回到导出时的状态
  await setup(c, (a, g, s) => { s.inventory.stones = 1; });
  await c.page.locator('textarea').fill(text);
  await c.page.getByRole('button', { name: '导入', exact: true }).click();
  await expectToast(c, /存档已导入/);
  check(await ev(c, (a, g, s) => s.inventory.stones) === 4321, '导入后灵石应为 4321');
  // 非法导入
  await c.page.locator('textarea').fill('garbage');
  await c.page.getByRole('button', { name: '导入', exact: true }).click();
  await expectToast(c, /无法识别/);
  await shot(c, '09-settings-import');
  // 重置
  await c.page.getByRole('button', { name: '重置', exact: true }).click();
  const modal = c.page.locator('.modal-mask .modal');
  await modal.waitFor();
  await shot(c, '09-reset-confirm');
  await modal.getByRole('button', { name: '再想想' }).click();
  check(await c.page.locator('.modal-mask').count() === 0, '「再想想」应关闭确认框');
  check(await ev(c, (a, g, s) => s.inventory.stones) === 4321, '取消重置不应改变状态');
  await c.page.getByRole('button', { name: '重置', exact: true }).click();
  await Promise.all([c.page.waitForEvent('load'), c.page.locator('.modal-mask').getByRole('button', { name: '确定重置' }).click()]);
  await c.page.waitForFunction(() => !!window.__minglan);
  await c.page.locator('.modal-mask .scroll-title', { hasText: '溟岚问道' }).waitFor({ timeout: 5000 });
  const saved = await c.page.evaluate(() => localStorage.getItem('minglan_save_v1'));
  check(saved == null, '重置后存档应被清除');
  await shot(c, '09-after-reset');
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

test('10 结局：寿元耗尽、结局卷轴、转世重修', async () => {
  const c = await newCtx();
  await startGame(c, '轮回客');
  await setup(c, (a, g, s) => { s.player.age = g.view().lifespan - 0.0005; });
  await ev(c, (a, g) => { g.advance(60); });
  const modal = c.page.locator('.modal-mask .modal');
  await modal.waitFor({ timeout: 5000 });
  const title = await modal.locator('.scroll-title').textContent();
  check(title.trim().length > 0, '结局卷轴无标题');
  const paras = await modal.locator('p').allTextContents();
  check(paras.join('').length > 10, '结局卷轴无正文');
  await shot(c, '10-ending');
  await c.page.keyboard.press('Escape');
  check(await c.page.locator('.modal-mask').count() === 1, '结局卷轴不应可被 Esc 关闭');
  // 结局后修炼页不应还能破关
  await modal.getByRole('button', { name: '转世重修' }).click();
  await c.page.waitForFunction(() => !document.querySelector('.modal-mask'));
  const r = await ev(c, (a, g, s) => ({ ending: s.ending, lives: s.legacy.lives, age: s.player.age, stage: s.stage, name: s.player.name, stones: s.inventory.stones }));
  check(r.ending == null && r.lives === 1 && r.stage === 0 && r.age === 16, `转世后状态异常：${JSON.stringify(r)}`);
  check(r.name === '轮回客', '转世应保留道号');
  check((await realmText(c)).includes('炼气前期'), '转世后顶栏应为炼气前期');
  await expectToast(c, /轮回/);
  await sleep(400);
  const txt = await c.page.locator('.panel-wrap').textContent();
  check(/第 2 世/.test(txt), '转世后修炼页应显示「第 2 世」传承信息');
  await shot(c, '10-rebirth');
  // 转世后继续修炼
  const q0 = await ev(c, (a, g, s) => s.qi);
  await sleep(1200);
  check(await ev(c, (a, g, s) => s.qi) > q0, '转世后灵气不再增长');
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

for (const [vname, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  test(`11 视口 ${vname} ${viewport.width}x${viewport.height}：无溢出、遮挡、横向滚动条`, async () => {
    const c = await newCtx({ viewport });
    await startGame(c);
    await setup(c, (a, g, s) => { s.inventory.stones = 2000; s.inventory.herbs.ninglu_cao = 5; s.inventory.pills.juling_dan = [1, 1, 0, 0]; s.techniques.owned.duanhong_jian = 1; });
    const probs = [];
    const pages = ['修炼', '功法', '炼丹', '历练', '背包', '设置'];
    for (const p of pages) {
      await nav(c, p);
      await sleep(500);
      await shot(c, `11-${vname}-${p}`);
      probs.push(...await layoutProblems(c.page, `${vname}/${p}`));
    }
    // 历练回放中
    await nav(c, '历练');
    await c.page.locator('.card', { hasText: '雾栖谷' }).first().getByRole('button', { name: '入秘境' }).click();
    await c.page.getByRole('button', { name: '跳过' }).waitFor();
    await sleep(2500);
    await shot(c, `11-${vname}-replay`);
    probs.push(...await layoutProblems(c.page, `${vname}/回放`));
    await c.page.getByRole('button', { name: '跳过' }).click();
    await c.page.locator('.modal-mask .modal').waitFor({ timeout: 5000 });
    await sleep(500);
    await shot(c, `11-${vname}-settle`);
    probs.push(...await layoutProblems(c.page, `${vname}/结算卷轴`));
    await c.page.getByRole('button', { name: '收卷' }).click();
    // 开局卷轴
    const c2 = await newCtx({ viewport });
    await open(c2);
    await c2.page.locator('.modal-mask .modal').waitFor();
    await sleep(500);
    await shot(c2, `11-${vname}-intro`);
    probs.push(...await layoutProblems(c2.page, `${vname}/开局卷轴`));
    await c2.context.close();
    check(c.errors.length === 0, c.errors.join('\n'));
    await c.context.close();
    check(probs.length === 0, '布局问题：\n  ' + probs.join('\n  '));
  });
}

test('12 性能：主界面运行 5 秒记录帧率', async () => {
  const c = await newCtx();
  await startGame(c);
  await sleep(500);
  const fps = await c.page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now(); let worst = 0, last = t0;
    const f = (t) => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < 5000) requestAnimationFrame(f); else res({ fps: n / ((t - t0) / 1000), worstMs: worst }); };
    requestAnimationFrame(f);
  }));
  notes.push(`12 帧率（headless Chromium，软件渲染）：${fps.fps.toFixed(1)} fps，最长帧 ${fps.worstMs.toFixed(0)} ms，档位 ${await ev(c, (a) => a.settings.quality)}`);
  await shot(c, '12-perf');
  check(fps.fps >= 12, `帧率过低：${fps.fps.toFixed(1)} fps`);
  check(c.errors.length === 0, c.errors.join('\n'));
  await c.context.close();
});

// ---------- 主流程 ----------
const only = process.argv[2];
let server;
let failed = 0;
try {
  server = await startServer();
  browser = await chromium.launch();
  for (const cs of cases) {
    if (only && !cs.name.startsWith(only)) continue;
    const t0 = Date.now();
    try {
      await cs.fn();
      console.log(`  通过  ${cs.name}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (e) {
      failed++;
      console.log(`  失败  ${cs.name}\n        ${String(e.message || e).split('\n').join('\n        ')}`);
      if (!(e instanceof Fail)) console.log(e.stack?.split('\n').slice(1, 4).join('\n'));
    }
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill();
}
for (const n of notes) console.log('  备注  ' + n);
console.log(`\n截图目录：${SHOT_DIR}`);
console.log(failed ? `E2E 失败：${failed} 个用例未通过` : 'E2E 全部通过');
process.exit(failed ? 1 : 0);

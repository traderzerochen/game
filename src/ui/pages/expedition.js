// 历练页：秘境列表（冷却、境界要求）、战报逐步回放（日志 + 血条）、结算卷轴、战斗丹药规则
import { h, btn, sealButton, inkBar } from '../dom.js';
import { fmtClock, fmtInt, fmtPct, reasonText } from '../format.js';
import * as Icons from '../../art/icons.js';
import { silhouetteSVG } from '../../art/silhouette.js';

const { enemyPortrait, herbIcon, pillIcon, treasureIcon, techniqueIcon, placeholderIcon } = Icons;
/** 灵石图标：优先用 art-assets 的 stoneIcon，未提供时退回占位 */
const stoneSVG = (variant) => (Icons.stoneIcon ? Icons.stoneIcon({ variant })
  : placeholderIcon({ label: variant === 'dup' ? '折' : '石', color: variant === 'dup' ? PALETTE.ink2 : PALETTE.azurite, shape: 'circle', seed: variant }));
/** 玩家头像：持剑修士剪影半身 */
const playerPortrait = () => silhouetteSVG('humanoid', { variant: 'sword', seed: 'player', crop: 'bust', size: 64, ink: PALETTE.ink1, accent: PALETTE.azurite });
import { PALETTE, QUALITY_NAMES } from '../../art/palette.js';

const STEP_MS = 1100;
const EV_MS = 520;

/** 回放模型（模块级，切页后继续推进，回来时按进度重建 DOM） */
let replay = null;
let dom = null;

function busy() {
  return !!replay && !replay.done;
}

// ---------- 时间线 ----------
function buildTimeline(report, data) {
  const tl = [];
  let hp = report.hpStart;
  const maxHp = report.maxHp;
  report.steps.forEach((s, i) => {
    const isBoss = s.type === 'boss' || s.kind === 'boss';
    tl.push({ t: 'step', text: `第 ${i + 1} 程 · ${isBoss ? '首领 ' : ''}${s.name}`, boss: isBoss });
    if (s.text) tl.push({ t: 'line', text: s.text, cls: s.passed === false ? 'bad' : '' });
    if (s.battle) {
      const b = s.battle;
      const enemy = data.byId.enemies.get(b.enemyId);
      tl.push({ t: 'battle', enemy, name: b.name || enemy?.name, pMax: b.playerMaxHp || maxHp, eMax: b.enemyMaxHp || enemy?.stats?.hp || 1, pHp: hp });
      for (const ev of b.log || []) tl.push({ t: 'ev', ev, ename: b.name || enemy?.name });
      const w = b.winner;
      tl.push({ t: 'battleEnd', winner: w, text: w === 'player' ? `${b.name || enemy?.name}伏诛。` : w === 'enemy' ? '你力竭败退……' : '久战不下，你且战且退。', cls: w === 'player' ? 'good' : 'bad' });
    }
    for (const g of s.gains || []) tl.push({ t: 'line', text: gainText(g, data), cls: g.kind === 'treasure' || g.kind === 'technique' ? 'rare' : 'good' });
    const after = Number.isFinite(s.hpAfter) ? s.hpAfter : s.hp;
    if (Number.isFinite(after) && after !== hp && !s.battle) {
      const d = Math.round(after - hp);
      tl.push({ t: 'line', text: d < 0 ? `气血 −${-d}` : `气血 +${d}`, cls: d < 0 ? 'bad' : 'good' });
    }
    if (Number.isFinite(after)) { hp = after; tl.push({ t: 'hp', hp, max: maxHp }); }
  });
  tl.push({ t: 'end' });
  return tl;
}

function gainText(g, data) {
  const n = g.count ?? 1;
  switch (g.kind) {
    case 'stones': return `获得灵石 ${fmtInt(n)}`;
    case 'qi': return `灵气 +${fmtInt(n)}`;
    case 'herb': return `采得${data.byId.herbs.get(g.id)?.name || g.id} ×${n}`;
    case 'pill': return `得${data.byId.pills.get(g.id)?.name || g.id} ×${n}`;
    case 'treasure': return g.dup ? `又见${data.byId.treasures.get(g.id)?.name || g.id}，折作灵石` : `获得法宝「${data.byId.treasures.get(g.id)?.name || g.id}」`;
    case 'technique': return g.dup ? `又见${data.byId.techniques.get(g.id)?.name || g.id}，折作灵石` : `参得功法「${data.byId.techniques.get(g.id)?.name || g.id}」`;
    default: return `${g.kind} ×${n}`;
  }
}

function evText(ev, ename) {
  const who = ev.actor === 'player' ? '你' : ename;
  let s;
  if (ev.action === 'pill') s = `${who}服下${ev.name}`;
  else if (ev.action === 'skill') s = `${who}施展「${ev.name}」`;
  else s = `${who}出手${ev.name && ev.name !== '普通攻击' ? `「${ev.name}」` : ''}`;
  if (ev.dmg != null) s += `，造成 ${fmtInt(ev.dmg)} 点伤害`;
  if (ev.crit) s += '（会心）';
  if (ev.mult > 1.05) s += '，五行相克！';
  else if (ev.mult && ev.mult < 0.95 && ev.dmg != null) s += '，为五行所制';
  if (ev.heal) s += `，回复 ${fmtInt(ev.heal)}`;
  if (ev.shield) s += `，护盾 ${fmtInt(ev.shield)}`;
  return s;
}

// ---------- 回放驱动 ----------
function startReplay(app, report) {
  const dg = app.data.byId.dungeons.get(report.dungeonId);
  replay = {
    report, dungeon: dg,
    tl: buildTimeline(report, app.data),
    i: 0, lines: [], fighter: null, hp: report.hpStart, maxHp: report.maxHp, done: false, timer: 0, app,
    playerEl: app.data.byId.techniques.get(app.game.state.techniques.equipped.heart)?.element || 'none',
  };
  app.stage.setScene(dg?.scene || 'mist_valley', dg?.name);
  app.replaying = true; // 回放期间暂缓刷新日志，避免剧透结果
  schedule(0);
}

function schedule(ms) {
  clearTimeout(replay.timer);
  replay.timer = setTimeout(stepReplay, ms);
}

function speed() {
  return replay?.app?.settings?.replaySpeed || 1;
}

function stepReplay() {
  if (!replay || replay.done) return;
  const item = replay.tl[replay.i++];
  if (!item) return finish();
  const delay = apply(item);
  paint();
  if (item.t === 'end') return finish();
  schedule(delay / speed());
}

function apply(item, quiet = false) {
  const R = replay;
  switch (item.t) {
    case 'step': R.lines.push({ cls: 'step', text: item.text }); R.fighter = null; return STEP_MS * 0.6;
    case 'line': R.lines.push({ cls: item.cls || '', text: item.text }); return STEP_MS * 0.5;
    case 'battle':
      R.fighter = { enemy: item.enemy, name: item.name, pHp: item.pHp, pMax: item.pMax, eHp: item.eMax, eMax: item.eMax, hit: null };
      R.lines.push({ cls: '', text: `${item.name}拦住去路！` });
      if (item.enemy) R.app.stage.setEnemy(item.enemy);
      return STEP_MS * 0.6;
    case 'ev': {
      const ev = item.ev;
      if (R.fighter) {
        if (Number.isFinite(ev.hpA)) R.fighter.pHp = ev.hpA;
        if (Number.isFinite(ev.hpB)) R.fighter.eHp = ev.hpB;
        R.fighter.hit = ev.dmg != null ? (ev.actor === 'player' ? 'enemy' : 'player') : null;
      }
      R.lines.push({ cls: ev.crit ? 'crit' : ev.heal ? 'heal' : '', text: evText(ev, item.ename) });
      if (!quiet) {
        R.app.stage.strike(ev, R.playerEl);
        if (ev.crit || (ev.actor === 'player' && ev.action === 'skill')) R.app.audio?.play('sword');
      }
      return EV_MS;
    }
    case 'battleEnd':
      R.lines.push({ cls: item.cls, text: item.text });
      if (R.fighter) R.fighter.hit = null;
      if (!quiet) R.app.audio?.play(item.winner === 'player' ? 'battle:win' : 'battle:lose');
      setTimeout(() => { if (replay === R && !R.done) R.app.stage.setEnemy(null); }, 500);
      return STEP_MS * 0.7;
    case 'hp': R.hp = item.hp; return 0;
    default: return 0;
  }
}

function skipAll() {
  if (!replay || replay.done) return;
  clearTimeout(replay.timer);
  while (replay.i < replay.tl.length) {
    const it = replay.tl[replay.i++];
    if (it.t === 'end') break;
    apply(it, true);
  }
  paint();
  finish();
}

function finish() {
  if (!replay || replay.done) return;
  replay.done = true;
  clearTimeout(replay.timer);
  paint();
  const app = replay.app;
  const rep = replay.report;
  setTimeout(() => {
    app.replaying = false;
    app.stage.setScene('home');
    showSettlement(app, rep);
    app.forceRefresh();
  }, 500 / speed());
}

// ---------- 结算卷轴 ----------
function showSettlement(app, rep) {
  const { data } = app;
  const items = [];
  const g = rep.gains || {};
  if (g.stones) items.push({ svg: stoneSVG('stone'), nm: '灵石', n: g.stones });
  if (rep.dupStones) items.push({ svg: stoneSVG('dup'), nm: '折价灵石', n: rep.dupStones });
  for (const [id, n] of Object.entries(g.herbs || {})) { const hb = data.byId.herbs.get(id); items.push({ svg: herbIcon(hb), nm: hb?.name || id, n }); }
  for (const p of g.pills || []) { const pid = p.pillId || p.id; const pl = data.byId.pills.get(pid); items.push({ svg: pillIcon(pl, p.q || 0), nm: `${QUALITY_NAMES[p.q || 0]}${pl?.name || pid}`, n: p.count || 1 }); }
  for (const id of g.treasures || []) { const t = data.byId.treasures.get(id); items.push({ svg: treasureIcon(t), nm: t?.name || id, n: 1, rare: true }); }
  for (const id of g.techniques || []) { const t = data.byId.techniques.get(id); items.push({ svg: techniqueIcon(t), nm: t?.name || id, n: 1, rare: true }); }
  const title = rep.cleared ? `${rep.name} · 通关` : rep.defeated ? `${rep.name} · 败退` : `${rep.name} · 归来`;
  openSettle();
  function openSettle() {
    app.openModal({
      title,
      body: h('div', {},
        h('p', { class: 'noindent', text: rep.cleared ? '首领伏诛，秘境暂归平静。' : rep.defeated ? '你负伤而归，灵石散落大半。需静养三百息。' : '你见势不妙，全身而退。' }),
        h('p', { class: 'noindent small muted', text: `气血 ${fmtInt(rep.hpEnd)} / ${fmtInt(rep.maxHp)}` }),
        items.length
          ? h('div', { class: 'grid-items' }, items.map((it) => h('div', { class: `item ${it.rare ? 'rare' : ''}` }, h('div', { html: it.svg }), h('div', { class: 'nm', text: it.nm }), h('div', { class: 'cnt', text: `×${fmtInt(it.n)}` }))))
          : h('p', { class: 'noindent muted', text: '此行空手而归。' })),
      actions: [{ text: '收卷' }],
    });
  }
}

// ---------- 渲染 ----------
function render(el, app) {
  dom = null;
  if (replay && !replay.done) return renderReplay(el, app);
  replay = null;
  renderList(el, app);
}

function renderList(el, app) {
  const { game, data } = app;
  const st = game.state;
  el.appendChild(h('div', { class: 'desc', text: data.texts.empty?.expedition || '' }));
  const box = h('div', { class: 'section' }, h('h3', { text: '秘境' }));
  const countdowns = [];
  const dgs = [...data.dungeons].sort((a, b) => (a.realmReq || 0) - (b.realmReq || 0));
  for (const d of dgs) {
    const can = game.canEnter(d.id);
    const realm = data.realm ? data.realm(d.realmReq || 0) : data.realms[d.realmReq || 0];
    const boss = data.byId.enemies.get(d.boss);
    const locked = can.reason === 'realm_too_low';
    const cleared = st.expeditions.cleared?.[d.id] || 0;
    const b = sealButton('入秘境', () => {
      const rep = game.startExpedition(d.id);
      if (!rep || rep.ok === false) { app.toast(reasonText(rep?.reason), 'bad'); app.forceRefresh(); return; }
      startReplay(app, rep);
      app.forceRefresh();
    }, { disabled: !can.ok });
    const cd = h('div', { class: 'small muted' });
    countdowns.push({ d, cd, b });
    el.appendChild(box);
    box.appendChild(h('div', { class: `card ${locked ? 'locked' : ''}` },
      h('div', { class: 'icon-box', html: enemyPortrait(boss) }),
      h('div', { class: 'body' },
        h('div', { class: 'name' }, d.name, ' ', h('span', { class: 'small muted', text: cleared ? `已通关 ${cleared} 次` : '' })),
        h('div', { class: 'meta', text: `需 ${realm?.name || '—'} · ${d.steps} 程 · 首领 ${boss?.name || '—'} · 冷却 ${fmtClock(d.cooldown)}` }),
        h('div', { class: 'desc', text: d.desc })),
      h('div', { class: 'actions' }, b, cd)));
  }
  dom = { countdowns };
  updateCountdowns(app);

  // 丹药规则
  el.appendChild(renderPillRules(app));
}

function renderPillRules(app) {
  const { game, data } = app;
  const rules = (game.state.battleConfig?.pillRules || []).map((r) => ({ ...r }));
  const pills = data.pills.filter((p) => p.effect && (p.effect.type === 'heal' || p.effect.type === 'mp'));
  const box = h('div', { class: 'section' }, h('h3', {}, '战斗用药 ', h('span', { class: 'muted', text: '气血/灵力低于阈值时自动服用，先用低品，每战至多三枚' })));
  const commit = () => {
    const r = game.setPillRules(rules);
    if (!r.ok) app.toast(reasonText(r.reason), 'bad');
    app.forceRefresh();
  };
  const owned = (pid) => (game.state.inventory.pills?.[pid] || []).reduce((a, b) => a + (b || 0), 0);
  rules.forEach((r, i) => {
    const pill = data.byId.pills.get(r.pillId);
    const sel = h('select', { onchange: (e) => { r.below = Number(e.target.value); commit(); } },
      [0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((v) => h('option', { value: v, selected: Math.abs(v - r.below) < 1e-6, text: fmtPct(v) })));
    box.appendChild(h('div', { class: 'row', style: { margin: '4px 0' } },
      h('span', { html: pillIcon(pill, 0, { size: 24 }) }),
      h('span', { class: 'kai', text: pill?.name || r.pillId }),
      h('span', { class: 'small muted', text: `（持有 ${owned(r.pillId)}）${pill?.effect?.type === 'mp' ? '灵力' : '气血'}低于` }),
      sel,
      h('span', { class: 'spacer' }),
      btn('移除', () => { rules.splice(i, 1); commit(); }, { cls: 'small' })));
  });
  const avail = pills.filter((p) => !rules.some((r) => r.pillId === p.id));
  if (avail.length) {
    const sel = h('select', {}, avail.map((p) => h('option', { value: p.id, text: `${p.name}（持有 ${owned(p.id)}）` })));
    box.appendChild(h('div', { class: 'row', style: { marginTop: '6px' } }, sel,
      btn('添加规则', () => { rules.push({ pillId: sel.value, below: 0.4 }); commit(); }, { cls: 'small' })));
  } else if (!pills.length) box.appendChild(h('div', { class: 'desc', text: '尚无可用于战斗的丹药。' }));
  return box;
}

function updateCountdowns(app) {
  if (!dom?.countdowns) return;
  for (const c of dom.countdowns) {
    if (!c.cd.isConnected) return;
    const can = app.game.canEnter(c.d.id);
    c.b.disabled = !can.ok;
    c.cd.textContent = can.ok ? '' : can.reason === 'cooldown' ? `恢复中 ${fmtClock(can.readyIn)}` : reasonText(can.reason);
  }
}

function renderReplay(el, app) {
  const R = replay;
  const pBar = inkBar(0, { cls: 'hp' });
  const eBar = inkBar(0, { cls: 'hp' });
  const expBar = inkBar(0, { cls: 'hp thin' });
  const pBox = h('div', { class: 'fighter' }, h('div', { class: 'icon-box', html: playerPortrait() }), h('div', { class: 'info' }, h('div', { class: 'kai', text: app.game.state.player.name || '你' }), pBar));
  const eIcon = h('div', { class: 'icon-box' });
  const eName = h('div', { class: 'kai' });
  const eBox = h('div', { class: 'fighter right' }, eIcon, h('div', { class: 'info' }, eName, eBar));
  const fighters = h('div', { class: 'fighters' }, pBox, h('div', { class: 'vs', text: '斗' }), eBox);
  const logBox = h('div', { class: 'replay-log' });
  const spd = h('div', { class: 'radio-group' }, [1, 2, 4].map((s) => btn(`${s}×`, () => { app.settings.replaySpeed = s; app.saveSettings(); paint(); }, { cls: 'small' })));
  el.appendChild(h('div', { class: 'section' },
    h('h3', {}, R.dungeon?.name || R.report.name, ' ', h('span', { class: 'muted', text: '历练中……' })),
    h('div', { class: 'row small' }, '秘境气血', h('div', { style: { flex: 1 } }, expBar)),
    h('div', { class: 'battle-box', style: { marginTop: '8px' } }, fighters),
    logBox,
    h('div', { class: 'row', style: { marginTop: '8px' } }, '回放速度', spd, h('span', { class: 'spacer' }), btn('跳过', skipAll))));
  dom = { pBar, eBar, expBar, pBox, eBox, eIcon, eName, fighters, logBox, spd, shown: 0, lastEnemy: null };
  paint();
}

function paint() {
  if (!dom || !dom.logBox || !dom.logBox.isConnected || !replay) return;
  const R = replay;
  // 日志：增量追加
  for (; dom.shown < R.lines.length; dom.shown++) {
    const l = R.lines[dom.shown];
    dom.logBox.appendChild(h('div', { class: `ev ${l.cls}`, text: l.text }));
  }
  dom.logBox.scrollTop = dom.logBox.scrollHeight;
  dom.expBar.set(R.hp / (R.maxHp || 1), `${fmtInt(R.hp)} / ${fmtInt(R.maxHp)}`);
  const f = R.fighter;
  dom.fighters.style.visibility = f ? 'visible' : 'hidden';
  if (f) {
    if (dom.lastEnemy !== f.enemy) {
      dom.lastEnemy = f.enemy;
      dom.eIcon.innerHTML = enemyPortrait(f.enemy);
      dom.eName.textContent = f.name;
    }
    dom.pBar.set(f.pHp / (f.pMax || 1), `${fmtInt(f.pHp)}`);
    dom.eBar.set(f.eHp / (f.eMax || 1), `${fmtInt(f.eHp)}`);
    for (const [who, box] of [['player', dom.pBox], ['enemy', dom.eBox]]) {
      box.classList.remove('hit');
      if (f.hit === who) { void box.offsetWidth; box.classList.add('hit'); }
    }
  }
  [...dom.spd.children].forEach((b, i) => b.classList.toggle('on', [1, 2, 4][i] === speed()));
}

function update(app) {
  if (!busy()) updateCountdowns(app);
}

function leave() { /* 回放在后台继续，回到本页时按进度重建 */ }

export default { id: 'expedition', name: '历练', title: '历练', render, update, busy, leave };

// UI 入口（ui-art 负责）—— DESIGN.md §8
import DATA from '../data/index.js';
import { createGame } from '../core/game.js';
import { h, clear, inkBar } from './dom.js';
import { fmtNum, fmtInt, fmtDuration, fmtClock, fmtGameTime, tpl } from './format.js';
import { loadSettings, saveSettings } from './settings.js';
import { openModal, toast, setToastLayer } from './modal.js';
import { createStage } from './stage.js';
import { createQualityMonitor } from './quality.js';
import { sealSVG } from '../art/seal.js';
import { rootIcon } from '../art/icons.js';
import { tier } from '../art/tiers.js';
import { PAGES } from './pages/index.js';

const AUTOSAVE_MS = 30000;
const UPDATE_MS = 250;

function boot() {
  const root = document.getElementById('app');
  const settings = loadSettings();
  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }
  const game = createGame({ data: DATA, storage });
  const data = game.data;

  // ---------- 布局 ----------
  clear(root);
  root.className = '';
  const els = {};
  els.realm = h('div', { class: 'realm' });
  els.qiBar = inkBar(0, { cls: 'qi-bar' });
  els.qiRate = h('span', { class: 'stat' });
  els.stones = h('span', { class: 'stat' });
  els.age = h('span', { class: 'stat' });
  els.status = h('span', { class: 'stat small' });
  const topbar = h('header', { class: 'topbar' },
    h('div', { class: 'title', html: sealSVG('问道', { size: 30 }) + '<span>溟岚问道</span>' }),
    els.realm,
    h('div', { class: 'qi' }, els.qiBar),
    els.qiRate, els.stones, els.age, els.status);

  const nav = h('nav', { class: 'nav' });
  const stageEl = h('section', { class: 'stage' });
  const toastLayer = h('div', { class: 'toast-layer' });
  els.caption = h('div', { class: 'stage-caption' });
  stageEl.append(toastLayer, els.caption);
  setToastLayer(toastLayer);
  const logEl = h('section', { class: 'log' });
  els.scroll = h('div', { class: 'scroll' });
  els.panel = h('div', { class: 'scroll-body' });
  els.scroll.appendChild(els.panel);
  const panelWrap = h('aside', { class: 'panel-wrap' }, els.scroll);
  root.append(topbar, nav, stageEl, panelWrap, logEl);

  const app = {
    game, data, settings, els,
    page: null,
    stage: null,
    saveSettings: () => saveSettings(settings),
    toast,
    openModal,
    go,
    refresh: scheduleRefresh,
    forceRefresh: () => renderPage(true),
    save: () => game.save(),
  };

  // ---------- 舞台与档位 ----------
  app.stage = createStage(stageEl, { getQuality: () => settings.quality });
  stageEl.insertBefore(stageEl.querySelector('canvas'), stageEl.firstChild);
  const monitor = createQualityMonitor({
    getQuality: () => settings.quality,
    setQuality: (q) => { settings.quality = q; app.saveSettings(); },
    enabled: () => settings.autoQuality && !document.hidden,
    onDowngrade: (q) => { toast(`已降低特效以保流畅（${tier(q).name}）`); if (app.page?.id === 'settings') scheduleRefresh(); },
  });
  app.quality = monitor;

  // ---------- 导航 ----------
  const slips = {};
  for (const p of PAGES) {
    const s = h('button', { class: 'slip', onclick: () => go(p.id), title: p.name }, p.name, h('span', { class: 'mark' }));
    slips[p.id] = s;
    nav.appendChild(s);
  }

  function go(id) {
    const p = PAGES.find((x) => x.id === id) || PAGES[0];
    if (app.page && app.page.leave) app.page.leave(app);
    app.page = p;
    for (const [k, s] of Object.entries(slips)) {
      s.classList.toggle('active', k === p.id);
      s.querySelector('.mark').innerHTML = k === p.id ? sealSVG('岚', { size: 16 }) : '';
    }
    els.scroll.classList.remove('unroll');
    void els.scroll.offsetWidth;
    els.scroll.classList.add('unroll');
    renderPage(true);
    els.panel.scrollTop = 0;
  }

  function renderPage(force = false) {
    const p = app.page;
    if (!p) return;
    if (!force && p.busy && p.busy(app)) { p.update && p.update(app); return; }
    const top = els.panel.scrollTop;
    clear(els.panel);
    els.panel.appendChild(h('div', { class: 'scroll-title' }, p.title || p.name));
    p.render(els.panel, app);
    els.panel.scrollTop = top;
  }

  let refreshPending = false;
  function scheduleRefresh() {
    if (refreshPending) return;
    refreshPending = true;
    setTimeout(() => { refreshPending = false; renderPage(); }, 30);
  }

  // ---------- 顶栏、日志 ----------
  let lastLogRef = null, lastLogLen = -1;
  function updateTop() {
    const v = game.view();
    els.realm.textContent = v.realm?.name || '';
    const cost = v.realm?.qiCost || 1;
    els.qiBar.set(v.qi / cost, `灵气 ${fmtNum(v.qi)} / ${fmtNum(cost)}`);
    els.qiBar.title = `灵气上限 ${fmtNum(v.qiCap)}`;
    els.qiRate.innerHTML = `吐纳 <b>${fmtNum(v.qiRate)}</b>/息`;
    els.stones.innerHTML = `灵石 <b>${fmtInt(v.stones)}</b>`;
    els.age.innerHTML = `寿元 <b>${Math.floor(v.age)}</b> / ${Math.floor(v.lifespan)}`;
    const st = [];
    if (v.injured) st.push(`<span class="bad">负伤 ${fmtClock(v.injuryLeft)}</span>`);
    if (v.buffs && v.buffs.length) st.push(`<span class="good">丹力 +${Math.round(v.buffs.reduce((a, b) => a + (b.value || 0), 0) * 100)}%</span>`);
    els.status.innerHTML = st.join(' ');
    els.caption.textContent = app.stage.scene === 'home' ? (v.ending ? '此世已了' : v.injured ? '调息疗伤中……' : '静坐吐纳，引岚气入体') : '';
    // 日志
    const log = game.state.log || [];
    const last = log[log.length - 1];
    if (!app.replaying && (last !== lastLogRef || log.length !== lastLogLen)) {
      lastLogRef = last; lastLogLen = log.length;
      renderLog(log);
    }
    return v;
  }

  function renderLog(log) {
    clear(logEl);
    if (!log.length) { logEl.appendChild(h('div', { class: 'line muted', text: data.texts?.empty?.log || '' })); return; }
    const frag = document.createDocumentFragment();
    for (let i = log.length - 1; i >= Math.max(0, log.length - 60); i--) {
      const e = log[i];
      frag.appendChild(h('div', { class: `line ${e.kind || ''}` }, h('span', { class: 't', text: fmtGameTime(e.t || 0) }), e.text));
    }
    logEl.appendChild(frag);
  }

  // ---------- 总线事件 ----------
  const bus = game.bus;
  bus.on('breakthrough', (e) => {
    const realm = data.realm ? data.realm(e.to) : data.realms[e.to];
    if (e.success) { toast(tpl(data.texts.breakthrough.success, { realm: realm?.name }), 'good'); app.stage.gather(); }
    else toast(data.texts.breakthrough.fail, 'bad');
    scheduleRefresh();
  });
  for (const ev of ['realm:changed', 'technique:changed', 'item:gained', 'load', 'pill:used', 'alchemy:done']) bus.on(ev, scheduleRefresh);
  bus.on('ending', () => setTimeout(() => showEnding(), 400));
  bus.on('save', (e) => { if (!e.ok) toast('存档失败：浏览器存储不可用', 'bad'); });

  function showEnding() {
    const v = game.view();
    if (!v.ending) return;
    const ed = data.endings.find((x) => x.id === v.ending.id);
    if (app.page?.id !== 'cultivate') go('cultivate');
    openModal({
      title: ed?.name || '终局',
      dismissable: false,
      body: h('div', {}, String(ed?.text || '').split('\n').map((t) => h('p', { text: t }))),
      actions: [{ text: '转世重修', onclick: () => { const r = game.rebirth(); if (r.ok) { game.save(); toast('轮回一转，前尘如梦', 'rare'); renderPage(); } } }],
    });
  }

  // ---------- 启动流程 ----------
  const loaded = game.load();
  app.started = loaded;
  go('cultivate');
  if (!loaded) showIntro();
  else {
    const off = game.applyOffline(Date.now());
    if (off && off.seconds >= 60) {
      openModal({
        title: '出关',
        body: h('div', {},
          h('p', { text: tpl(data.texts.offline, { time: fmtDuration(off.seconds), qi: fmtNum(off.qiGained) }) }),
          off.capped ? h('p', { class: 'muted small', text: '闭关最多累计八个时辰，余者随风散去。' }) : null),
        actions: [{ text: '知晓' }],
      });
    }
    if (game.view().ending) setTimeout(showEnding, 300);
  }

  function showIntro() {
    let seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    game.newGame({ seed });
    const v = game.view();
    const nameInput = h('input', { type: 'text', value: '', placeholder: '无名', maxlength: 8, style: { width: '8em' } });
    const tierN = v.roots.length;
    openModal({
      title: data.texts.title,
      dismissable: false,
      body: h('div', {},
        (data.texts.intro || []).map((t) => h('p', { text: t })),
        h('div', { class: 'intro-roots', html: v.roots.map((r) => rootIcon(r, { size: 56 })).join('') }),
        h('p', { class: 'noindent', style: { textAlign: 'center' } }, data.texts.rootDesc?.[tierN] || v.rootTier?.name || ''),
        h('p', { class: 'noindent row', style: { justifyContent: 'center' } }, '道号：', nameInput)),
      actions: [{
        text: '踏上仙途',
        onclick: () => {
          const name = nameInput.value.trim();
          if (name) game.newGame({ seed, name });
          game.tick(Date.now());
          app.started = true;
          game.save();
          renderPage();
          toast('仙途伊始', 'rare');
        },
      }],
    });
  }

  // ---------- 主循环 ----------
  let lastFrame = performance.now();
  let lastUpdate = 0;
  function loop(now) {
    const dt = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;
    if (app.started) game.tick(Date.now());
    monitor.frame(dt);
    let v = null;
    if (now - lastUpdate >= UPDATE_MS) {
      lastUpdate = now;
      v = updateTop();
      if (app.page && app.page.update) app.page.update(app, v);
    }
    const st = game.state;
    const cost = data.realm ? data.realm(st.stage).qiCost : 1;
    app.stage.frame(dt, { qiRatio: Math.min(1, st.qi / (cost || 1)) });
    requestAnimationFrame(loop);
  }
  updateTop();
  requestAnimationFrame(loop);

  // ---------- 存档 ----------
  setInterval(() => { if (app.started) game.save(); }, AUTOSAVE_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (app.started) game.save(); }
    else { const off = game.applyOffline(Date.now()); if (off && off.seconds >= 60) toast(tpl(data.texts.offline, { time: fmtDuration(off.seconds), qi: fmtNum(off.qiGained) }), 'good'); monitor.reset(); }
  });
  window.addEventListener('pagehide', () => { if (app.started) game.save(); });

  window.__minglan = app; // 调试用
  return app;
}

try {
  boot();
} catch (e) {
  console.error(e);
  const root = document.getElementById('app');
  if (root) { root.className = 'boot'; root.textContent = `载入失败：${e?.message || e}`; }
}

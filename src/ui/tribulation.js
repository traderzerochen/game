// 渡劫界面：准备卷轴（携带丹药、服护劫丹）→ 舞台逐道播放天雷 → 结果卷轴
import { h, btn, inkBar } from './dom.js';
import { fmtInt, fmtPct, reasonText, tpl } from './format.js';
import { pillIcon } from '../art/icons.js';
import { QUALITY_NAMES } from '../art/palette.js';

const MAX_HEAL = 3;

export function openTribulation(app) {
  const { game, data } = app;
  const info = game.tribulationInfo();
  if (!info) { app.toast('此处并非大境界关口', 'bad'); return; }
  const st = game.state;
  // 可携带的回春类丹药：按品质从高到低
  const healStock = [];
  for (const p of data.pills) {
    if (p.effect?.type !== 'heal') continue;
    const arr = st.inventory.pills?.[p.id] || [];
    for (let q = 3; q >= 0; q--) if (arr[q] > 0) healStock.push({ pill: p, q, have: arr[q], take: 0 });
  }
  // 默认带上最好的 3 枚
  let left = MAX_HEAL;
  for (const s of healStock) { const n = Math.min(left, s.have); s.take = n; left -= n; }
  const tribPills = data.pills.filter((p) => p.effect?.type === 'tribulation');

  const body = h('div', {});
  const draw = () => {
    const I = game.tribulationInfo() || info;
    body.innerHTML = '';
    const add = (...xs) => body.append(...xs.filter(Boolean));
    add(
      h('p', { class: 'noindent', text: tpl(data.texts.tribulation?.start || '{name}将至。', { name: I.name }) }),
      h('dl', { class: 'kv small' },
        h('dt', { text: '天雷' }), h('dd', { text: `${I.rounds} 道 · 威能 ×${I.power}` }),
        h('dt', { text: '气血' }), h('dd', { text: fmtInt(I.hp) }),
        h('dt', { text: '减伤' }), h('dd', { text: fmtPct(I.resist) }),
        h('dt', { text: '预计雷伤' }), h('dd', { class: I.expectedDmg >= I.hp ? 'bad' : '', text: `约 ${fmtInt(I.expectedDmg)}（不计丹药）` }),
        h('dt', { text: '耗费灵气' }), h('dd', { text: fmtInt(I.cost) })),
      I.lethal ? h('p', { class: 'noindent bad small', text: '此劫凶险：若渡劫失败，有可能身死道消。佩饰的护命之力可降低陨落之险。' }) : h('p', { class: 'noindent small muted', text: '此劫不致命，失败只会重伤，并损失一半灵气。' }),
      I.isAscend ? h('p', { class: 'noindent rare', text: '此为登穹雷劫，渡过即可飞升。' }) : null,
    );
    // 护劫丹（立即服用）
    const owned = tribPills.flatMap((p) => (st.inventory.pills?.[p.id] || []).map((n, q) => ({ p, q, n })).filter((x) => x.n > 0));
    if (owned.length) {
      body.appendChild(h('h3', { class: 'kai', style: { marginTop: '10px' }, text: '护劫丹（渡劫前服下）' }));
      body.appendChild(h('div', { class: 'row' }, owned.map(({ p, q, n }) => btn(`${QUALITY_NAMES[q]}${p.name} ×${n}`, () => {
        const r = game.usePill(p.id, q);
        if (!r.ok) app.toast(reasonText(r.reason), 'bad'); else app.toast(`服下${QUALITY_NAMES[q]}${p.name}`, 'good');
        draw();
      }, { cls: 'small' }))));
      body.appendChild(h('div', { class: 'small muted', text: `已积蓄渡劫减伤 +${fmtPct(st.pending?.tribulationResist || 0)}（上限 30%）` }));
    }
    // 携带回春丹
    body.appendChild(h('h3', { class: 'kai', style: { marginTop: '10px' }, text: `随身丹药（气血过半时自动服用，至多 ${MAX_HEAL} 枚）` }));
    if (!healStock.length) body.appendChild(h('div', { class: 'small muted', text: '囊中并无回春之药。' }));
    const total = () => healStock.reduce((a, s) => a + s.take, 0);
    for (const s of healStock) {
      body.appendChild(h('div', { class: 'row small', style: { margin: '3px 0' } },
        h('span', { html: pillIcon(s.pill, s.q, { size: 24 }) }),
        h('span', { class: `kai q${s.q}`, text: `${QUALITY_NAMES[s.q]}${s.pill.name}` }),
        h('span', { class: 'muted', text: `持有 ${s.have}` }),
        h('span', { class: 'spacer' }),
        btn('−', () => { if (s.take > 0) { s.take--; draw(); } }, { cls: 'small', disabled: s.take <= 0 }),
        h('b', { text: String(s.take), style: { minWidth: '1.5em', textAlign: 'center' } }),
        btn('＋', () => { if (s.take < s.have && total() < MAX_HEAL) { s.take++; draw(); } }, { cls: 'small', disabled: s.take >= s.have || total() >= MAX_HEAL })));
    }
  };
  draw();

  app.openModal({
    title: info.name,
    body,
    actions: [
      { text: '引雷渡劫', cls: 'blue', onclick: () => start() },
      { text: '暂缓', seal: false },
    ],
  });

  function start() {
    const healPills = [];
    for (const s of healStock) for (let i = 0; i < s.take; i++) healPills.push({ pillId: s.pill.id, q: s.q });
    app.cinematic = true; // 播放期间推迟结局弹窗、暂缓日志
    app.replaying = true;
    const rep = game.tribulation({ healPills });
    if (!rep || rep.ok === false) {
      app.cinematic = false; app.replaying = false;
      app.toast(reasonText(rep?.reason), 'bad');
      return;
    }
    play(app, rep);
  }
}

/** 在舞台上逐道播放天雷 */
function play(app, rep) {
  const { data, stage } = app;
  stage.setScene('tribulation', rep.name);
  app.audio?.play('tribulation:start');
  // 舞台上的劫雷面板
  const hpBar = inkBar(1, { cls: 'hp', label: `${fmtInt(rep.maxHp)} / ${fmtInt(rep.maxHp)}` });
  const line = h('div', { class: 'trib-line' });
  const overlay = h('div', { class: 'trib-overlay' },
    h('div', { class: 'trib-title kai', text: rep.name }),
    h('div', { class: 'small', text: `减伤 ${fmtPct(rep.resist)}` }),
    hpBar, line);
  app.els.stageEl.appendChild(overlay);
  const R = rep.rounds || [];
  let i = 0;
  const speed = app.settings.replaySpeed || 1;
  const next = () => {
    if (i >= R.length) return setTimeout(done, 900 / speed);
    const r = R[i++];
    const power = 0.7 + 0.5 * (r.dmg / Math.max(1, rep.maxHp)) * R.length;
    stage.thunder(Math.min(1.6, power));
    app.audio?.play('thunder');
    line.textContent = `${tpl(data.texts.tribulation?.strike || '第{r}道天雷落下！', { r: r.r })}  −${fmtInt(r.dmg)}`;
    hpBar.set(r.hp / rep.maxHp, `${fmtInt(r.hp)} / ${fmtInt(rep.maxHp)}`);
    if (r.healed) setTimeout(() => { stage.healPulse(); line.textContent += `  服丹 +${fmtInt(r.healed)}`; }, 450 / speed);
    setTimeout(next, 1500 / speed);
  };
  setTimeout(next, 900 / speed);

  function done() {
    overlay.remove();
    app.replaying = false;
    app.cinematic = false;
    if (rep.success) {
      stage.gather();
      app.audio?.play('tribulation:success');
    }
    const toRealm = data.realm ? data.realm(rep.to) : data.realms[rep.to];
    const text = rep.success
      ? (rep.ending ? '雷云尽散，天门洞开。' : `${tpl(data.texts.tribulation?.success || '你渡过了{name}。', { name: rep.name })}晋入${toRealm?.name || ''}。`)
      : rep.death ? '天雷贯顶……' : (data.texts.tribulation?.fail || '雷劫未渡，你身受重伤。');
    setTimeout(() => {
      stage.setScene('home');
      if (rep.ending) { app.showEnding(); return; }
      app.openModal({
        title: rep.success ? '渡劫功成' : '渡劫失败',
        body: h('div', {},
          h('p', { class: 'noindent', text }),
          h('p', { class: 'noindent small muted', text: `受雷 ${R.length} 道，余气血 ${fmtInt(rep.hpEnd)} / ${fmtInt(rep.maxHp)}${rep.success ? '' : '；负伤十分钟，灵气折损一半'}` })),
        actions: [{ text: '知晓' }],
      });
      app.forceRefresh();
    }, rep.success ? 1200 : 400);
  }
}

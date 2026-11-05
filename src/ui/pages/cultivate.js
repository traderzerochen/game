// 修炼页：境界、灵气、灵根、心法、破关 / 渡劫入口、药园
import { h, inkBar, sealButton, btn } from '../dom.js';
import { fmtNum, fmtPct, fmtClock, reasonText } from '../format.js';
import { rootIcon, techniqueIcon } from '../../art/icons.js';
import { ELEMENT_NAMES } from '../../art/palette.js';

let live = null;

function render(el, app) {
  const { game, data } = app;
  const v = game.view();
  const st = game.state;
  live = {};

  // 境界
  const major = v.realm?.major;
  el.appendChild(h('div', { class: 'section' },
    h('h3', {}, v.realm?.name || '', ' ', h('span', { class: 'muted', text: v.nextRealm ? `下一境：${v.nextRealm.name}` : '已至化神之巅' })),
    h('div', { class: 'desc', text: data.texts.realmDesc?.[major] || '' })));

  // 灵气
  live.qiBar = inkBar(0);
  live.qiText = h('div', { class: 'small muted' });
  el.appendChild(h('div', { class: 'section' }, h('h3', { text: '灵气' }), live.qiBar, live.qiText));

  // 破关 / 渡劫
  const bt = v.breakthrough || {};
  live.btBox = h('div', { class: 'section' });
  el.appendChild(live.btBox);
  renderBreak(live.btBox, app, v);

  // 灵根
  el.appendChild(h('div', { class: 'section' },
    h('h3', {}, '灵根 ', h('span', { class: 'muted', text: `${v.rootTier?.name || ''} · 修炼 ×${v.rootMult}` })),
    h('div', { class: 'row', html: v.roots.map((r) => rootIcon(r, { size: 40 })).join('') }),
    h('div', { class: 'desc', text: data.texts.rootDesc?.[v.roots.length] || '' })));

  // 心法
  const heartId = st.techniques.equipped.heart;
  const heart = heartId && data.byId.techniques.get(heartId);
  const heartBox = h('div', { class: 'section' }, h('h3', { text: '心法' }));
  if (heart) {
    const aff = game.affinity(heart.id);
    heartBox.appendChild(h('div', { class: 'card equipped' },
      h('div', { class: 'icon-box', html: techniqueIcon(heart) }),
      h('div', { class: 'body' },
        h('div', { class: 'name' }, heart.name, ' ', h('span', { class: 'muted small', text: `第 ${st.techniques.owned[heart.id] || 1} 重` })),
        h('div', { class: 'meta' }, h('span', { class: `tag el-${heart.element}`, text: ELEMENT_NAMES[heart.element] || '无' }), ` 五行适配 ×${aff}`),
        h('div', { class: 'desc', text: heart.desc }))));
  } else {
    heartBox.appendChild(h('div', { class: 'desc' }, '尚未运转心法。', btn('去功法页', () => app.go('techniques'), { cls: 'small' })));
  }
  el.appendChild(heartBox);

  // 状态
  live.statusBox = h('div', { class: 'section' });
  el.appendChild(live.statusBox);

  // 药园
  live.garden = h('div', { class: 'section' });
  el.appendChild(live.garden);

  // 小贴士
  const tips = data.texts.tips || [];
  if (tips.length) el.appendChild(h('div', { class: 'section desc', text: `※ ${tips[Math.floor(st.time.played / 30) % tips.length]}` }));

  update(app, v);
}

function renderBreak(box, app, v) {
  const { game } = app;
  const bt = v.breakthrough || {};
  box.innerHTML = '';
  box.appendChild(h('h3', { text: bt.isMajor ? '大境界关口' : '破关' }));
  if (v.ending) { box.appendChild(h('div', { class: 'desc', text: '此世已了。' })); return; }
  const row = h('div', { class: 'row' });
  if (bt.isMajor) {
    const tr = v.tribulation || {};
    row.append(
      sealButton('渡劫', () => app.openTribulation(), { disabled: !tr.canAttempt, cls: 'blue' }),
      h('div', { class: 'small' },
        h('div', { text: `${tr.name || '雷劫'} · ${tr.rounds || '?'} 道天雷${tr.lethal ? ' · 凶' : ''}${tr.isAscend ? ' · 登穹' : ''}` }),
        h('div', { class: 'muted', text: tr.canAttempt ? `减伤 ${fmtPct(tr.resist)} · 预计雷伤 ${fmtNum(tr.expectedDmg)} / 气血 ${fmtNum(tr.hp)}` : `需灵气 ${fmtNum(bt.cost)}` })));
  } else {
    const b = sealButton('破关', () => {
      const r = game.breakthrough();
      if (!r.ok) app.toast(reasonText(r.reason), 'bad');
      else app.forceRefresh();
    }, { disabled: !bt.canAttempt });
    live.btBtn = b;
    live.btInfo = h('div', { class: 'small' });
    row.append(b, live.btInfo);
  }
  box.appendChild(row);
}

function update(app, v) {
  if (!live || !live.qiBar || !live.qiBar.isConnected) return;
  v = v || app.game.view();
  const cost = v.realm?.qiCost || 1;
  live.qiBar.set(v.qi / cost, `${fmtNum(v.qi)} / ${fmtNum(cost)}`);
  const full = v.qi >= cost;
  const eta = !full && v.qiRate > 0 ? (cost - v.qi) / v.qiRate : 0;
  live.qiText.textContent = `吐纳 ${fmtNum(v.qiRate)} 灵气/息 · 上限 ${fmtNum(v.qiCap)}` + (full ? ' · 灵气已足' : eta ? ` · 约 ${fmtClock(eta)} 后圆满` : '');
  const bt = v.breakthrough || {};
  if (live.btBtn) {
    live.btBtn.disabled = !bt.canAttempt;
    live.btInfo.innerHTML = `成功率 <b>${fmtPct(bt.chance)}</b><br><span class="muted">${bt.canAttempt ? `消耗灵气 ${fmtNum(bt.cost)}` : reasonText(bt.reason)}</span>`;
  }
  if (live.lastMajor !== bt.isMajor || live.lastQiOk !== full) {
    if (live.lastMajor !== undefined) renderBreak(live.btBox, app, v);
    live.lastMajor = bt.isMajor; live.lastQiOk = full;
  }
  // 状态
  const s = v.stats || {};
  const parts = [`气血 ${fmtNum(s.hp)}`, `灵力 ${fmtNum(s.mp)}`, `攻 ${fmtNum(s.atk)}`, `防 ${fmtNum(s.def)}`, `速 ${fmtNum(s.spd)}`, `会心 ${fmtPct(s.crit)}`];
  const extra = [];
  if (v.injured) extra.push(`<span class="bad">负伤：修炼减半，剩余 ${fmtClock(v.injuryLeft)}</span>`);
  for (const b of v.buffs || []) extra.push(`<span class="good">修炼 +${Math.round(b.value * 100)}%，剩余 ${fmtClock(b.until - v.played)}</span>`);
  const pend = app.game.state.pending || {};
  if (pend.breakthroughBonus) extra.push(`<span class="good">破关加成 +${fmtPct(pend.breakthroughBonus)}</span>`);
  if (pend.tribulationResist) extra.push(`<span class="good">渡劫减伤 +${fmtPct(pend.tribulationResist)}</span>`);
  if (v.legacy?.lives) extra.push(`<span class="rare">第 ${v.legacy.lives + 1} 世 · 传承修炼 +${fmtPct(v.legacy.qiBonus)}</span>`);
  live.statusBox.innerHTML = `<h3>道体</h3><div class="small">${parts.join(' · ')}</div>${extra.length ? `<div class="small">${extra.join('<br>')}</div>` : ''}`;
  // 药园
  const gp = v.gardenPending || 0;
  if (live.gardenN !== gp) {
    live.gardenN = gp;
    live.garden.innerHTML = '';
    live.garden.append(h('h3', { text: '药园' }),
      h('div', { class: 'row' },
        h('span', { class: 'small', text: `已成熟 ${gp} 株（每五分钟成熟一株，至多 24 株）` }),
        h('span', { class: 'spacer' }),
        btn('采收', () => {
          const r = app.game.harvestGarden();
          if (r.ok) app.toast(`采得药材 ${r.count ?? gp} 株`, 'good'); else app.toast(reasonText(r.reason) || '尚无可采', 'bad');
          app.forceRefresh();
        }, { disabled: gp <= 0 })));
  }
}

export default { id: 'cultivate', name: '修炼', title: '修炼', render, update };

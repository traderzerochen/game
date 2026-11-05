// 结局界面：结局文本、此世记录、传承加成预览、「转世重修」
import { h } from './dom.js';
import { fmtGameTime, fmtInt, fmtPct } from './format.js';
import { sealSVG } from '../art/seal.js';

const SEAL = { ascend: '飞升', sit: '坐化', fallen: '陨落' };

/** 按 DESIGN §3.14 的规则预览下一世传承（仅展示；实际由 engine 的 rebirth 计算） */
function previewLegacy(L, endingId) {
  return {
    lives: (L.lives || 0) + 1,
    qiBonus: Math.min(1, (L.qiBonus || 0) + (endingId === 'ascend' ? 0.2 : 0.1)),
    breakBonus: Math.min(0.1, (L.breakBonus || 0) + 0.02),
    lifespanBonus: Math.min(50, (L.lifespanBonus || 0) + 10),
    startStones: 100 * ((L.lives || 0) + 1),
  };
}

export function showEnding(app) {
  const { game, data, stage } = app;
  const v = game.view();
  if (!v.ending || app._endingOpen) return;
  app._endingOpen = true;
  const id = v.ending.id;
  const ed = data.endings.find((x) => x.id === id) || { name: '终局', text: '' };
  const st = game.state;
  const c = st.counters || {};
  if (id === 'ascend') { stage.flash(0.8, '255,236,180'); stage.gather(); }
  else if (id === 'fallen') stage.flash(0.6, '29,27,25');
  app.audio?.play('ending');
  const next = previewLegacy(v.legacy || {}, id);
  const heart = data.byId.techniques.get(st.techniques.equipped.heart);
  const body = h('div', { class: `ending ending-${id}` },
    h('div', { class: 'ending-seal', html: sealSVG(SEAL[id] || '终', { size: 72, color: id === 'ascend' ? '#c99a2e' : undefined }) }),
    String(ed.text || '').split('\n').map((t) => h('p', { text: t })),
    h('h3', { class: 'kai', style: { marginTop: '12px' }, text: '此世' }),
    h('dl', { class: 'kv small' },
      h('dt', { text: '道号' }), h('dd', { text: v.name || '无名' }),
      h('dt', { text: '境界' }), h('dd', { text: v.realm?.name || '' }),
      h('dt', { text: '享寿' }), h('dd', { text: `${Math.floor(v.age)} 岁` }),
      h('dt', { text: '修行' }), h('dd', { text: fmtGameTime(v.played) }),
      h('dt', { text: '战绩' }), h('dd', { text: `历练 ${fmtInt(Object.values(c.dungeonRuns || {}).reduce((a, b) => a + b, 0))} 次 · 胜 ${fmtInt(c.battlesWon || 0)} 战 · 炼丹 ${fmtInt(c.crafts || 0)} 炉 · 渡劫 ${fmtInt(c.tribulations || 0)} 次` })),
    h('h3', { class: 'kai', style: { marginTop: '12px' }, text: `第 ${next.lives + 1} 世传承` }),
    h('dl', { class: 'kv small' },
      h('dt', { text: '修炼' }), h('dd', { class: 'good', text: `+${fmtPct(next.qiBonus)}` }),
      h('dt', { text: '破关' }), h('dd', { class: 'good', text: `+${fmtPct(next.breakBonus)}` }),
      h('dt', { text: '寿元' }), h('dd', { class: 'good', text: `+${next.lifespanBonus} 年` }),
      h('dt', { text: '起始灵石' }), h('dd', { text: fmtInt(next.startStones) }),
      heart ? h('dt', { text: '承袭心法' }) : null, heart ? h('dd', { class: 'rare', text: heart.name }) : null));
  app.openModal({
    title: ed.name,
    dismissable: false,
    body,
    actions: [{
      text: '转世重修',
      onclick: () => {
        const r = game.rebirth();
        app._endingOpen = false;
        if (!r.ok) { app.toast('轮回之门未开', 'bad'); return; }
        game.save();
        stage.setScene('home');
        stage.fx.flash(0.5, '243,236,220');
        app.toast('轮回一转，前尘如梦', 'rare');
        app.go('cultivate');
      },
    }],
  });
}


// 炼丹页 —— 阶段 1 简版：丹方列表 + 炼制（engine 未开放时提示）；阶段 2 加丹炉动画
import { h, sealButton } from '../dom.js';
import { fmtPct, reasonText } from '../format.js';
import { pillIcon, herbIcon } from '../../art/icons.js';
import { QUALITY_NAMES } from '../../art/palette.js';

function render(el, app) {
  const { game, data } = app;
  const st = game.state;
  const a = st.alchemy || { level: 1, xp: 0 };
  el.appendChild(h('div', { class: 'section' },
    h('h3', {}, '丹道 ', h('span', { class: 'muted', text: `第 ${a.level} 层 · 火候 ${a.xp}/${10 * a.level}` })),
    h('div', { class: 'desc', text: '灵根含火者，炼丹更易成。' })));
  const list = h('div', { class: 'section' }, h('h3', { text: '丹方' }));
  for (const r of data.recipes) {
    const pill = data.byId.pills.get(r.pillId);
    const info = game.craftInfo ? game.craftInfo(r.id) : null;
    const usable = info && info.ok !== false;
    const can = usable && info.can;
    const rate = usable ? info.rate : r.baseRate;
    const mats = r.herbs.map((x) => {
      const herb = data.byId.herbs.get(x.herbId);
      const have = st.inventory.herbs[x.herbId] || 0;
      return h('span', { class: `small ${have >= x.count ? '' : 'bad'}`, style: { marginRight: '8px', display: 'inline-flex', alignItems: 'center', gap: '2px' } },
        h('span', { html: herbIcon(herb, { size: 18 }) }), `${herb?.name || x.herbId} ${have}/${x.count}`);
    });
    const tooLow = (r.realmReq || 0) > st.stage;
    list.appendChild(h('div', { class: `card ${tooLow ? 'locked' : ''}` },
      h('div', { class: 'icon-box', html: pillIcon(pill, 0) }),
      h('div', { class: 'body' },
        h('div', { class: 'name', text: r.name }),
        h('div', { class: 'meta', text: `成丹 ${r.yield} 枚 · 灵石 ${r.stones} · 成功率 ${fmtPct(rate)}` }),
        h('div', {}, mats),
        h('div', { class: 'desc', text: pill?.desc || '' })),
      h('div', { class: 'actions' },
        sealButton('炼制', () => {
          const res = game.craft(r.id);
          if (!res.ok) { app.toast(reasonText(res.reason) || '丹炉未开', 'bad'); return; }
          if (res.success) app.toast(`丹成！得 ${QUALITY_NAMES[res.quality] || ''}${pill?.name} ×${res.count}`, res.quality >= 3 ? 'rare' : 'good');
          else app.toast('炉火失控，丹药化作青烟', 'bad');
          app.forceRefresh();
        }, { disabled: !can || tooLow, title: usable ? reasonText(info.missing?.length ? 'missing_herbs' : info.reason) : '丹炉尚未开启' }))));
  }
  el.appendChild(list);
}

export default { id: 'alchemy', name: '炼丹', title: '炼丹', render };

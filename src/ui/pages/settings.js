// 设置页：特效档位、音量、导出/导入存档、重置
import { h, btn } from '../dom.js';
import { TIERS, TIER_ORDER } from '../../art/tiers.js';
import { fmtGameTime } from '../format.js';

function render(el, app) {
  const { game, settings } = app;

  // 特效
  const fx = h('div', { class: 'section' }, h('h3', { text: '特效' }));
  fx.appendChild(h('div', { class: 'radio-group' }, TIER_ORDER.map((k) =>
    btn(`${TIERS[k].name}（${k}）`, () => { settings.quality = k; app.saveSettings(); app.quality?.reset(); app.forceRefresh(); }, { cls: settings.quality === k ? 'on' : '' }))));
  const auto = h('input', { type: 'checkbox', checked: settings.autoQuality, onchange: (e) => { settings.autoQuality = e.target.checked; app.saveSettings(); } });
  fx.appendChild(h('label', { class: 'row small', style: { marginTop: '6px' } }, auto, '帧率不足时自动降低特效'));
  fx.appendChild(h('div', { class: 'desc', text: `简：粒子 40，无模糊；中：粒子 150；繁：粒子 400，加墨晕。当前帧率约 ${Math.round(app.quality?.fps || 0)}。` }));
  el.appendChild(fx);

  // 音量
  const snd = h('div', { class: 'section' }, h('h3', { text: '声音' }));
  const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings.volume, oninput: (e) => { settings.volume = Number(e.target.value); app.saveSettings(); app.audio?.setVolume?.(settings.volume); } });
  const mute = h('input', { type: 'checkbox', checked: settings.muted, onchange: (e) => { settings.muted = e.target.checked; app.saveSettings(); app.audio?.setMuted?.(settings.muted); } });
  snd.append(h('div', { class: 'row small' }, '主音量', vol), h('label', { class: 'row small' }, mute, '静音'));
  el.appendChild(snd);

  // 回放速度
  const rp = h('div', { class: 'section' }, h('h3', { text: '战报回放' }));
  rp.appendChild(h('div', { class: 'radio-group' }, [1, 2, 4].map((s) => btn(`${s}×`, () => { settings.replaySpeed = s; app.saveSettings(); app.forceRefresh(); }, { cls: settings.replaySpeed === s ? 'on' : '' }))));
  el.appendChild(rp);

  // 存档
  const sv = h('div', { class: 'section' }, h('h3', {}, '存档 ', h('span', { class: 'muted', text: `已修行 ${fmtGameTime(game.state.time.played)}` })));
  const ta = h('textarea', { placeholder: '导出的存档文本会出现在这里；也可粘贴存档文本后点「导入」。' });
  sv.append(ta, h('div', { class: 'row', style: { marginTop: '6px' } },
    btn('立即存档', () => { const r = game.save(); app.toast(r.ok ? '已存档' : '存档失败', r.ok ? 'good' : 'bad'); }),
    btn('导出', () => {
      ta.value = game.exportSave();
      ta.select();
      try { navigator.clipboard?.writeText(ta.value).then(() => app.toast('存档已复制到剪贴板', 'good'), () => {}); } catch { /* 剪贴板不可用 */ }
    }),
    btn('导入', () => {
      const s = ta.value.trim();
      if (!s) return app.toast('请先粘贴存档文本', 'bad');
      const r = game.importSave(s);
      if (r.ok) { game.save(); app.toast('存档已导入', 'good'); app.forceRefresh(); } else app.toast('存档无法识别', 'bad');
    }),
    h('span', { class: 'spacer' }),
    btn('重置', () => app.openModal({
      title: '重置',
      body: h('p', { text: '此举将抹去当前存档与一切传承，重新开局。确定吗？' }),
      actions: [
        { text: '确定重置', onclick: () => { app.started = false; game.reset(); try { localStorage.removeItem('minglan_save_v1'); } catch { /* 忽略 */ } location.reload(); } },
        { text: '再想想', seal: false },
      ],
    }), { cls: 'bad' })));
  el.appendChild(sv);

  el.appendChild(h('div', { class: 'section desc', text: '全部画面、图标与声音皆为程序生成，无外部资源。存档保存在本机浏览器中。' }));
}

export default { id: 'settings', name: '设置', title: '设置', render };

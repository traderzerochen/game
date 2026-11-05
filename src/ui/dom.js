// 轻量 DOM 工具（无依赖）

/** h('div', {class:'x', onclick:fn, html:'<b>'}, child, [children], 'text') */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** 由 SVG 字符串创建一个容器元素 */
export function svgBox(svg, cls = 'icon-box') {
  return h('div', { class: cls, html: svg });
}

/** 墨迹进度条 */
export function inkBar(ratio, { cls = '', label = '' } = {}) {
  const fill = h('div', { class: 'fill' });
  const lbl = h('div', { class: 'lbl', text: label });
  const bar = h('div', { class: `ink-bar ${cls}` }, fill, lbl);
  bar.set = (r, text) => {
    const v = Math.max(0, Math.min(1, Number.isFinite(r) ? r : 0));
    fill.style.width = `${(v * 100).toFixed(2)}%`;
    bar.classList.toggle('full', v >= 1);
    if (text !== undefined) lbl.textContent = text;
  };
  bar.set(ratio, label);
  return bar;
}

export function sealButton(text, onclick, { cls = '', disabled = false, title = '' } = {}) {
  return h('button', { class: `seal-btn ${cls}`, onclick, disabled, title: title || null, text });
}

export function btn(text, onclick, { cls = '', disabled = false, title = '' } = {}) {
  return h('button', { class: `btn ${cls}`, onclick, disabled, title: title || null, text });
}

// 弹窗（小卷轴 + 宣纸遮罩）与提示
import { h } from './dom.js';

let stack = [];

/**
 * openModal({title, body: Node|string|Node[], actions:[{text, onclick, cls, seal}], dismissable})
 * 返回 close()
 */
export function openModal({ title = '', body = null, actions = [], dismissable = true, onClose = null, wide = false } = {}) {
  const close = () => {
    if (!mask.isConnected) return;
    mask.remove();
    stack = stack.filter((m) => m !== mask);
    document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape' && dismissable && stack[stack.length - 1] === mask) close(); };
  const acts = h('div', { class: 'modal-actions' },
    actions.map((a) => h('button', {
      class: a.seal === false ? `btn ${a.cls || ''}` : `seal-btn ${a.cls || ''}`,
      disabled: a.disabled,
      onclick: () => { const keep = a.onclick && a.onclick(close); if (keep !== true) close(); },
      text: a.text,
    })));
  const content = typeof body === 'string' ? h('div', { html: body }) : body;
  const modal = h('div', { class: 'modal', style: wide ? { width: 'min(720px, 94vw)' } : null },
    h('div', { class: 'scroll unroll' },
      h('div', { class: 'scroll-body' },
        title ? h('div', { class: 'scroll-title' }, title) : null,
        content,
        actions.length ? acts : null)));
  const mask = h('div', { class: 'modal-mask', onclick: (e) => { if (e.target === mask && dismissable) close(); } }, modal);
  document.body.appendChild(mask);
  stack.push(mask);
  document.addEventListener('keydown', onKey);
  return close;
}

export function hasModal() {
  return stack.length > 0;
}

let toastLayer = null;
export function setToastLayer(el) { toastLayer = el; }

export function toast(text, kind = 'info') {
  if (!toastLayer) return;
  const t = h('div', { class: `toast ${kind}`, text });
  toastLayer.appendChild(t);
  while (toastLayer.children.length > 4) toastLayer.firstChild.remove();
  setTimeout(() => t.remove(), 3100);
}

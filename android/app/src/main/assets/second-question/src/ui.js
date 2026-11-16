// Tiny DOM helpers. No framework, no dependencies.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'class') {
      el.className = value;
    } else if (key === 'html') {
      el.innerHTML = value;
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else if (value !== false && value != null) {
      el.setAttribute(key, value);
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function mdText(text) {
  const escaped = escapeHtml(text);
  const html = escaped
    .split('\n')
    .map((line) => {
      if (line.startsWith('### ')) return `<h4>${line.slice(4)}</h4>`;
      if (line.startsWith('## ')) return `<h3>${line.slice(3)}</h3>`;
      if (line.startsWith('# ')) return `<h2>${line.slice(2)}</h2>`;
      if (line.startsWith('- ')) return `<div class="li">• ${line.slice(2)}</div>`;
      if (!line.trim()) return '';
      return `${line}<br>`;
    })
    .join('');
  return html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

let toastTimer = null;
export function toast(message, ms = 2400) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), ms);
}

export function timeLabel(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function dayLabel(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function drawer(title, content, { onClose } = {}) {
  const overlay = h('div', { class: 'overlay' });
  const panel = h(
    'section',
    { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h(
      'header',
      { class: 'drawer-head' },
      h('h2', {}, title),
      h('button', { class: 'icon-btn', 'aria-label': '关闭', onclick: close }, '×')
    ),
    h('div', { class: 'drawer-body' }, content)
  );
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  overlay.append(panel);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  return { close, panel };
}

export function confirmDialog(message, { danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'overlay center' });
    const yes = h(
      'button',
      {
        class: danger ? 'btn danger' : 'btn primary',
        onclick: () => {
          overlay.remove();
          resolve(true);
        },
      },
      '确定'
    );
    const no = h(
      'button',
      {
        class: 'btn',
        onclick: () => {
          overlay.remove();
          resolve(false);
        },
      },
      '取消'
    );
    overlay.append(
      h(
        'div',
        { class: 'dialog' },
        h('p', {}, message),
        h('div', { class: 'row end' }, no, yes)
      )
    );
    document.body.append(overlay);
  });
}

export function download(filename, text, type = 'text/markdown') {
  // Inside the Android shell there is no browser download manager; the shell
  // exposes a small bridge that writes to Downloads via MediaStore.
  if (globalThis.AndroidBridge && typeof globalThis.AndroidBridge.saveText === 'function') {
    globalThis.AndroidBridge.saveText(filename, String(text));
    return;
  }
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

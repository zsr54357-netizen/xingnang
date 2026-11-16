import { testConnection, errorText } from '../api.js';
import { h, clear, drawer } from '../ui.js';

const STEP_NAMES = ['地址格式', '发出请求', '收到响应', '鉴权结果'];

export function openDiagnostics(rt) {
  const list = h('ol', { class: 'diag-list' });
  const out = h('div', { class: 'diag-out' });
  const run = h('button', { class: 'btn primary', type: 'button' }, '开始诊断');

  function step(index, state, detail = '') {
    const li = h(
      'li',
      { class: `diag-step ${state}` },
      h('span', { class: 'diag-name' }, STEP_NAMES[index]),
      detail ? h('span', { class: 'diag-detail' }, detail) : null
    );
    list.append(li);
  }

  run.addEventListener('click', async () => {
    clear(list);
    clear(out);
    run.disabled = true;
    const baseUrl = rt.state.settings.baseUrl;
    const apiKey = rt.state.secret.apiKey;

    if (!/^https?:\/\/.+/.test(baseUrl)) {
      step(0, 'fail', '地址必须以 http(s):// 开头');
      run.disabled = false;
      return;
    }
    step(0, 'ok', baseUrl);

    if (!apiKey) {
      step(2, 'fail', '还没有填 API Key');
      run.disabled = false;
      return;
    }

    try {
      const { ms } = await testConnection({ baseUrl, apiKey, model: rt.state.settings.model });
      step(1, 'ok');
      step(2, 'ok', `${ms} ms`);
      step(3, 'ok');
      out.append(h('p', { class: 'hint' }, '连接正常。如果对话仍然失败，检查模型名与额度。'));
    } catch (err) {
      const kind = err?.kind;
      if (kind === 'network') {
        step(1, 'fail', '请求没有发出去');
        out.append(
          h(
            'div',
            { class: 'note' },
            h('p', {}, '浏览器被 CORS 或网络拦住了。两种办法：'),
            h('ol', {}, h('li', {}, '把 API 地址换成你自己的中转地址；'), h('li', {}, '部署仓库里的 relay/worker.js，再把地址指向它。')),
            h('p', { class: 'hint' }, 'HTTP 页面（非 localhost）也会禁用加密与 Service Worker。')
          )
        );
      } else if (kind === 'auth') {
        step(1, 'ok');
        step(2, 'ok');
        step(3, 'fail', 'Key 被拒绝');
      } else {
        step(1, 'ok');
        step(2, 'fail', errorText(err));
      }
    } finally {
      run.disabled = false;
    }
  });

  const body = h(
    'div',
    { class: 'diagnostics' },
    h('p', { class: 'hint' }, `当前地址：${rt.state.settings.baseUrl}`),
    h('p', { class: 'hint' }, `模型：${rt.state.settings.model}`),
    run,
    list,
    out,
    h(
      'p',
      { class: 'hint' },
      '说明：浏览器无法单独测 DNS 与 TLS，所以这里只看请求是否发出、是否收到响应、鉴权是否通过。'
    )
  );

  drawer('连接诊断', body);
}

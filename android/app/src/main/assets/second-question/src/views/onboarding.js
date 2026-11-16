import { ONBOARDING, OPENING } from '../prompts.js';
import { createVault, emptyState, saveRecord } from '../store.js';
import { h, clear, uid } from '../ui.js';

function recoveryModal(code, onDone) {
  const overlay = h('div', { class: 'overlay center' });
  overlay.append(
    h(
      'div',
      { class: 'dialog recovery' },
      h('h3', {}, '恢复码'),
      h('p', {}, '忘记口令时，只能靠它解锁。抄下来，离线保存。'),
      h('code', { class: 'recovery-code' }, code),
      h('p', { class: 'hint' }, '这串码只显示这一次。'),
      h(
        'button',
        {
          class: 'btn primary',
          type: 'button',
          onclick: () => {
            overlay.remove();
            onDone();
          },
        },
        '我已抄下'
      )
    )
  );
  document.body.append(overlay);
}

export function renderOnboarding(rt) {
  let step = 0;
  const canEncrypt = Boolean(globalThis.crypto?.subtle);
  const draft = {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    apiKey: '',
  };
  const root = h('div', { class: 'onboard' });

  async function finish(passphrase) {
    const safePassphrase = canEncrypt ? passphrase : '';
    const state = emptyState();
    state.settings.baseUrl = draft.baseUrl.trim().replace(/\/+$/, '') || 'https://api.deepseek.com';
    state.settings.model = draft.model.trim() || 'deepseek-chat';
    state.secret.apiKey = draft.apiKey.trim();
    state.messages.push({
      id: uid(),
      role: 'assistant',
      content: OPENING,
      ts: Date.now(),
      archived: false,
      episodeId: null,
    });
    try {
      const { record, dek, recovery } = await createVault(state, safePassphrase);
      await saveRecord(record);
      if (recovery) {
        recoveryModal(recovery, () => rt.enter(state, dek, record));
      } else {
        rt.enter(state, dek, record);
      }
    } catch (err) {
      window.alert(`初始化失败：${err.message}`);
    }
  }

  function dots() {
    return h(
      'div',
      { class: 'dots' },
      ...[0, 1, 2, 3].map((i) => h('span', { class: `dot ${i <= step ? 'on' : ''}` }))
    );
  }

  function render() {
    clear(root);

    if (step < ONBOARDING.length) {
      const card = ONBOARDING[step];
      root.append(
        h('div', { class: 'onboard-inner' }, dots(), h('h1', {}, card.title), h('p', { class: 'lead' }, card.body))
      );
      root.append(
        h(
          'div',
          { class: 'onboard-actions' },
          h(
            'button',
            {
              class: 'btn primary',
              type: 'button',
              onclick: () => {
                step++;
                render();
              },
            },
            step === ONBOARDING.length - 1 ? '开始' : '继续'
          )
        )
      );
      return;
    }

    if (step === ONBOARDING.length) {
      const baseUrl = h('input', { class: 'field-input', value: draft.baseUrl, spellcheck: 'false' });
      const model = h('input', { class: 'field-input', value: draft.model, spellcheck: 'false' });
      const apiKey = h('input', {
        class: 'field-input',
        type: 'password',
        placeholder: 'sk-…',
        autocomplete: 'off',
      });
      root.append(
        h(
          'div',
          { class: 'onboard-inner form' },
          h('h1', {}, '接上你的模型'),
          h('p', { class: 'hint' }, '支持任何 OpenAI 兼容接口。Key 只存在本机；对话会发给你配置的服务商。'),
          h('label', { class: 'field' }, h('span', { class: 'label' }, 'API 地址'), baseUrl),
          h('label', { class: 'field' }, h('span', { class: 'label' }, '模型'), model),
          h('label', { class: 'field' }, h('span', { class: 'label' }, 'API Key'), apiKey),
          h(
            'button',
            {
              class: 'link-btn',
              type: 'button',
              onclick: () => {
                baseUrl.value = 'http://localhost:9090';
                model.value = 'mock';
                apiKey.value = 'mock';
              },
            },
            '没有 Key？填入本地假模型（先运行 npm run mock）'
          )
        )
      );
      root.append(
        h(
          'div',
          { class: 'onboard-actions' },
          h(
            'button',
            {
              class: 'link-btn',
              type: 'button',
              onclick: () => {
                draft.baseUrl = baseUrl.value;
                draft.model = model.value;
                draft.apiKey = apiKey.value;
                if (!canEncrypt) {
                  finish('');
                  return;
                }
                step++;
                render();
              },
            },
            '稍后配置'
          ),
          h(
            'button',
            {
              class: 'btn primary',
              type: 'button',
              onclick: () => {
                draft.baseUrl = baseUrl.value;
                draft.model = model.value;
                draft.apiKey = apiKey.value;
                if (!canEncrypt) {
                  finish('');
                  return;
                }
                step++;
                render();
              },
            },
            canEncrypt ? '下一步' : '进入（预览模式）'
          )
        )
      );
      return;
    }

    const pass = h('input', { class: 'field-input', type: 'password', autocomplete: 'new-password' });
    const pass2 = h('input', { class: 'field-input', type: 'password', autocomplete: 'new-password' });
    const err = h('p', { class: 'error-line' });
    const skipBox = h('input', { type: 'checkbox' });

    const submit = async () => {
      if (pass.value.length < 6) {
        err.textContent = '口令至少 6 位；或者勾选下面的选项跳过。';
        return;
      }
      if (pass.value !== pass2.value) {
        err.textContent = '两次输入不一致。';
        return;
      }
      await finish(pass.value);
    };

    root.append(
      h(
        'div',
        { class: 'onboard-inner form' },
        h('h1', {}, '给库上锁'),
        h('p', { class: 'hint' }, '口令只在本机用于加密。忘记口令只能用恢复码；恢复码也丢了，数据就没了。'),
        h('label', { class: 'field' }, h('span', { class: 'label' }, '口令'), pass),
        h('label', { class: 'field' }, h('span', { class: 'label' }, '再输一次'), pass2),
        err,
        h(
          'label',
          { class: 'check' },
          skipBox,
          h('span', {}, '暂不加密（不推荐）')
        )
      )
    );
    root.append(
      h(
        'div',
        { class: 'onboard-actions' },
        h('button', { class: 'link-btn', type: 'button', onclick: () => { step--; render(); } }, '返回'),
        h(
          'button',
          {
            class: 'btn primary',
            type: 'button',
            onclick: async () => {
              if (skipBox.checked) return finish('');
              await submit();
            },
          },
          '进入'
        )
      )
    );
  }

  render();
  return root;
}

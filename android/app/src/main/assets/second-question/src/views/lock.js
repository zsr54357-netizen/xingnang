import { unlockVault } from '../store.js';
import { h } from '../ui.js';

export function renderLock(rt) {
  const pass = h('input', {
    class: 'field-input',
    type: 'password',
    placeholder: '口令',
    autocomplete: 'current-password',
  });
  const recovery = h('input', {
    class: 'field-input',
    type: 'password',
    placeholder: '恢复码，例如 ABCD-EFGH-…',
    hidden: true,
    autocomplete: 'off',
  });
  const error = h('p', { class: 'error-line' });
  const submit = h('button', { class: 'btn primary', type: 'submit' }, '解锁');
  let useRecovery = false;

  const toggle = h(
    'button',
    {
      class: 'link-btn',
      type: 'button',
      onclick: () => {
        useRecovery = !useRecovery;
        recovery.hidden = !useRecovery;
        pass.hidden = useRecovery;
        toggle.textContent = useRecovery ? '用口令' : '用恢复码';
        error.textContent = '';
      },
    },
    '用恢复码'
  );

  const form = h(
    'form',
    {
      class: 'lock',
      onsubmit: async (e) => {
        e.preventDefault();
        error.textContent = '';
        submit.disabled = true;
        try {
          const out = await unlockVault(rt.record, {
            passphrase: useRecovery ? '' : pass.value,
            recovery: useRecovery ? recovery.value : '',
          });
          rt.enter(out.state, out.dek);
        } catch {
          error.textContent = '口令或恢复码不对。';
        } finally {
          submit.disabled = false;
        }
      },
    },
    h('div', { class: 'brand big' }, h('span', { class: 'brand-mark' }, '？'), h('span', {}, '第二问')),
    h('p', { class: 'hint' }, '库已锁定。'),
    pass,
    recovery,
    error,
    submit,
    toggle
  );

  return h('div', { class: 'lock-screen' }, form);
}

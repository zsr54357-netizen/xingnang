import { h, drawer, toast, confirmDialog, download } from '../ui.js';
import {
  buildWeeklyMarkdown,
  chooseWeeklyFilename,
  weeklyStats,
} from '../weekly.js';
import {
  buildBackup,
  changePassphrase,
  clearRecord,
  createVault,
  exportMarkdown,
  parseBackup,
  unlockVault,
  saveRecord,
} from '../store.js';
import { testConnection, errorText } from '../api.js';

function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'label' }, label), input, hint ? h('span', { class: 'hint' }, hint) : null);
}

function showRecovery(code, onDone) {
  const overlay = h('div', { class: 'overlay center' });
  overlay.append(
    h(
      'div',
      { class: 'dialog recovery' },
      h('h3', {}, '恢复码'),
      h('p', {}, '忘记口令时，只能靠它解锁。抄下来，离线保存，不要发给我或任何人。'),
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

function weeklyRead(name) {
  if (globalThis.AndroidBridge?.readText) return globalThis.AndroidBridge.readText(name);
  try {
    return localStorage.getItem(`2q-weekly:${name}`);
  } catch {
    return null;
  }
}

function weeklySave(result) {
  const existing = weeklyRead(result.filename);
  if (existing === result.content) {
    return {
      filename: result.filename,
      path: globalThis.AndroidBridge?.saveText
        ? `下载/${result.filename}`
        : '浏览器下载目录',
      unchanged: true,
    };
  }

  const name = chooseWeeklyFilename(result.filename, result.content, weeklyRead);
  if (globalThis.AndroidBridge?.saveText) {
    const saved = globalThis.AndroidBridge.saveText(name, result.content);
    if (!saved) throw new Error('保存失败');
    return {
      filename: saved,
      path: `下载/${saved}`,
      renamed: saved !== result.filename,
    };
  }

  download(name, result.content);
  try {
    localStorage.setItem(`2q-weekly:${name}`, result.content);
  } catch {
    /* storage full or disabled */
  }
  return {
    filename: name,
    path: '浏览器下载目录',
    renamed: name !== result.filename,
  };
}

function confirmWeekly(stats) {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'overlay center' });
    const close = (value) => {
      overlay.remove();
      resolve(value);
    };
    overlay.append(
      h(
        'div',
        { class: 'dialog' },
        h('h3', {}, '导出本周周记'),
        h('p', {}, `周号：${stats.week}`),
        h('p', {}, `范围：${stats.start} ~ ${stats.end}`),
        h('p', {}, `消息：${stats.count} 条`),
        h('p', {}, `正文：${stats.chars} 字`),
        h(
          'div',
          { class: 'row end' },
          h('button', { class: 'btn', type: 'button', onclick: () => close(false) }, '取消'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => close(true) }, '导出')
        )
      )
    );
    document.body.append(overlay);
  });
}

function showWeeklySaved(result) {
  const overlay = h('div', { class: 'overlay center' });
  overlay.append(
    h(
      'div',
      { class: 'dialog' },
      h('h3', {}, result.unchanged ? '本周周记已存在' : result.renamed ? '已另存为新文件' : '已导出'),
      h('p', {}, `文件名：${result.filename}`),
      h('p', {}, `路径：${result.path}`),
      result.renamed ? h('p', { class: 'hint' }, '原文件内容不同，没有覆盖。') : null,
      h(
        'button',
        { class: 'btn primary', type: 'button', onclick: () => overlay.remove() },
        '好'
      )
    )
  );
  document.body.append(overlay);
}

export function openSettings(rt) {
  const state = rt.state;
  const settings = state.settings;

  const baseUrl = h('input', { class: 'field-input', value: settings.baseUrl, spellcheck: 'false' });
  const model = h('input', { class: 'field-input', value: settings.model, spellcheck: 'false' });
  const apiKey = h('input', {
    class: 'field-input',
    type: 'password',
    value: state.secret.apiKey || '',
    placeholder: 'sk-…',
    autocomplete: 'off',
  });
  const testOut = h('p', { class: 'hint' });
  const testBtn = h('button', { class: 'btn small', type: 'button' }, '测试连接');
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testOut.textContent = '正在连接…';
    try {
      const { ms } = await testConnection({
        baseUrl: baseUrl.value.trim(),
        apiKey: apiKey.value.trim(),
        model: model.value.trim(),
      });
      testOut.textContent = `连接成功，${ms} ms。`;
    } catch (err) {
      testOut.textContent = errorText(err);
    } finally {
      testBtn.disabled = false;
    }
  });

  const saveBtn = h(
    'button',
    {
      class: 'btn primary',
      type: 'button',
      onclick: () => {
        settings.baseUrl = baseUrl.value.trim().replace(/\/+$/, '');
        settings.model = model.value.trim();
        state.secret.apiKey = apiKey.value.trim();
        rt.save();
        toast('已保存');
      },
    },
    '保存'
  );

  const lockSelect = h(
    'select',
    { class: 'field-input' },
    ...[1, 5, 15, 60].map((n) => h('option', { value: n, selected: settings.autoLockMinutes === n }, `${n} 分钟`))
  );
  lockSelect.addEventListener('change', () => {
    settings.autoLockMinutes = Number(lockSelect.value);
    rt.save();
  });

  const passBlock = h('div', { class: 'section' });
  const curPass = h('input', { class: 'field-input', type: 'password', autocomplete: 'off' });
  const newPass = h('input', { class: 'field-input', type: 'password', autocomplete: 'off' });
  const newPass2 = h('input', { class: 'field-input', type: 'password', autocomplete: 'off' });
  const passNote = h('p', { class: 'hint' });

  if (!globalThis.crypto?.subtle) {
    passBlock.append(
      h('h3', {}, '口令'),
      h('p', { class: 'hint' }, '当前页面不是安全上下文（需要 HTTPS 或 localhost），浏览器禁用了加密。')
    );
  } else if (rt.record.enc) {
    passBlock.append(
      h('h3', {}, '口令'),
      field('当前口令', curPass),
      field('新口令', newPass),
      field('再输一次', newPass2),
      h(
        'button',
        {
          class: 'btn small',
          type: 'button',
          onclick: async () => {
            if (newPass.value.length < 6) return toast('新口令至少 6 位');
            if (newPass.value !== newPass2.value) return toast('两次输入不一致');
            try {
              await unlockVault(rt.record, { passphrase: curPass.value });
            } catch {
              return toast('当前口令不对');
            }
            rt.record = await changePassphrase(rt.record, rt.dek, newPass.value);
            await saveRecord(rt.record);
            curPass.value = '';
            newPass.value = '';
            newPass2.value = '';
            toast('口令已修改');
          },
        },
        '修改口令'
      ),
      passNote
    );
  } else {
    passBlock.append(
      h('h3', {}, '口令'),
      h('p', { class: 'hint' }, '当前未加密。设置口令后，整库与 API Key 都会加密保存。'),
      field('设置口令', newPass, '至少 6 位；忘记后只能靠恢复码。'),
      field('再输一次', newPass2),
      h(
        'button',
        {
          class: 'btn small',
          type: 'button',
          onclick: async () => {
            if (newPass.value.length < 6) return toast('口令至少 6 位');
            if (newPass.value !== newPass2.value) return toast('两次输入不一致');
            const { record, dek, recovery } = await createVault(state, newPass.value);
            rt.record = record;
            rt.dek = dek;
            await saveRecord(record);
            showRecovery(recovery, () => toast('已加密'));
          },
        },
        '设置口令'
      ),
      passNote
    );
  }

  const importInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const record = parseBackup(await file.text());
      let state2;
      let dek2 = null;
      if (record.enc) {
        const pass = window.prompt('输入这份备份的口令。若用恢复码，请直接粘贴恢复码。');
        if (pass == null) return;
        try {
          const out = await unlockVault(record, { passphrase: pass });
          state2 = out.state;
          dek2 = out.dek;
        } catch {
          const out = await unlockVault(record, { recovery: pass });
          state2 = out.state;
          dek2 = out.dek;
        }
      } else {
        state2 = record.data;
      }
      if (!(await confirmDialog('导入会覆盖当前全部数据。继续？', { danger: true }))) return;
      rt.state = state2;
      rt.record = record;
      rt.dek = dek2;
      await saveRecord(record);
      rt.render();
      toast('已导入');
    } catch (err) {
      toast(`导入失败：${err.message}`);
    } finally {
      importInput.value = '';
    }
  });

  const body = h(
    'div',
    { class: 'settings' },
    h('h3', {}, '连接'),
    field('API 地址', baseUrl, '兼容 OpenAI 的 /chat/completions。'),
    field('模型', model, '例如 deepseek-chat。'),
    field('API Key', apiKey, '只存在本机，随整库加密；请求时直接发给你配置的服务商。'),
    h('div', { class: 'row' }, saveBtn, testBtn),
    testOut,
    h(
      'button',
      { class: 'link-btn', type: 'button', onclick: () => rt.openDiagnostics() },
      '连接失败？打开诊断'
    ),

    h('div', { class: 'section' }, h('h3', {}, '锁定'), field('页面隐藏多久后锁定', lockSelect)),

    passBlock,

    h(
      'div',
      { class: 'section' },
      h('h3', {}, '周记'),
      h(
        'button',
        {
          class: 'btn small',
          type: 'button',
          onclick: async () => {
            const now = Date.now();
            const stats = weeklyStats(state.messages, { now });
            if (stats.count === 0) {
              toast('本周没有你发的消息，不生成文件');
              return;
            }
            if (!(await confirmWeekly(stats))) return;
            const result = buildWeeklyMarkdown(state.messages, { now });
            if (!result) {
              toast('本周没有你发的消息，不生成文件');
              return;
            }
            try {
              showWeeklySaved(weeklySave(result));
            } catch (err) {
              toast(`导出失败：${err.message}`);
            }
          },
        },
        '导出本周'
      ),
      h('p', { class: 'hint' }, '一周一个文件，正文只包含你发的消息。')
    ),

    h(
      'div',
      { class: 'section' },
      h('h3', {}, '数据'),
      h(
        'div',
        { class: 'row wrap' },
        h(
          'button',
          {
            class: 'btn small',
            type: 'button',
            onclick: () => {
              state.settings.lastExportAt = Date.now();
              rt.save();
              download(`第二问-${new Date().toISOString().slice(0, 10)}.md`, exportMarkdown(state));
            },
          },
          '导出 Markdown'
        ),
        h(
          'button',
          {
            class: 'btn small',
            type: 'button',
            onclick: () =>
              download(
                `第二问-备份-${new Date().toISOString().slice(0, 10)}.json`,
                buildBackup(rt.record),
                'application/json'
              ),
          },
          '导出备份'
        ),
        h(
          'button',
          { class: 'btn small', type: 'button', onclick: () => importInput.click() },
          '导入备份'
        ),
        importInput,
        h(
          'button',
          {
            class: 'btn small',
            type: 'button',
            onclick: async () => {
              if (!rt.archiveNow) return toast('当前环境不可用');
              const res = await rt.archiveNow();
              if (res?.ok) return;
              if (res?.reason === 'too-few') return toast('对话太短，至少四条消息');
              if (res?.reason === 'no-tools') return toast('模型没有返回档案内容');
              toast('暂未整理');
            },
          },
          '立即整理档案'
        )
      )
    ),

    h(
      'div',
      { class: 'section' },
      h('h3', {}, '用量'),
      h(
        'p',
        { class: 'hint' },
        `输入 ${(state.usage?.promptTokens || 0).toLocaleString()} tokens · 输出 ${(state.usage?.completionTokens || 0).toLocaleString()} tokens`
      )
    ),

    h(
      'div',
      { class: 'section danger-zone' },
      h('h3', {}, '危险'),
      h(
        'button',
        {
          class: 'btn danger',
          type: 'button',
          onclick: async () => {
            if (!(await confirmDialog('清空全部对话与档案？此操作不可恢复。', { danger: true }))) return;
            await clearRecord();
            location.reload();
          },
        },
        '清空全部'
      )
    ),

    h('p', { class: 'hint version' }, '第二问 v0.1.1 · 数据只在本机')
  );

  drawer('设置', body);
}

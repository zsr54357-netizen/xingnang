import { assembleContext } from '../engine.js';
import { CHAT_TOOLS } from '../prompts.js';
import { executeTool } from '../tools.js';
import { streamChat, errorText } from '../api.js';
import { shouldArchive } from '../model.js';
import { h, clear, mdText, timeLabel, dayLabel, toast, uid } from '../ui.js';

const TOOL_LABELS = {
  read_memory: '查档案',
  search_memory: '翻旧事',
  get_episode: '读事件卡',
  note_quote: '记原话',
  open_case: '开案',
  close_case: '结案',
  propose_hypothesis: '记假设',
  review_hypothesis: '更新假设',
};

export function renderChat(rt) {
  const list = h('div', { class: 'messages', role: 'log', 'aria-live': 'polite' });
  const status = h('div', { class: 'stream-status', hidden: true });
  const input = h('textarea', {
    class: 'composer-input',
    rows: 2,
    placeholder: '说一件具体的事：什么时候，在哪，你做了什么。',
    'aria-label': '输入',
  });
  const sendBtn = h('button', { class: 'send-btn', type: 'submit' }, '发送');
  const stopBtn = h('button', { class: 'send-btn stop', type: 'button', hidden: true }, '停');

  const form = h('form', { class: 'composer' }, input, sendBtn, stopBtn);

  const head = h(
    'header',
    { class: 'topbar' },
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, '？'), h('span', {}, '第二问')),
    h(
      'div',
      { class: 'topbar-actions' },
      h('button', { class: 'chip-btn', type: 'button', onclick: () => rt.openMemory() }, '案卷'),
      h(
        'button',
        { class: 'icon-btn', type: 'button', 'aria-label': '设置', onclick: () => rt.openSettings() },
        '⋯'
      )
    )
  );

  const root = h('div', { class: 'chat-screen' }, head, list, status, form);

  function scrollBottom(force = false) {
    const near = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    if (force || near) list.scrollTop = list.scrollHeight;
  }

  function renderMessages() {
    clear(list);
    let lastDay = '';
    for (const m of rt.state.messages) {
      if (!m.content) continue;
      const day = dayLabel(m.ts);
      if (day !== lastDay) {
        list.append(h('div', { class: 'day-sep' }, day));
        lastDay = day;
      }
      if (m.role === 'user') {
        list.append(
          h(
            'div',
            { class: 'msg user' },
            h('div', { class: 'bubble' }, m.content),
            h('div', { class: 'meta' }, timeLabel(m.ts))
          )
        );
      } else if (m.role === 'assistant') {
        list.append(
          h(
            'div',
            { class: 'msg ai' },
            h('div', { class: 'text', html: mdText(m.content) }),
            h('div', { class: 'meta' }, timeLabel(m.ts))
          )
        );
      }
    }
    if (!rt.state.messages.length) {
      list.append(h('div', { class: 'empty' }, '还没有开始。写一件今天你后来还在想的事。'));
    }
    scrollBottom(true);
  }

  function streamingBubble() {
    const textEl = h('div', { class: 'text' });
    const statusEl = h('div', { class: 'tool-status', hidden: true });
    const node = h('div', { class: 'msg ai streaming' }, textEl, statusEl);
    list.append(node);
    scrollBottom(true);
    return {
      appendText(chunk) {
        textEl.append(document.createTextNode(chunk));
      },
      setStatus(text) {
        statusEl.hidden = false;
        statusEl.textContent = text;
      },
      remove() {
        node.remove();
      },
      fail(message, err) {
        statusEl.hidden = true;
        node.classList.remove('streaming');
        textEl.append(h('div', { class: 'error-line' }, message));
        if (err?.kind === 'network') {
          textEl.append(
            h(
              'button',
              { class: 'link-btn', type: 'button', onclick: () => rt.openDiagnostics() },
              '打开连接诊断'
            )
          );
        }
      },
    };
  }

  async function send(text, { append = true } = {}) {
    const value = String(text || '').trim();
    if (!value || rt.busy) return;
    if (!rt.state.secret.apiKey) {
      rt.openSettings();
      toast('先配置 API Key');
      return;
    }

    if (append) {
      const now = Date.now();
      rt.state.messages.push({
        id: uid(),
        role: 'user',
        content: value,
        ts: now,
        tzOffset: new Date(now).getTimezoneOffset(),
        archived: false,
        episodeId: null,
      });
      rt.save();
      renderMessages();
    }

    rt.busy = true;
    sendBtn.hidden = true;
    stopBtn.hidden = false;
    const controller = new AbortController();
    rt.abort = controller;
    const bubble = streamingBubble();
    let full = '';
    let usage = null;

    try {
      let working = assembleContext(rt.state);
      for (let round = 0; round < 4; round++) {
        const calls = [];
        let roundText = '';
        for await (const ev of streamChat({
          baseUrl: rt.state.settings.baseUrl,
          apiKey: rt.state.secret.apiKey,
          model: rt.state.settings.model,
          messages: working,
          tools: CHAT_TOOLS,
          temperature: rt.state.settings.temperature,
          maxTokens: rt.state.settings.maxTokens,
          signal: controller.signal,
        })) {
          if (ev.type === 'text') {
            roundText += ev.text;
            bubble.appendText(ev.text);
            scrollBottom();
          } else if (ev.type === 'tool_calls') {
            calls.push(...ev.calls);
          } else if (ev.type === 'done') {
            usage = ev.usage;
          }
        }
        full += roundText;
        if (!calls.length) break;

        working.push({
          role: 'assistant',
          content: roundText || null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.arguments) },
          })),
        });
        for (const call of calls) {
          bubble.setStatus(`正在${TOOL_LABELS[call.name] || '处理'}…`);
          let result;
          try {
            result = executeTool(rt.state, call.name, call.arguments, { now: Date.now() });
          } catch (err) {
            result = `工具执行失败：${err.message}`;
          }
          working.push({ role: 'tool', tool_call_id: call.id, content: result });
          rt.save();
        }
      }

      // If the tool budget ran out without a closing line, ask once more with no tools.
      if (!full.trim()) {
        for await (const ev of streamChat({
          baseUrl: rt.state.settings.baseUrl,
          apiKey: rt.state.secret.apiKey,
          model: rt.state.settings.model,
          messages: working,
          temperature: rt.state.settings.temperature,
          maxTokens: rt.state.settings.maxTokens,
          signal: controller.signal,
        })) {
          if (ev.type === 'text') {
            full += ev.text;
            bubble.appendText(ev.text);
            scrollBottom();
          } else if (ev.type === 'done') {
            usage = ev.usage || usage;
          }
        }
      }

      const content = full.trim() || '（这一轮没有回复）';
      rt.state.messages.push({
        id: uid(),
        role: 'assistant',
        content,
        ts: Date.now(),
        archived: false,
        episodeId: null,
      });
      if (usage) {
        rt.state.usage.promptTokens += usage.prompt_tokens || 0;
        rt.state.usage.completionTokens += usage.completion_tokens || 0;
      }
      rt.save();
      bubble.remove();
      renderMessages();
      if (shouldArchive(rt.state)) rt.maybeArchive();
    } catch (err) {
      if (err?.name === 'AbortError') {
        const partial = full.trim();
        if (partial) {
          rt.state.messages.push({
            id: uid(),
            role: 'assistant',
            content: partial,
            ts: Date.now(),
            archived: false,
            episodeId: null,
          });
          rt.save();
        }
        bubble.remove();
        renderMessages();
      } else {
        bubble.fail(errorText(err), err);
      }
    } finally {
      rt.busy = false;
      rt.abort = null;
      sendBtn.hidden = false;
      stopBtn.hidden = true;
      scrollBottom();
    }
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  function takeAndSend() {
    if (!rt.state.secret?.apiKey) {
      rt.openSettings();
      toast('先配置 API Key');
      return;
    }
    const text = input.value;
    input.value = '';
    autoGrow();
    send(text);
  }

  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      takeAndSend();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    takeAndSend();
  });
  stopBtn.addEventListener('click', () => rt.abort?.abort());

  renderMessages();
  autoGrow();
  setTimeout(() => input.focus(), 50);

  return root;
}

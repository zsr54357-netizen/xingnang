import { h, clear, drawer, confirmDialog, toast, mdText } from '../ui.js';
import { renderDossier } from '../memory/dossier.js';
import { localDate } from '../model.js';

const TABS = ['卷宗', '事件卡', '模式', '假设'];

export function openMemory(rt) {
  const state = rt.state;
  let active = '卷宗';
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const content = h('div', { class: 'tab-content' });
  const body = h('div', { class: 'memory' }, tabs, content);

  function tabButton(name) {
    return h(
      'button',
      {
        class: `tab ${active === name ? 'active' : ''}`,
        role: 'tab',
        'aria-selected': active === name ? 'true' : 'false',
        onclick: () => {
          active = name;
          renderTabs();
          renderContent();
        },
      },
      name
    );
  }

  function renderTabs() {
    clear(tabs);
    for (const name of TABS) tabs.append(tabButton(name));
  }

  function renderContent() {
    clear(content);
    if (active === '卷宗') return renderDossierTab();
    if (active === '事件卡') return renderEpisodesTab();
    if (active === '模式') return renderPatternsTab();
    return renderHypothesesTab();
  }

  function renderDossierTab() {
    content.append(h('div', { class: 'md', html: mdText(renderDossier(state)) }));
    const area = h('textarea', {
      class: 'field-area',
      rows: 3,
      placeholder: '上次停在这里：他停在哪件事、哪个问题上。',
    });
    area.value = state.dossier?.whereWeStopped || '';
    content.append(
      h(
        'div',
        { class: 'edit-block' },
        h('label', { class: 'label' }, '手动修改“上次停在这里”'),
        area,
        h(
          'button',
          {
            class: 'btn small',
            type: 'button',
            onclick: () => {
              state.dossier = state.dossier || {};
              state.dossier.whereWeStopped = area.value.trim();
              state.dossier.updatedAt = Date.now();
              rt.save();
              toast('已保存');
            },
          },
          '保存'
        )
      )
    );
  }

  function renderEpisodesTab() {
    if (!state.episodes.length) {
      content.append(h('p', { class: 'hint' }, '还没有事件卡。一次对话结束后，档案员会写一张。'));
      return;
    }
    for (const ep of [...state.episodes].reverse()) {
      const c = ep.card || {};
      content.append(
        h(
          'article',
          { class: 'episode' },
          h(
            'div',
            { class: 'episode-head' },
            h('strong', {}, ep.id),
            h('span', { class: 'muted' }, localDate(ep.startedAt)),
            ep.cold ? h('span', { class: 'chip cold' }, '冷') : null
          ),
          c.event ? h('p', {}, h('span', { class: 'k' }, '事件 '), c.event) : null,
          c.quote ? h('p', { class: 'quote' }, `“${c.quote}”`) : null,
          c.payoff ? h('p', {}, h('span', { class: 'k' }, '收益 '), c.payoff) : null,
          c.exit ? h('p', { class: 'muted' }, `出口：${c.exit}`) : null,
          h(
            'button',
            {
              class: 'link-btn danger',
              type: 'button',
              onclick: async () => {
                if (!(await confirmDialog(`删除事件卡 ${ep.id}？它的消息会重新变成未归档。`, { danger: true }))) return;
                state.episodes = state.episodes.filter((x) => x.id !== ep.id);
                for (const m of state.messages) {
                  if (m.episodeId === ep.id) {
                    m.archived = false;
                    m.episodeId = null;
                  }
                }
                rt.save();
                renderContent();
              },
            },
            '删除'
          )
        )
      );
    }
  }

  function renderPatternsTab() {
    if (!state.patterns.length) {
      content.append(h('p', { class: 'hint' }, '还没有模式。同一件事出现三次以上，才配叫模式。'));
      return;
    }
    for (const p of state.patterns) {
      content.append(
        h(
          'article',
          { class: 'episode' },
          h(
            'div',
            { class: 'episode-head' },
            h('strong', {}, p.name),
            h('span', { class: `chip ${p.status}` }, p.status),
            h('span', { class: 'muted' }, `${p.episodeIds.length} 次`)
          ),
          ...p.quotes.slice(-3).map((q) => h('p', { class: 'quote' }, `“${q.text}”`)),
          p.counterExamples.length
            ? h('p', { class: 'muted' }, `反例：${p.counterExamples.join('；')}`)
            : null,
          h(
            'div',
            { class: 'row' },
            h(
              'button',
              {
                class: 'link-btn',
                type: 'button',
                onclick: () => {
                  const text = window.prompt('记一个反例：哪次你并没有这样？');
                  if (text && text.trim()) {
                    p.counterExamples.push(text.trim());
                    rt.save();
                    renderContent();
                  }
                },
              },
              '加反例'
            ),
            h(
              'button',
              {
                class: 'link-btn danger',
                type: 'button',
                onclick: async () => {
                  if (!(await confirmDialog(`删除模式「${p.name}」？`, { danger: true }))) return;
                  state.patterns = state.patterns.filter((x) => x.id !== p.id);
                  rt.save();
                  renderContent();
                },
              },
              '删除'
            )
          )
        )
      );
    }
  }

  function renderHypothesesTab() {
    if (!state.hypotheses.length) {
      content.append(h('p', { class: 'hint' }, '还没有假设。解释不是结论，它得能被验证或推翻。'));
      return;
    }
    for (const hyp of [...state.hypotheses].reverse()) {
      content.append(
        h(
          'article',
          { class: 'episode' },
          h(
            'div',
            { class: 'episode-head' },
            h('strong', {}, hyp.id),
            h('span', { class: `chip ${hyp.status}` }, hyp.status),
            h('span', { class: 'muted' }, `已过 ${hyp.sessions || 0} 次会话`)
          ),
          h('p', {}, hyp.claim),
          hyp.test ? h('p', { class: 'muted' }, `验证：${hyp.test}`) : null,
          hyp.note ? h('p', { class: 'muted' }, `备注：${hyp.note}`) : null,
          hyp.status === 'open'
            ? h(
                'div',
                { class: 'row' },
                ['confirmed', 'refuted', 'retired'].map((status) =>
                  h(
                    'button',
                    {
                      class: 'link-btn',
                      type: 'button',
                      onclick: () => {
                        hyp.status = status;
                        hyp.note = '手动更新';
                        hyp.reviewAt = Date.now();
                        rt.save();
                        renderContent();
                      },
                    },
                    status === 'confirmed' ? '证实' : status === 'refuted' ? '推翻' : '退休'
                  )
                )
              )
            : null
        )
      );
    }
  }

  renderTabs();
  renderContent();
  drawer('案卷', body);
}

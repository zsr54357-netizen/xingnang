import { truncate } from '../model.js';

export function buildDossier(state) {
  const open = state.cases.filter((c) => c.status === 'open').slice(0, 3);
  const patterns = state.patterns.filter((p) => p.status === 'confirmed').slice(-5);
  const hypotheses = state.hypotheses.filter((h) => h.status === 'open').slice(0, 5);
  const lines = ['## 未结案'];

  if (!open.length) lines.push('（无）');
  for (const c of open) {
    lines.push(`- ${c.id} ${truncate(c.title, 36)}${c.evidence ? ` — ${truncate(c.evidence, 48)}` : ''}`);
  }

  lines.push('', '## 已确认的模式（每条都有原话作证）');
  if (!patterns.length) lines.push('（无）');
  for (const p of patterns) {
    const quote = p.quotes[p.quotes.length - 1];
    lines.push(
      `- ${p.name}（${p.episodeIds.length} 次）${quote ? `：“${truncate(quote.text, 40)}”` : ''}`
    );
  }

  lines.push('', '## 待验证的假设');
  if (!hypotheses.length) lines.push('（无）');
  for (const h of hypotheses) {
    lines.push(`- ${h.id} ${truncate(h.claim, 48)}｜验证：${truncate(h.test, 32)}`);
  }

  if (state.dossier?.whereWeStopped) {
    lines.push('', '## 上次停在这里', truncate(state.dossier.whereWeStopped, 120));
  }

  return truncate(lines.join('\n'), 900);
}

export function readSection(state, section) {
  const name = String(section || '').trim();
  const open = () => {
    const list = state.cases.filter((c) => c.status === 'open');
    return list.length
      ? list.map((c) => `- ${c.id} ${c.title}${c.evidence ? ` — ${c.evidence}` : ''}`).join('\n')
      : '（无）';
  };
  const closed = () => {
    const list = state.cases.filter((c) => c.status === 'closed');
    return list.length
      ? list
          .map((c) => `- ${c.id} ${c.title} → ${c.resolution}：${c.note || ''}`)
          .join('\n')
      : '（无）';
  };
  const patterns = (onlyConfirmed) => {
    const list = state.patterns.filter((p) => !onlyConfirmed || p.status === 'confirmed');
    return list.length
      ? list
          .map((p) => {
            const q = p.quotes[p.quotes.length - 1];
            return `- ${p.name}（${p.status}，${p.episodeIds.length} 次）${q ? `：“${q.text}”` : ''}`;
          })
          .join('\n')
      : '（无）';
  };
  const hypotheses = () => {
    const list = state.hypotheses.filter((h) => h.status === 'open');
    return list.length
      ? list.map((h) => `- ${h.id} ${h.claim}｜验证：${h.test}`).join('\n')
      : '（无）';
  };
  const quotes = () => {
    const list = state.quotes || [];
    return list.length ? list.slice(-20).map((q) => `“${q.text}”`).join('\n') : '（无）';
  };

  const sections = {
    未结案: open,
    已结案: closed,
    反复出现的模式: () => patterns(false),
    已确认的模式: () => patterns(true),
    待验证的假设: hypotheses,
    原话: quotes,
    上次停在这里: () => state.dossier?.whereWeStopped || '（空）',
  };

  if (!name) return renderDossier(state);
  const fn = sections[name];
  return fn ? fn() : `没有「${name}」这一节。可用：${Object.keys(sections).join(' / ')}`;
}

export function renderDossier(state) {
  const open = state.cases.filter((c) => c.status === 'open');
  const closed = state.cases.filter((c) => c.status === 'closed');
  const patterns = state.patterns;
  const hypotheses = state.hypotheses;
  const lines = ['# 卷宗', ''];

  lines.push('## 未结案');
  if (!open.length) lines.push('（无）');
  for (const c of open) {
    lines.push(`- **${c.id}** ${c.title}`);
    if (c.evidence) lines.push(`  - 证据：${c.evidence}`);
  }

  lines.push('', '## 已结案');
  if (!closed.length) lines.push('（无）');
  for (const c of closed.slice(-10)) {
    lines.push(`- ${c.id} ${c.title} → ${c.resolution}：${c.note || ''}`);
  }

  lines.push('', '## 反复出现的模式');
  if (!patterns.length) lines.push('（无）');
  for (const p of patterns) {
    lines.push(`- **${p.name}** · ${p.status} · ${p.episodeIds.length} 次`);
    for (const q of p.quotes.slice(-3)) lines.push(`  - “${q.text}”`);
    if (p.counterExamples.length) {
      lines.push(`  - 反例：${p.counterExamples.join('；')}`);
    }
  }

  lines.push('', '## 假设');
  if (!hypotheses.length) lines.push('（无）');
  for (const h of hypotheses) {
    lines.push(`- ${h.id} · ${h.status} · ${h.claim}`);
    if (h.test) lines.push(`  - 验证：${h.test}`);
  }

  if (state.dossier?.whereWeStopped) {
    lines.push('', '## 上次停在这里', state.dossier.whereWeStopped);
  }

  return lines.join('\n');
}

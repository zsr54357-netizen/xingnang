import { SYSTEM_PROMPT, ARCHIVIST_PROMPT } from './prompts.js';
import { buildDossier } from './memory/dossier.js';
import { recentEpisodes, formatEpisodeCard } from './memory/episodes.js';
import { estimateTokens, trimHistory, LIMITS } from './model.js';

function toApiMessage(m) {
  return { role: m.role, content: m.content };
}

export function assembleContext(state) {
  const dossier = buildDossier(state);
  const cards = recentEpisodes(state, 2).map(formatEpisodeCard).join('\n\n');

  let system = `${SYSTEM_PROMPT}\n\n【卷宗】\n${dossier}`;
  if (cards) system += `\n\n【最近事件卡】\n${cards}`;

  const pending = state.messages.filter((m) => !m.archived);
  const history = trimHistory(pending, LIMITS.historyTokens).map(toApiMessage);

  let messages = [{ role: 'system', content: system }, ...history];
  let tokens = messages.reduce((n, m) => n + estimateTokens(m.content), 0);

  // Hard safety: drop oldest history if a single turn blew the budget.
  while (tokens > LIMITS.contextTokens - LIMITS.outputReserve && messages.length > 2) {
    messages.splice(1, 1);
    tokens = messages.reduce((n, m) => n + estimateTokens(m.content), 0);
  }
  return messages;
}

export function buildArchivistMessages(state, pending) {
  const transcript = pending
    .map((m) => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
    .join('\n\n');
  const system = `${ARCHIVIST_PROMPT}\n\n【现有档案摘要】\n${buildDossier(state)}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: transcript },
  ];
}

export function contextStats(state) {
  const messages = assembleContext(state);
  const tokens = messages.reduce((n, m) => n + estimateTokens(m.content), 0);
  return { messages: messages.length, tokens, budget: LIMITS.contextTokens };
}

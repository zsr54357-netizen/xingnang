import { nextId } from '../model.js';

export function createEpisode(state, card, now = Date.now()) {
  const episode = {
    id: nextId('E', state.episodes),
    startedAt: now,
    endedAt: now,
    card: {
      event: card.event || '',
      quote: card.quote || '',
      payoff: card.payoff || '',
      exit: card.exit || 'open',
      caseId: card.caseId || null,
    },
    cold: false,
  };
  state.episodes.push(episode);
  return episode;
}

export function archiveMessages(state, ids, episodeId) {
  const set = new Set(ids);
  let n = 0;
  for (const m of state.messages) {
    if (set.has(m.id)) {
      m.archived = true;
      m.episodeId = episodeId;
      n++;
    }
  }
  return n;
}

export function episodeMessages(state, id) {
  return state.messages.filter((m) => m.episodeId === id);
}

export function formatEpisodeCard(ep) {
  const c = ep.card || {};
  return [
    `[${ep.id}] ${new Date(ep.startedAt).toLocaleDateString()}`,
    c.event ? `事件：${c.event}` : '',
    c.quote ? `原话：“${c.quote}”` : '',
    c.payoff ? `收益：${c.payoff}` : '',
    c.exit ? `出口：${c.exit}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function recentEpisodes(state, n = 2) {
  return state.episodes.slice(-n).filter((e) => !e.cold);
}

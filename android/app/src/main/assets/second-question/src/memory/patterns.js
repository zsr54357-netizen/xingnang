import { nextId, daysBetween, LIMITS } from '../model.js';

export function upsertPattern(state, { name, episodeId, quote }, now = Date.now()) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  let pattern = state.patterns.find((p) => p.name === clean);
  if (!pattern) {
    pattern = {
      id: nextId('P', state.patterns),
      name: clean,
      episodeIds: [],
      quotes: [],
      counterExamples: [],
      status: 'watching',
      createdAt: now,
      lastSeenAt: now,
    };
    state.patterns.push(pattern);
  }
  if (episodeId && !pattern.episodeIds.includes(episodeId)) {
    pattern.episodeIds.push(episodeId);
  }
  if (quote && !pattern.quotes.some((q) => q.text === quote)) {
    pattern.quotes.push({ msgId: '', text: quote });
  }
  pattern.lastSeenAt = now;
  if (pattern.episodeIds.length >= LIMITS.patternConfirmAt) {
    pattern.status = 'confirmed';
  } else if (pattern.status === 'sleeping') {
    pattern.status = 'watching';
  }
  return pattern;
}

export function refreshPatternStatuses(state, now = Date.now()) {
  for (const pattern of state.patterns) {
    if (pattern.status === 'retired') continue;
    if (daysBetween(pattern.lastSeenAt, now) >= LIMITS.sleepDays) {
      pattern.status = 'sleeping';
    }
  }
}

export function confirmedPatterns(state) {
  return state.patterns.filter((p) => p.status === 'confirmed');
}

export function addCounterExample(state, id, text) {
  const pattern = state.patterns.find((p) => p.id === id);
  if (!pattern) return null;
  if (text) pattern.counterExamples.push(text);
  return pattern;
}

// Pure helpers: token budget, time, ids, archival rules. No DOM, no network.

export const LIMITS = {
  contextTokens: 64000,
  systemTokens: 1600,
  dossierTokens: 900,
  episodeTokens: 450,
  historyTokens: 20000,
  outputReserve: 1000,
  archiveGapMs: 6 * 60 * 60 * 1000,
  archiveMaxTurns: 30,
  openCaseMax: 3,
  patternConfirmAt: 3,
  hypothesisSessionLimit: 5,
  coldDays: 90,
  sleepDays: 60,
};

const CJK = /[\u3400-\u9fff]/;

// Deliberately conservative: Chinese ≈ 0.85 token/char, Latin ≈ 1 token / 3.5 chars.
export function estimateTokens(text = '') {
  let cjk = 0;
  let other = 0;
  for (const ch of String(text)) {
    if (CJK.test(ch)) cjk++;
    else other++;
  }
  return Math.ceil(cjk * 0.85 + other / 3.5);
}

export function localDate(ts = Date.now()) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function weekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDate(d.getTime());
}

export function daysBetween(a, b) {
  return Math.floor((b - a) / 86400000);
}

export function nextId(prefix, items) {
  let max = 0;
  for (const it of items) {
    const m = String(it.id || '').match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export function openCases(state) {
  return state.cases.filter((c) => c.status === 'open');
}

export function canOpenCase(state) {
  return openCases(state).length < LIMITS.openCaseMax;
}

export function pendingMessages(state) {
  return state.messages.filter((m) => !m.archived);
}

export function lastActivity(state) {
  const last = state.messages[state.messages.length - 1];
  return last ? last.ts : 0;
}

export function shouldArchive(state, now = Date.now()) {
  const pending = pendingMessages(state);
  if (pending.length < 4) return false;
  const turns = pending.filter((m) => m.role === 'user').length;
  const gap = now - lastActivity(state);
  return gap > LIMITS.archiveGapMs || turns >= LIMITS.archiveMaxTurns;
}

export function isEpisodeCold(episode, now = Date.now()) {
  return daysBetween(episode.endedAt || episode.startedAt, now) >= LIMITS.coldDays;
}

export function isPatternSleeping(pattern, now = Date.now()) {
  return daysBetween(pattern.lastSeenAt, now) >= LIMITS.sleepDays;
}

export function trimHistory(messages, budget = LIMITS.historyTokens) {
  const out = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const t = estimateTokens(m.content);
    if (total + t > budget && out.length >= 2) break;
    out.unshift(m);
    total += t;
  }
  return out;
}

export function formatDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} 小时 ${r} 分钟` : `${h} 小时`;
}

export function truncate(text, n) {
  const s = String(text || '');
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

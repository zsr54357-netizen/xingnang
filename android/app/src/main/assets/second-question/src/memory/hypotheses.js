import { nextId, LIMITS } from '../model.js';

export function proposeHypothesis(state, { claim, evidence = [], test }, now = Date.now()) {
  const clean = String(claim || '').trim();
  if (!clean) return null;
  const hypothesis = {
    id: nextId('H', state.hypotheses),
    claim: clean,
    evidence: Array.isArray(evidence) ? evidence.filter(Boolean) : [],
    test: String(test || '').trim(),
    status: 'open',
    note: '',
    createdAt: now,
    reviewAt: now,
    sessions: 0,
  };
  state.hypotheses.push(hypothesis);
  return hypothesis;
}

export function reviewHypothesis(state, id, status, note, now = Date.now()) {
  const hypothesis = state.hypotheses.find((h) => h.id === id);
  if (!hypothesis) return null;
  hypothesis.status = status;
  hypothesis.note = note || '';
  hypothesis.reviewAt = now;
  return hypothesis;
}

export function ageHypotheses(state) {
  for (const hypothesis of state.hypotheses) {
    if (hypothesis.status !== 'open') continue;
    hypothesis.sessions = (hypothesis.sessions || 0) + 1;
    if (hypothesis.sessions >= LIMITS.hypothesisSessionLimit) {
      hypothesis.status = 'retired';
      hypothesis.note = hypothesis.note || '五次会话未被验证，自动退休。';
    }
  }
}

export function openHypotheses(state) {
  return state.hypotheses.filter((h) => h.status === 'open');
}

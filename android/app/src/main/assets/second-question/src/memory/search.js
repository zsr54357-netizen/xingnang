// Dependency-free Chinese-friendly retrieval: character bigrams + BM25.

export function tokenize(text) {
  const s = String(text || '').toLowerCase();
  const out = new Set();
  for (const run of s.match(/[\u3400-\u9fff]+/g) || []) {
    if (run.length === 1) out.add(run);
    for (let i = 0; i < run.length - 1; i++) out.add(run.slice(i, i + 2));
  }
  for (const word of s.match(/[a-z0-9]{2,}/g) || []) out.add(word);
  return [...out];
}

export function buildIndex(docs) {
  const df = new Map();
  const postings = new Map();
  const lengths = [];
  docs.forEach((doc, i) => {
    const tokens = tokenize(doc.text);
    lengths[i] = tokens.length;
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [term, n] of tf) {
      df.set(term, (df.get(term) || 0) + 1);
      if (!postings.has(term)) postings.set(term, new Map());
      postings.get(term).set(i, n);
    }
  });
  const avgLen = lengths.reduce((a, b) => a + b, 0) / Math.max(1, docs.length);
  return { docs, df, postings, lengths, avgLen, n: docs.length };
}

export function search(index, query, limit = 5) {
  const terms = tokenize(query);
  if (!terms.length || !index.n) return [];
  const k1 = 1.2;
  const b = 0.75;
  const scores = new Map();
  for (const term of terms) {
    const post = index.postings.get(term);
    if (!post) continue;
    const idf = Math.log(1 + (index.n - post.size + 0.5) / (post.size + 0.5));
    for (const [i, tf] of post) {
      const norm = tf + k1 * (1 - b + b * (index.lengths[i] / (index.avgLen || 1)));
      scores.set(i, (scores.get(i) || 0) + (idf * tf * (k1 + 1)) / norm);
    }
  }
  return [...scores.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([i, score]) => ({ ...index.docs[i], score: Number(score.toFixed(3)) }));
}

export function collectDocs(state) {
  const docs = [];
  for (const ep of state.episodes) {
    const c = ep.card || {};
    docs.push({
      id: ep.id,
      kind: 'episode',
      text: [c.event, c.quote, c.payoff, c.exit].filter(Boolean).join(' '),
      meta: { startedAt: ep.startedAt },
    });
  }
  for (const m of state.messages) {
    if (m.role !== 'user') continue;
    docs.push({
      id: m.id,
      kind: 'message',
      text: m.content,
      meta: { ts: m.ts, episodeId: m.episodeId || null },
    });
  }
  return docs;
}

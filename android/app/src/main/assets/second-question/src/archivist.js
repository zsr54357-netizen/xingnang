import { ARCHIVIST_TOOLS } from './prompts.js';
import { buildArchivistMessages } from './engine.js';
import { createEpisode, archiveMessages } from './memory/episodes.js';
import { ageHypotheses } from './memory/hypotheses.js';
import { refreshPatternStatuses } from './memory/patterns.js';
import { executeTool } from './tools.js';

// A cold, separate pass over the transcript. It never talks to the user.
export async function runArchivist({ state, client, now = Date.now() }) {
  const pending = state.messages.filter((m) => !m.archived);
  if (pending.length < 4) return { ok: false, reason: 'too-few', archived: 0 };

  const messages = buildArchivistMessages(state, pending);
  const res = await client.chatOnce({
    messages,
    tools: ARCHIVIST_TOOLS,
    temperature: 0.2,
    maxTokens: 600,
  });

  if (!res.calls.length) return { ok: false, reason: 'no-tools', archived: 0 };

  // write_episode must run first so bump_pattern can attach evidence to it.
  const ordered = [...res.calls].sort((a, b) => {
    const rank = (c) => (c.name === 'write_episode' ? 0 : c.name === 'bump_pattern' ? 1 : 2);
    return rank(a) - rank(b);
  });

  const ctx = {
    now,
    episodeId: null,
    createEpisode: (card) => createEpisode(state, card, now),
  };

  let wroteEpisode = false;
  for (const call of ordered) {
    try {
      executeTool(state, call.name, call.arguments, ctx);
      if (call.name === 'write_episode' && ctx.episodeId) wroteEpisode = true;
    } catch {
      // A malformed tool call must not destroy the rest of the archive pass.
    }
  }

  if (!wroteEpisode) return { ok: false, reason: 'no-episode', archived: 0 };

  const archived = archiveMessages(
    state,
    pending.map((m) => m.id),
    ctx.episodeId
  );
  ageHypotheses(state);
  refreshPatternStatuses(state, now);
  return { ok: true, archived, episodeId: ctx.episodeId };
}

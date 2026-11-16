import { canOpenCase, nextId } from './model.js';
import { readSection } from './memory/dossier.js';
import { collectDocs, buildIndex, search } from './memory/search.js';
import { episodeMessages, formatEpisodeCard } from './memory/episodes.js';
import { upsertPattern } from './memory/patterns.js';
import { proposeHypothesis, reviewHypothesis } from './memory/hypotheses.js';

function ok(text) {
  return String(text ?? '');
}

export function executeTool(state, name, args = {}, ctx = {}) {
  switch (name) {
    case 'read_memory': {
      return ok(readSection(state, args.section));
    }

    case 'search_memory': {
      const index = buildIndex(collectDocs(state));
      const hits = search(index, args.query || '', args.limit || 5);
      if (!hits.length) return ok('没有找到相关记录。');
      return ok(
        hits
          .map(
            (h) =>
              `[${h.id}] ${h.kind === 'episode' ? '事件卡' : '原话'}：${h.text.slice(0, 160)}`
          )
          .join('\n---\n')
      );
    }

    case 'get_episode': {
      const ep = state.episodes.find((e) => e.id === args.id);
      if (!ep) return ok('没有这张事件卡。');
      const msgs = episodeMessages(state, ep.id)
        .map((m) => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
        .join('\n');
      return ok([formatEpisodeCard(ep), msgs].filter(Boolean).join('\n\n'));
    }

    case 'note_quote': {
      const text = String(args.text || '').trim();
      if (!text) return ok('空的原话，没有记录。');
      state.quotes = state.quotes || [];
      state.quotes.push({
        id: nextId('Q', state.quotes),
        text,
        context: args.context || '',
        ts: ctx.now || Date.now(),
      });
      return ok('已记下。');
    }

    case 'open_case': {
      if (!canOpenCase(state)) {
        return ok('未结案已满三个。先结一个，再开新的。');
      }
      const title = String(args.title || '').trim();
      if (!title) return ok('没有标题，不能开案。');
      const c = {
        id: nextId('C', state.cases),
        title,
        evidence: args.evidence || '',
        openedAt: ctx.now || Date.now(),
        status: 'open',
        resolution: null,
        closedAt: null,
        note: '',
      };
      state.cases.push(c);
      return ok(`已开案 ${c.id}。`);
    }

    case 'close_case': {
      const c = state.cases.find((x) => x.id === args.case_id);
      if (!c) return ok('没有这个案子。');
      if (!['repaired', 'accepted', 'dropped'].includes(args.resolution)) {
        return ok('结案方式只能是 repaired / accepted / dropped。');
      }
      c.status = 'closed';
      c.resolution = args.resolution;
      c.note = args.note || '';
      c.closedAt = ctx.now || Date.now();
      return ok(`已结案 ${c.id}。`);
    }

    case 'propose_hypothesis': {
      const h = proposeHypothesis(
        state,
        { claim: args.claim, evidence: args.evidence, test: args.test },
        ctx.now || Date.now()
      );
      return ok(h ? `已记下假设 ${h.id}，等待验证。` : '假设为空，没有记录。');
    }

    case 'review_hypothesis': {
      if (!['confirmed', 'refuted', 'retired'].includes(args.status)) {
        return ok('假设状态只能是 confirmed / refuted / retired。');
      }
      const h = reviewHypothesis(
        state,
        args.id,
        args.status,
        args.note,
        ctx.now || Date.now()
      );
      return ok(h ? `假设 ${h.id} 已标记为 ${h.status}。` : '没有这个假设。');
    }

    case 'write_episode': {
      const ep = ctx.createEpisode
        ? ctx.createEpisode(args)
        : null;
      if (!ep) return ok('事件卡没有写入。');
      ctx.episodeId = ep.id;
      return ok(`已写入事件卡 ${ep.id}。`);
    }

    case 'bump_pattern': {
      const p = upsertPattern(
        state,
        { name: args.name, episodeId: ctx.episodeId, quote: args.quote },
        ctx.now || Date.now()
      );
      if (!p) return ok('模式为空，没有记录。');
      return ok(`模式「${p.name}」现在是 ${p.status}，共 ${p.episodeIds.length} 次。`);
    }

    case 'update_dossier': {
      state.dossier = state.dossier || {};
      state.dossier.whereWeStopped = String(args.where_we_stopped || '').slice(0, 300);
      state.dossier.updatedAt = ctx.now || Date.now();
      return ok('已更新“上次停在这里”。');
    }

    default:
      return ok(`未知工具：${name}`);
  }
}

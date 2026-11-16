// Weekly export: one ISO week, user messages only, byte-stable output.
// No AI text, no rewriting, no extra fields.

const DAY = 86400000;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// ISO 8601 week for a local calendar date (y, m, d). Standard algorithm:
// move to the Thursday of the week, then count weeks from Jan 1 of that ISO year.
export function isoWeekFromYMD(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7; // Monday=1 .. Sunday=7
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / DAY + 1) / 7);
  return { year: isoYear, week };
}

export function isoWeekRange(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (day - 1) * DAY + (week - 1) * 7 * DAY);
  const sunday = new Date(monday.getTime() + 6 * DAY);
  return { start: formatDate(monday), end: formatDate(sunday) };
}

export function weekLabel(year, week) {
  return `${year}-W${pad(week)}`;
}

// Convert an epoch timestamp to the local calendar date it was sent on.
// tzOffset is the value of Date#getTimezoneOffset() recorded at send time
// (minutes behind UTC; UTC+1 => -60).
function localParts(ts, tzOffset) {
  if (Number.isFinite(tzOffset)) {
    const d = new Date(ts - tzOffset * 60000);
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  }
  const d = new Date(ts);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
}

function weekOf(ts, tzOffset) {
  const [y, m, d] = localParts(ts, tzOffset);
  return isoWeekFromYMD(y, m, d);
}

function normalizeNewlines(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n');
}

function sameWeek(a, b) {
  return a.year === b.year && a.week === b.week;
}

function collectWeekMessages(messages, ref, fallbackOffset) {
  return messages
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => m && m.role === 'user' && Number.isFinite(m.ts))
    .filter(({ m }) => {
      const off = Number.isFinite(m.tzOffset) ? m.tzOffset : fallbackOffset;
      return sameWeek(weekOf(m.ts, off), ref);
    })
    .sort((a, b) => a.m.ts - b.m.ts || a.index - b.index)
    .map(({ m }) => m);
}

export function weeklyStats(messages, { now = Date.now(), tzOffset = null } = {}) {
  const ref = weekOf(now, tzOffset);
  const list = collectWeekMessages(messages, ref, tzOffset);
  const body = list.map((m) => normalizeNewlines(m.content)).join('\n\n');
  return {
    week: weekLabel(ref.year, ref.week),
    start: isoWeekRange(ref.year, ref.week).start,
    end: isoWeekRange(ref.year, ref.week).end,
    count: list.length,
    chars: Array.from(body).length,
  };
}

export function buildWeeklyMarkdown(messages, opts = {}) {
  const stats = weeklyStats(messages, opts);
  if (stats.count === 0) return null;

  const ref = weekOf(opts.now ?? Date.now(), opts.tzOffset ?? null);
  const list = collectWeekMessages(messages, ref, opts.tzOffset ?? null);
  const body = list.map((m) => normalizeNewlines(m.content)).join('\n\n');
  const content =
    `---\nweek: ${stats.week}\nstart: ${stats.start}\nend: ${stats.end}\n---\n\n` +
    `# ${stats.week}\n\n${body}\n`;

  return {
    ...stats,
    filename: `${stats.week}.md`,
    content,
  };
}

export function nextAvailableName(filename, exists) {
  if (!exists(filename)) return filename;
  const base = filename.replace(/\.md$/i, '');
  for (let i = 2; i <= 999; i++) {
    const candidate = `${base} (${i}).md`;
    if (!exists(candidate)) return candidate;
  }
  throw new Error('没有可用的文件名');
}

// Idempotent naming: same content keeps the same file; a changed file for the
// same week gets " (2)", then " (3)", and so on.
export function chooseWeeklyFilename(filename, content, readExisting) {
  const existing = readExisting(filename);
  if (existing == null) return filename;
  if (existing === content) return filename;
  return nextAvailableName(filename, (name) => readExisting(name) != null);
}

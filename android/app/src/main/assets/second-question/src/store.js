import {
  PBKDF2_ITERATIONS,
  decodeRecovery,
  decryptJson,
  deriveKey,
  encodeRecovery,
  encryptJson,
  exportDek,
  fromB64,
  generateDek,
  importDek,
  randomBytes,
  toB64,
  unwrapDek,
  wrapDek,
} from './crypto.js';
import { localDate } from './model.js';

const DB_NAME = 'second-question';
const STORE = 'kv';
const KEY = 'vault';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export function loadRecord() {
  return withStore('readonly', (s) => s.get(KEY)).catch(() => null);
}

export function saveRecord(record) {
  return withStore('readwrite', (s) => s.put(record, KEY));
}

export function clearRecord() {
  return withStore('readwrite', (s) => s.delete(KEY));
}

export function emptyState() {
  return {
    schemaVersion: 2,
    messages: [],
    episodes: [],
    patterns: [],
    hypotheses: [],
    cases: [],
    quotes: [],
    dossier: { whereWeStopped: '', updatedAt: 0 },
    settings: {
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 0.6,
      maxTokens: 800,
      autoLockMinutes: 5,
      lastExportAt: 0,
    },
    usage: { promptTokens: 0, completionTokens: 0 },
    secret: { apiKey: '' },
    meta: { createdAt: Date.now() },
  };
}

export async function createVault(state, passphrase) {
  if (!passphrase) {
    return {
      record: { v: 1, enc: false, data: state, rev: 1 },
      dek: null,
      recovery: null,
    };
  }
  const salt = randomBytes(16);
  const kek = await deriveKey(passphrase, salt);
  const dek = await generateDek();
  const wrapped = await wrapDek(kek, dek);
  const vault = await encryptJson(dek, state);
  const recovery = encodeRecovery(await exportDek(dek));
  return {
    record: {
      v: 1,
      enc: true,
      salt: toB64(salt),
      iter: PBKDF2_ITERATIONS,
      wrapped,
      vault,
      rev: 1,
    },
    dek,
    recovery,
  };
}

export async function unlockVault(record, { passphrase = '', recovery = '' } = {}) {
  if (!record?.enc) return { state: record?.data || emptyState(), dek: null };
  let dek;
  if (recovery) {
    dek = await importDek(decodeRecovery(recovery));
  } else {
    const kek = await deriveKey(passphrase, fromB64(record.salt), record.iter || PBKDF2_ITERATIONS);
    dek = await unwrapDek(kek, record.wrapped);
  }
  try {
    const state = await decryptJson(dek, record.vault);
    return { state, dek };
  } catch {
    const err = new Error('PASSPHRASE');
    err.code = 'PASSPHRASE';
    throw err;
  }
}

export async function persist(record, state, dek) {
  const next = { ...record, rev: (record.rev || 1) + 1 };
  if (record.enc) {
    if (!dek) throw new Error('vault is locked');
    next.vault = await encryptJson(dek, state);
  } else {
    next.data = state;
  }
  await saveRecord(next);
  return next;
}

export async function changePassphrase(record, dek, newPassphrase) {
  if (!record.enc) {
    throw new Error('当前没有口令，请用“设置口令”流程');
  }
  const salt = randomBytes(16);
  const kek = await deriveKey(newPassphrase, salt);
  const wrapped = await wrapDek(kek, dek);
  return {
    ...record,
    salt: toB64(salt),
    iter: PBKDF2_ITERATIONS,
    wrapped,
    rev: (record.rev || 1) + 1,
  };
}

export function buildBackup(record) {
  return JSON.stringify(
    { app: 'second-question', kind: 'backup', version: 1, createdAt: Date.now(), record },
    null,
    2
  );
}

export function parseBackup(text) {
  const json = JSON.parse(text);
  if (json?.kind !== 'backup' || !json.record) throw new Error('不是第二问的备份文件');
  return json.record;
}

export function exportMarkdown(state) {
  const lines = ['# 第二问 · 导出', '', `导出时间：${new Date().toLocaleString()}`, ''];
  lines.push('## 对话', '');
  for (const m of state.messages) {
    if (m.role === 'user') lines.push(`### 我 · ${new Date(m.ts).toLocaleString()}`);
    else if (m.role === 'assistant') lines.push(`### 第二问 · ${new Date(m.ts).toLocaleString()}`);
    else continue;
    lines.push('', m.content, '');
  }
  lines.push('## 事件卡', '');
  for (const ep of state.episodes) {
    const c = ep.card || {};
    lines.push(`### ${ep.id} · ${localDate(ep.startedAt)}`);
    lines.push(`- 事件：${c.event}`);
    lines.push(`- 原话：${c.quote}`);
    lines.push(`- 收益：${c.payoff}`);
    lines.push(`- 出口：${c.exit}`);
    lines.push('');
  }
  lines.push('## 模式', '');
  for (const p of state.patterns) {
    lines.push(`- ${p.name}（${p.status}，${p.episodeIds.length} 次）`);
    for (const q of p.quotes) lines.push(`  - “${q.text}”`);
  }
  lines.push('', '## 假设', '');
  for (const h of state.hypotheses) {
    lines.push(`- ${h.id} [${h.status}] ${h.claim}｜验证：${h.test}`);
  }
  lines.push('', '## 案例', '');
  for (const c of state.cases) {
    lines.push(`- ${c.id} [${c.status}] ${c.title}${c.note ? `：${c.note}` : ''}`);
  }
  if (state.dossier?.whereWeStopped) {
    lines.push('', '## 上次停在这里', state.dossier.whereWeStopped);
  }
  return lines.join('\n');
}

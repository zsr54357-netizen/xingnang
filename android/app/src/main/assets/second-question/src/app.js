import { chatOnce } from './api.js';
import { runArchivist } from './archivist.js';
import { shouldArchive } from './model.js';
import { emptyState, loadRecord, persist } from './store.js';
import { toast } from './ui.js';
import { renderChat } from './views/chat.js';
import { openDiagnostics } from './views/diagnostics.js';
import { renderLock } from './views/lock.js';
import { openMemory } from './views/memory.js';
import { renderOnboarding } from './views/onboarding.js';
import { openSettings } from './views/settings.js';

const app = document.getElementById('app');
const statusbar = document.getElementById('statusbar');

const rt = {
  state: null,
  record: null,
  dek: null,
  busy: false,
  abort: null,
  archiving: false,
};

let saveTimer = null;

function render(node) {
  app.replaceChildren(node);
}

rt.save = () => {
  if (!rt.state || !rt.record) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      rt.record = await persist(rt.record, rt.state, rt.dek);
    } catch (err) {
      console.error('save failed', err);
    }
  }, 350);
};

rt.flush = async () => {
  clearTimeout(saveTimer);
  if (!rt.state || !rt.record) return;
  try {
    rt.record = await persist(rt.record, rt.state, rt.dek);
  } catch (err) {
    console.error('flush failed', err);
  }
};

rt.render = () => {
  if (rt.state) render(renderChat(rt));
};

rt.enter = (state, dek, record) => {
  rt.state = state;
  rt.dek = dek;
  if (record) rt.record = record;
  render(renderChat(rt));
  maybeArchive();
};

rt.openMemory = () => rt.state && openMemory(rt);
rt.openSettings = () => rt.state && openSettings(rt);
rt.openDiagnostics = () => rt.state && openDiagnostics(rt);
rt.maybeArchive = maybeArchive;
rt.archiveNow = () => maybeArchive(true);

async function maybeArchive(force = false) {
  if (!rt.state || rt.archiving || !rt.state.secret?.apiKey) {
    return { ok: false, reason: 'not-ready' };
  }
  if (!force && !shouldArchive(rt.state)) return { ok: false, reason: 'not-needed' };
  rt.archiving = true;
  if (statusbar) {
    statusbar.hidden = false;
    statusbar.textContent = '正在整理上次对话…';
  }
  try {
    const client = {
      chatOnce: (opts) =>
        chatOnce({
          ...opts,
          baseUrl: rt.state.settings.baseUrl,
          apiKey: rt.state.secret.apiKey,
          model: rt.state.settings.model,
        }),
    };
    const result = await runArchivist({ state: rt.state, client });
    if (result.ok) {
      rt.save();
      toast('档案已更新');
    }
    return result;
  } catch (err) {
    console.warn('archivist failed', err);
    return { ok: false, reason: 'error' };
  } finally {
    rt.archiving = false;
    if (statusbar) statusbar.hidden = true;
  }
}

let hiddenAt = 0;

document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    await rt.flush();
    return;
  }
  if (!hiddenAt || !rt.record?.enc || !rt.state) return;
  const minutes = rt.state.settings.autoLockMinutes || 5;
  if (Date.now() - hiddenAt > minutes * 60000) {
    rt.state = null;
    rt.dek = null;
    render(renderLock(rt));
  }
});

async function boot() {
  const record = await loadRecord();
  rt.record = record;
  if (!record) {
    render(renderOnboarding(rt));
    return;
  }
  if (record.enc) {
    render(renderLock(rt));
    return;
  }
  rt.state = record.data || emptyState();
  render(renderChat(rt));
  maybeArchive();
}

boot();

const localHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if ('serviceWorker' in navigator) {
  if (localHost) {
    // The APK serves its own assets and dev runs on a live server; a cache in
    // between only makes edits look stale. Remove any old worker on these hosts.
    navigator.serviceWorker
      .getRegistrations()
      .then((list) => list.forEach((reg) => reg.unregister()))
      .catch(() => {});
  } else {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('sw', err));
  }
}

if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

const K = { NESTS: 'tn:nests', LAST: 'tn:lastNest' };
const CAP = 40;
const MB_PER_HTTP_TAB = 12;

let nests = [];
let query = '';

const getLocal = (keys) => chrome.storage.local.get(keys);
const setLocal = (obj) => chrome.storage.local.set(obj);

function L(key, params) {
  return window.__tnT(key, undefined, params);
}

function tsName(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function shortHost(url) {
  try {
    return new URL(url).host;
  } catch (e) {
    return 'other';
  }
}

function ramMB(n) {
  return n * MB_PER_HTTP_TAB;
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg || '';
}

async function currentWindowTabs() {
  const win = await chrome.windows.getCurrent({ populate: true });
  return win.tabs.filter((t) => t && !t.url.startsWith('chrome-extension://'));
}

async function nestWindow() {
  const tabs = await currentWindowTabs();
  if (!tabs.length) {
    setStatus(L('emptyWin'));
    return { count: 0, ramMB: 0 };
  }
  const nest = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    ts: Date.now(),
    name: tsName(Date.now()),
    tabs: tabs.map((t) => ({ url: t.url, title: t.title || t.url })),
  };
  nests = [nest, ...nests].slice(0, CAP);
  await setLocal({ [K.NESTS]: nests, [K.LAST]: nest.ts });
  await chrome.tabs.remove(tabs.map((t) => t.id));
  render();
  setStatus(L('closedN', { n: tabs.length }));
  return { count: tabs.length, ramMB: ramMB(tabs.length) };
}

async function restoreNest(id, keep) {
  const nest = nests.find((x) => x.id === id);
  if (!nest) return 0;
  for (const tab of nest.tabs) {
    if (tab.url && !tab.url.startsWith('chrome-extension://')) {
      await chrome.tabs.create({ url: tab.url, active: false });
    }
  }
  if (!keep) {
    nests = nests.filter((x) => x.id !== id);
    await setLocal({ [K.NESTS]: nests });
  }
  render();
  setStatus(L('restored'));
  return nest.tabs.length;
}

async function restoreAll() {
  const all = [...nests];
  let n = 0;
  for (const nest of all) n += await restoreNest(nest.id, true);
  nests = [];
  await setLocal({ [K.NESTS]: nests });
  render();
  setStatus(L('restoredAll'));
  return n;
}

function domainCounts(nest) {
  const m = new Map();
  for (const t of nest.tabs) {
    const h = shortHost(t.url);
    m.set(h, (m.get(h) || 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

function filtered() {
  if (!query) return nests;
  const q = query.toLowerCase();
  return nests.filter((n) => {
    if (n.name.toLowerCase().includes(q)) return true;
    if (n.tabs.some((t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))) return true;
    if (domainCounts(n).some(([h]) => h.includes(q))) return true;
    return false;
  });
}

function render() {
  const listEl = document.getElementById('list');
  const total = nests.reduce((a, n) => a + n.tabs.length, 0);
  document.getElementById('statsSum').textContent = L('statsSum', { n: total, mb: ramMB(total) });
  const last = nests.length ? nests[0].ts : 0;
  document.getElementById('lastRow').textContent = L('lastNest') + ' · ' + (last ? tsName(last) : L('never'));

  const rows = filtered();
  listEl.textContent = '';
  if (!rows.length) {
    const div = document.createElement('div');
    div.className = query ? 'nores' : 'empty';
    div.textContent = query ? L('nores') : L('empty');
    listEl.appendChild(div);
    return;
  }
  for (const n of rows) {
    const card = document.createElement('div');
    card.className = 'ncard';

    const name = document.createElement('div');
    name.className = 'sname';
    name.textContent = n.name;
    card.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent =
      L('tabsN', { n: n.tabs.length }) + ' · ' + L('ram', { mb: ramMB(n.tabs.length) }) + ' · ' + L('doms', { n: domainCounts(n).length });
    card.appendChild(meta);

    const dash = document.createElement('div');
    dash.className = 'dashboard';
    for (const [h, c] of domainCounts(n).slice(0, 4)) {
      const ch = document.createElement('span');
      ch.className = 'dchip';
      ch.textContent = h + ' ×' + c;
      dash.appendChild(ch);
    }
    card.appendChild(dash);

    const urlLine = document.createElement('div');
    urlLine.className = 'urlline';
    urlLine.textContent = n.tabs
      .slice(0, 3)
      .map((t) => t.url)
      .join('  ·  ');
    card.appendChild(urlLine);

    const btns = document.createElement('div');
    btns.className = 'rowbtns';

    const restore = document.createElement('button');
    restore.className = 'restore-b';
    restore.textContent = L('restore');
    restore.addEventListener('click', () => restoreNest(n.id, false));
    btns.appendChild(restore);

    const del = document.createElement('button');
    del.className = 'del-b';
    del.textContent = L('del');
    del.addEventListener('click', async () => {
      if (del.textContent === L('sure')) {
        nests = nests.filter((x) => x.id !== n.id);
        await setLocal({ [K.NESTS]: nests });
        render();
        return;
      }
      del.textContent = L('sure');
      setTimeout(() => {
        if (del.isConnected) del.textContent = L('del');
      }, 2500);
    });
    btns.appendChild(del);

    card.appendChild(btns);
    listEl.appendChild(card);
  }
}

async function init() {
  await window.__tnApply(document);
  const s = await getLocal([K.NESTS, K.LAST]);
  nests = Array.isArray(s[K.NESTS]) ? s[K.NESTS] : [];
  if (!Array.isArray(s[K.NESTS]) || typeof s[K.LAST] !== 'number') {
    await setLocal({ [K.NESTS]: nests, [K.LAST]: typeof s[K.LAST] === 'number' ? s[K.LAST] : 0 });
  }
  render();

  document.getElementById('nestBtn').addEventListener('click', () => nestWindow());

  document.getElementById('searchInput').addEventListener('input', (e) => {
    query = e.target.value.trim();
    render();
  });

  document.getElementById('delAllBtn').addEventListener('click', (e) => {
    const btn = e.target;
    if (btn.textContent === L('sure')) {
      nests = [];
      setLocal({ [K.NESTS]: nests });
      render();
      setStatus(L('cleared'));
      return;
    }
    btn.textContent = L('sure');
    setTimeout(() => {
      if (btn.isConnected) btn.textContent = L('clearAll');
    }, 2500);
  });

  document.getElementById('restoreAllBtn').addEventListener('click', () => restoreAll());
}

init();

window.__tnNestWindow = nestWindow;
window.__tnRestoreNest = restoreNest;
window.__tnRestoreAll = restoreAll;
window.__tnCurrentWindowTabs = currentWindowTabs;
window.__tnNests = () => Promise.resolve([...nests]);
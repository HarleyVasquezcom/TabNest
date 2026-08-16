import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';

let puppeteer;
try {
  puppeteer = createRequire(import.meta.url)('puppeteer');
} catch (e) {
  console.error('puppeteer not installed — run `npm install` first');
  process.exit(2);
}
let CHROME;
try {
  CHROME = process.env.PROBE_CHROME || (await puppeteer.executablePath());
} catch (e) {
  CHROME = process.env.PROBE_CHROME;
}

const DEPLOY_URL = (process.env.TABNEST_DEPLOY_URL || '').replace(/\/+$/, '');
const EXT = path.resolve(import.meta.dirname, '..');
const EXT_FWD = EXT.replaceAll('\\', '/');
const FIXTURE = fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'site.html'), 'utf8');

const EXPECTED_LABELS = {
  tagline: {
    en: 'hive the window, keep the pages',
    es: 'encierra la ventana, conserva las páginas',
    fr: 'rucher la fenêtre, garder les pages',
    pt: 'aninhe a janela, guarde as páginas',
    it: 'nidifica la finestra, conserva le pagine',
    de: 'Fenster aufstapeln, Seiten behalten',
  },
  credit: {
    en: 'Built by Harley Vásquez', es: 'Creado por Harley Vásquez', fr: 'Créé par Harley Vásquez',
    pt: 'Criado por Harley Vásquez', it: 'Creato da Harley Vásquez', de: 'Erstellt von Harley Vásquez',
  },
};

const EXPECTED_STATS = {
  en: '2 tabs · 24 MB', es: '2 pestañas · 24 MB', fr: '2 onglets · 24 Mo',
  pt: '2 guias · 24 MB', it: '2 schede · 24 MB', de: '2 Tabs · 24 MB',
};

let passes = 0;
let failures = 0;
const problems = [];
const check = (name, ok, detail = '') => {
  if (ok) {
    passes++;
    console.log('  PASS ' + name);
  } else {
    failures++;
    problems.push(name + (detail ? ' — ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      /* retry */
    }
    await sleep(150);
  }
  return null;
};
const getAll = async (popup) => (await popup.evaluate(() => chrome.storage.local.get(null)));
const safeClose = (p) => {
  if (p && !p.isClosed()) p.close().catch(() => {});
};

console.log('TabNest probe (extension: ' + EXT + ')');

const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  if (p === '/site.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(FIXTURE);
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const SITE_PAGE = `http://127.0.0.1:${PORT}/site.html`;
const SITE_ANY = `http://127.0.0.1:${PORT}/*`;
const LANDING = path.join(EXT, 'landing', 'index.html');
console.log('fixture server: ' + SITE_PAGE);
let ZIP_BYTES = null;

const browser = await puppeteer.launch({
  headless: true,
  executablePath: CHROME,
  args: [`--disable-extensions-except=${EXT_FWD}`, `--load-extension=${EXT_FWD}`],
  protocolTimeout: 60000,
});

let pageA = null;
let pageB = null;
let popup = null;
const popupErrors = [];
try {
  // ---------- BASELINE ----------
  const base = await browser.newPage();
  const baseErrors = [];
  base.on('pageerror', (e) => baseErrors.push(e.message));
  await base.goto(SITE_PAGE + '?noext=1', { waitUntil: 'domcontentloaded' });
  await base.bringToFront();
  await sleep(500);
  check('baseline: fixture loads', (await base.evaluate(() => document.title)) === 'TabNest fixture — the weekend market', '');
  check('baseline: no JS errors on fixture page', baseErrors.length === 0, baseErrors.join(' | '));
  await base.close();

  // ---------- EXTENSION REGISTERED ----------
  const reg = await browser.newPage();
  await reg.goto('chrome://extensions-internals', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const data = JSON.parse(await reg.evaluate(() => document.body.innerText));
  const entry = data.find((e) => e.name === 'TabNest');
  check('extension registered and ENABLED', !!entry && entry.registry_status === 'ENABLED' && entry.location === 'COMMAND_LINE', entry ? entry.registry_status : 'not found');
  check('manifest_version 3 confirmed by Chrome', entry ? entry.manifest_version === 3 : false, '');
  if (!entry) throw new Error('TabNest extension not found');
  const popupUrl = `chrome-extension://${entry.id}/popup.html`;
  await reg.close();

  // fixture tabs (real browser tabs, same window as the popup tab)
  pageA = await browser.newPage();
  await pageA.goto(SITE_PAGE, { waitUntil: 'domcontentloaded' });
  const stray = (await browser.pages()).filter((p) => p !== pageA);
  for (const s of stray) await s.close();
  await sleep(300);
  pageB = await browser.newPage();
  await pageB.goto(SITE_PAGE + '?b=1', { waitUntil: 'domcontentloaded' });
  await pageB.bringToFront();
  await sleep(500);

  // ---------- POPUP ----------
  popup = await browser.newPage();
  popup.on('pageerror', (e) => popupErrors.push(e.message));
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.getElementById('nestBtn') !== null, { timeout: 8000, polling: 100 });
  await sleep(500);

  const defaults = await getAll(popup);
  check('defaults: tn:nests = []', Array.isArray(defaults['tn:nests']) && defaults['tn:nests'].length === 0, '');
  check('popup renders without JS exceptions', popupErrors.length === 0, popupErrors.join(' | '));
  check('popup shows empty state', (await popup.evaluate(() => !!document.querySelector('#list .empty'))) === true, '');
  check(
    'popup surface: nest, restore-all, search, clear-all, lang, credit',
    (await popup.evaluate(
      () =>
        ['nestBtn', 'restoreAllBtn', 'searchInput', 'delAllBtn', 'langSel'].every((id) => !!document.getElementById(id)) &&
        !!document.querySelector('.credit')
    )) === true,
    ''
  );

  // ---------- PERMISSION SURFACE ----------
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const hasAllUrls = (m) => /<all_urls>/.test(JSON.stringify(m));
  check(
    'permission surface: storage + tabs only, no host permissions',
JSON.stringify(manifest.permissions) === JSON.stringify(['storage', 'tabs']) &&
  Array.isArray(manifest.content_scripts) === false &&
  Array.isArray(manifest.host_permissions) === false &&
  !('background' in manifest) &&
  !hasAllUrls(manifest),
    JSON.stringify(manifest.permissions)
  );

  // ---------- NEST ----------
  const nestRes = await popup.evaluate(async () => await window.__tnNestWindow());
  check('nest: closed 2 tabs and stored a nest', nestRes.count === 2 && nestRes.ramMB === 24, JSON.stringify(nestRes));
  const fixtureTabsGone = await popup.evaluate(async (any) => (await chrome.tabs.query({ url: any })).length, SITE_ANY);
  check('nest: fixture tabs are closed', fixtureTabsGone === 0, 'left=' + fixtureTabsGone);
  const nests1 = await popup.evaluate(async () => (await chrome.storage.local.get('tn:nests'))['tn:nests']);
  check('nest: tn:nests holds 1 nest with 2 tabs', Array.isArray(nests1) && nests1.length === 1 && nests1[0].tabs.length === 2, '');
  if (nests1 && nests1[0]) {
    check(
      'nest: tab URLs + titles recorded',
      nests1[0].tabs.every((t) => t.url.startsWith(SITE_PAGE) && t.title.includes('market')),
      JSON.stringify(nests1[0].tabs)
    );
    check('nest: timestamp + name present', typeof nests1[0].ts === 'number' && nests1[0].name.length >= 10, '');
  }
  const last = await popup.evaluate(async () => (await chrome.storage.local.get('tn:lastNest'))['tn:lastNest']);
  check('nest: tn:lastNest updated', typeof last === 'number' && last === nests1[0].ts, '');
  check(
    'nest: card shows tab count / RAM estimate / domain chip',
    (await popup.evaluate(() => {
      const card = document.querySelector('.ncard');
      const meta = card?.querySelector('.meta')?.textContent || '';
      const chips = card?.querySelector('.dashboard')?.textContent || '';
      return !!card && meta.includes('2 tabs') && meta.includes('24 MB') && chips.includes('127.0.0.1');
    })) === true,
    ''
  );
  check('nest: status message shown', (await popup.evaluate(() => document.getElementById('status').textContent.length)) > 0, '');
  check(
    'nest: stats row totals (2 tabs · 24 MB)',
    (await popup.evaluate(() => document.getElementById('statsSum').textContent)) === '2 tabs · 24 MB',
    await popup.evaluate(() => document.getElementById('statsSum').textContent)
  );

  // ---------- RESTORE ----------
  const restoredCount = await popup.evaluate(async () => {
    const id = (await chrome.storage.local.get('tn:nests'))['tn:nests'][0].id;
    return await window.__tnRestoreNest(id, false);
  });
  const restoredTabs = await waitFor(async () => {
    const tabs = await popup.evaluate(async (p) => chrome.tabs.query({ url: p }), SITE_ANY);
    return tabs.length >= 2 ? tabs.length : null;
  }, 8000);
  check('restore: reopened both fixture tabs', restoredTabs === 2 && restoredCount === 2, 'count=' + restoredTabs);
  const afterRestore = await popup.evaluate(async () => (await chrome.storage.local.get('tn:nests'))['tn:nests'].length);
  check('restore: nest removed from the list (OneTab-style)', afterRestore === 0, 'left=' + afterRestore);

  // ---------- RELOAD: persistence ----------
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.getElementById('nestBtn') !== null, { timeout: 8000, polling: 100 });
  await sleep(500);
  check('reload: empty state persists', (await popup.evaluate(() => !!document.querySelector('#list .empty'))) === true, '');

  // ---------- SEARCH ----------
  await popup.evaluate(async (sp) => {
    const n1 = { id: 'n1', ts: 1786881000000, name: '2026-08-16 09:00', tabs: [{ url: sp, title: 'the weekend market' }] };
    await chrome.storage.local.set({ 'tn:nests': [n1] });
  }, SITE_PAGE);
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.getElementById('nestBtn') !== null, { timeout: 8000, polling: 100 });
  await sleep(400);
  check('search is ready (1 card)', (await popup.evaluate(() => document.querySelectorAll('.ncard').length)) === 1, '');
  await popup.evaluate(() => {
    document.getElementById('searchInput').value = 'market';
    document.getElementById('searchInput').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(300);
  check('search "market" matches (tab title)', (await popup.evaluate(() => document.querySelectorAll('.ncard').length)) === 1, '');
  await popup.evaluate(() => {
    document.getElementById('searchInput').value = 'zzz';
    document.getElementById('searchInput').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(300);
  check('search miss shows no-results state', (await popup.evaluate(() => !!document.querySelector('#list .nores'))) === true, '');
  await popup.evaluate(() => {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchInput').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(300);
  check('search cleared: card visible again', (await popup.evaluate(() => document.querySelectorAll('.ncard').length)) === 1, '');

  // ---------- DELETE (two-step) ----------
  await popup.evaluate(() => document.querySelector('.ncard .del-b').click());
  await sleep(200);
  const armed = await popup.evaluate(async () => document.querySelector('.ncard .del-b').textContent === (await window.__tnT('sure')));
  check('delete: first click arms "Sure?"', armed === true, '');
  await popup.evaluate(() => document.querySelector('.ncard .del-b').click());
  const afterDel = await waitFor(async () => {
    const s = await popup.evaluate(async () => (await chrome.storage.local.get('tn:nests'))['tn:nests']);
    return s.length === 0 ? true : null;
  }, 6000);
  check('delete: second click removes the nest', afterDel === true, '');

  // ---------- RESTORE ALL ----------
  await popup.evaluate(async (sp, sp2) => {
    const n1 = { id: 'a1', ts: 1786881000000, name: '2026-08-16 09:00', tabs: [{ url: sp, title: 'the weekend market' }, { url: sp2, title: 'market b' }] };
    const n2 = { id: 'a2', ts: 1786881060000, name: '2026-08-16 09:10', tabs: [{ url: sp, title: 'the weekend market' }] };
    await chrome.storage.local.set({ 'tn:nests': [n1, n2] });
  }, SITE_PAGE, SITE_PAGE + '?b=1');
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.getElementById('nestBtn') !== null, { timeout: 8000, polling: 100 });
  await sleep(400);
  const tabs0 = (await popup.evaluate(async (p) => (await chrome.tabs.query({ url: p })).length, SITE_ANY));
  const nAll = await popup.evaluate(async () => await window.__tnRestoreAll());
  const tabs1 = await waitFor(async () => {
    const t = await popup.evaluate(async (p) => (await chrome.tabs.query({ url: p })).length, SITE_ANY);
    return t >= tabs0 + 3 ? t : null;
  }, 12000);
  check('restore all: every nest tab reopened (3 new)', tabs1 === tabs0 + 3 && nAll === 3, 'before=' + tabs0 + ' after=' + tabs1 + ' n=' + nAll);
  const afterAll = await popup.evaluate(async () => (await chrome.storage.local.get('tn:nests'))['tn:nests'].length);
  check('restore all: nests cleared', afterAll === 0, 'left=' + afterAll);

  // ---------- CLEAR ALL (two-step) ----------
  await popup.evaluate(async (sp) => {
    await chrome.storage.local.set({ 'tn:nests': [{ id: 'z1', ts: 1786881000000, name: 'x 1', tabs: [{ url: sp, title: 'x' }] }] });
  }, SITE_PAGE);
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.getElementById('nestBtn') !== null, { timeout: 8000, polling: 100 });
  await sleep(400);
  check('clear all is ready (1 card)', (await popup.evaluate(() => document.querySelectorAll('.ncard').length)) === 1, '');
  await popup.evaluate(() => document.getElementById('delAllBtn').click());
  await sleep(150);
  await popup.evaluate(() => document.getElementById('delAllBtn').click());
  const cleared = await waitFor(async () => {
    const s = await popup.evaluate(async () => (await chrome.storage.local.get('tn:nests'))['tn:nests']);
    return s.length === 0 ? true : null;
  }, 6000);
  check('clear all: nests emptied (two-step)', cleared === true, '');
  check('clear all: empty state back', (await popup.evaluate(() => !!document.querySelector('#list .empty'))) === true, '');

  // ---------- i18n popup ----------
  const langCheck = async (code) => {
    await popup.select('#langSel', code);
    const ok = await waitFor(() => popup.evaluate((exp) => document.querySelector('[data-i18n="tagline"]')?.textContent === exp, EXPECTED_LABELS.tagline[code]), 6000);
    check(`language switch to ${code} re-renders popup`, ok === true, EXPECTED_LABELS.tagline[code]);
    if (ok) {
      const credit = await popup.evaluate(() => document.querySelector('.credit')?.textContent);
      check(`language ${code}: credit localized`, credit === EXPECTED_LABELS.credit[code], credit);
      await popup.evaluate(async (sp) => {
        await chrome.storage.local.set({ 'tn:nests': [{ id: 'stats', ts: 1, name: 'x', tabs: [{ url: sp, title: 'a' }, { url: sp, title: 'b' }] }] });
      }, SITE_PAGE);
      await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
      await popup.waitForFunction(() => document.getElementById('nestBtn') !== null, { timeout: 8000, polling: 100 });
      await sleep(300);
      const statsText = await popup.evaluate(() => document.getElementById('statsSum').textContent);
      check(`language ${code}: live stats row localized`, statsText === EXPECTED_STATS[code], statsText);
      await popup.evaluate(() => chrome.storage.local.set({ 'tn:nests': [] }));
      await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
      await popup.waitForFunction(() => document.querySelector('[data-i18n="tagline"]')?.textContent !== '', { timeout: 8000, polling: 100 });
      const persisted = await popup.evaluate((exp) => document.querySelector('[data-i18n="tagline"]')?.textContent === exp, EXPECTED_LABELS.tagline[code]);
      check(`language ${code}: persisted across reload`, persisted === true, 'reverted');
    }
  };
  await popup.select('#langSel', 'en');
  await sleep(200);
  for (const code of ['es', 'fr', 'pt', 'it', 'de']) {
    await langCheck(code);
  }
  await popup.evaluate(() => chrome.storage.local.remove('tn:lang'));
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.querySelector('[data-i18n="tagline"]')?.textContent !== '', { timeout: 8000, polling: 100 });
  const navLang = await popup.evaluate(() => (navigator.language || 'en').toLowerCase().split('-')[0]);
  const defaulted = await popup.evaluate(() => document.querySelector('[data-i18n="tagline"]')?.textContent);
  check('default language = navigator language (or en)', ['en', 'es', 'fr', 'pt', 'it', 'de'].includes(navLang) && EXPECTED_LABELS.tagline[navLang] === defaulted, `nav=${navLang} got=${defaulted}`);
  await popup.evaluate(() => chrome.storage.local.set({ 'tn:lang': 'en' }));
  const popupCreditUrl = await popup.evaluate(() => document.querySelector('.credit').href);
  check('credit links to LinkedIn (popup)', popupCreditUrl === 'https://www.linkedin.com/in/harleyvasquez/', popupCreditUrl);

  // ---------- FROZEN ----------
  const frozenAll = await getAll(popup);
  const keys = Object.keys(frozenAll).filter((k) => k.startsWith('tn:'));
  check(
    'frozen: only the 3 tn:* keys in storage',
    keys.length === 3 && ['tn:nests', 'tn:lastNest', 'tn:lang'].every((k) => keys.includes(k)),
    keys.join(',')
  );

  // ---------- Landing ----------
  const landing = await browser.newPage();
  const landingErrors = [];
  landing.on('pageerror', (e) => landingErrors.push(e.message));
  await landing.goto('file://' + LANDING.replaceAll('\\', '/'), { waitUntil: 'domcontentloaded' });
  await sleep(700);
  const heroOk = await landing.evaluate(() => {
    const t = document.querySelector('[data-i18n="heroTitle"]')?.textContent || '';
    return t.length > 0 && document.title !== '';
  });
  check('landing renders with localized hero', heroOk === true, '');
  await landing.select('#langSel', 'es');
  const heroEs = await waitFor(() => landing.evaluate(() => document.querySelector('[data-i18n="tagline"]')?.textContent), 5000);
  check('landing switch to es works', heroEs?.length > 5, heroEs);
  check('no JS errors on landing', landingErrors.length === 0, landingErrors.join(' | '));
  const landingCreditUrl = await landing.evaluate(() => document.querySelector('[data-i18n="credit"]')?.href);
  check('credit links to LinkedIn (landing)', landingCreditUrl === 'https://www.linkedin.com/in/harleyvasquez/', landingCreditUrl);
  await landing.close();

  // ---------- Packaging ----------
  const zipPath = path.join(EXT, 'dist', 'tabnest.zip');
  const landingZip = path.join(EXT, 'landing', 'tabnest.zip');
  check('dist/tabnest.zip exists', fs.existsSync(zipPath), zipPath);
  check('landing/tabnest.zip exists (CTA target)', fs.existsSync(landingZip), landingZip);
  if (fs.existsSync(zipPath) && fs.existsSync(landingZip)) {
    const s = fs.statSync(zipPath);
    const l = fs.statSync(landingZip);
    check('landing zip byte-identical to dist zip', s.size === l.size && s.size > 0, `dist=${s.size} landing=${l.size}`);
    ZIP_BYTES = l.size;
  }
  const iconOk = ['icon16.png', 'icon48.png', 'icon128.png'].every((f) => {
    const p = path.join(EXT, 'icons', f);
    return fs.existsSync(p) && fs.readFileSync(p)[0] === 0x89 && fs.readFileSync(p)[1] === 0x50;
  });
  check('icons 16/48/128 present and valid PNG', iconOk, '');

  // ---------- Deploy (gated) ----------
  if (DEPLOY_URL) {
    try {
      const res = await fetch(DEPLOY_URL + '/', { headers: { 'User-Agent': 'tabnest-probe' } });
      const body = await res.text();
      check('deployed landing responds (Vercel)', res.status === 200 && body.includes('TabNest'), res.status + ' len=' + body.length);
      const zipRes = await fetch(DEPLOY_URL + '/tabnest.zip', { headers: { 'User-Agent': 'tabnest-probe' } });
      const zipBody = await zipRes.arrayBuffer();
      check('deployed landing serves the extension zip', zipRes.status === 200 && typeof ZIP_BYTES === 'number' && zipBody.byteLength === ZIP_BYTES, zipRes.status + ' bytes=' + zipBody.byteLength + ' expected=' + ZIP_BYTES);
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      check('deployed landing responds (Vercel)', false, msg);
      check('deployed landing serves the extension zip', false, msg);
    }
  } else {
    console.log('  [info] TABNEST_DEPLOY_URL not set; skipping deployed-landing checks.');
  }
} finally {
  safeClose(popup);
  safeClose(pageA);
  safeClose(pageB);
  if (browser) browser.close().catch(() => {});
  server.close();
}

console.log('');
console.log(`RESULT: ${passes} passed, ${failures} failed`);
if (failures > 0) {
  console.log('PROBLEMS:');
  for (const p of problems) console.log('  - ' + p);
  process.exit(1);
}
process.exit(0);
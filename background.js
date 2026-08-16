const K = {
  NESTS: 'tn:nests',
  LAST: 'tn:lastNest',
  LANG: 'tn:lang',
};

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get([K.NESTS, K.LAST]);
  if (!Array.isArray(cur[K.NESTS])) await chrome.storage.local.set({ [K.NESTS]: [] });
  if (typeof cur[K.LAST] !== 'number') await chrome.storage.local.set({ [K.LAST]: 0 });
});
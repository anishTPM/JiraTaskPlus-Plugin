const FOCUS_KEY = 'jtp-focus-mode';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Reflect current focus mode state on load
chrome.storage.local.get(FOCUS_KEY, (data) => {
  if (data[FOCUS_KEY]) {
    document.getElementById('focus-label').textContent = 'Exit Focus Mode';
    document.getElementById('focus-icon').textContent = '👁️';
    document.getElementById('btn-focus').classList.add('active');
  }
});

document.getElementById('btn-options').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings/options.html') });
  window.close();
});

document.getElementById('btn-focus').addEventListener('click', async () => {
  const data = await chrome.storage.local.get(FOCUS_KEY);
  const next = !data[FOCUS_KEY];
  chrome.storage.local.set({ [FOCUS_KEY]: next });

  const tab = await getActiveTab();
  chrome.tabs.sendMessage(tab.id, { type: 'JTP_FOCUS_MODE', enabled: next });
  window.close();
});

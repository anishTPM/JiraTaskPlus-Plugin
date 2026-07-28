// ── Calendar Background Handler ─────────────────────────────────────────────
// Relay content script registers itself via JTP_RELAY_REGISTER.
// Tab ID is persisted to storage.session to survive SW restarts.

export function initCalendarBackground() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'JTP_RELAY_REGISTER') {
      if (sender.tab?.id) {
        chrome.storage.session.set({ jtpRelayTabId: sender.tab.id, jtpRelayTabUrl: sender.tab.url || '' });
      }
      return;
    }
    if (msg.type === 'JTP_CALENDAR_DEBUG') {
      debugCalendarTokens().then(sendResponse).catch(e => sendResponse({ error: e.message }));
      return true;
    }
    if (msg.type === 'JTP_CALENDAR_RELAY') {
      const pending = pendingRelays.get(msg.nonce);
      if (pending) { clearTimeout(pending.timer); pending.resolve(msg.result); pendingRelays.delete(msg.nonce); }
      return;
    }
    if (msg.type !== 'JTP_CALENDAR_FETCH') return;
    handleCalendarFetch(msg.url).then(sendResponse).catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  });

  // Clear stored tab ID when the relay tab is closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.session.get('jtpRelayTabId', ({ jtpRelayTabId }) => {
      if (jtpRelayTabId === tabId) chrome.storage.session.remove(['jtpRelayTabId', 'jtpRelayTabUrl']);
    });
  });
}

const pendingRelays = new Map();

async function getStoredRelay() {
  return new Promise(resolve => {
    chrome.storage.session.get(['jtpRelayTabId', 'jtpRelayTabUrl'], (res) => {
      resolve({ tabId: res.jtpRelayTabId ?? null, tabUrl: res.jtpRelayTabUrl ?? '' });
    });
  });
}

async function getRelayTab() {
  return getStoredRelay();
}

async function handleCalendarFetch(url) {
  const { tabId, tabUrl } = await getRelayTab();
  if (!tabId) return { ok: false, error: 'Open your Outlook calendar tab first, then try again.' };

  let apiUrl = url;
  if (tabUrl.includes('outlook.cloud.microsoft')) {
    apiUrl = url.replace('https://outlook.office.com', 'https://outlook.cloud.microsoft');
  } else if (tabUrl.includes('outlook.office365.com')) {
    apiUrl = url.replace('https://outlook.office.com', 'https://outlook.office365.com');
  }

  return sendToRelay(tabId, { action: 'FETCH_CALENDAR', apiUrl });
}

async function debugCalendarTokens() {
  const { tabId } = await getRelayTab();
  if (!tabId) return { error: 'No Outlook tab registered' };
  return sendToRelay(tabId, { action: 'DEBUG_TOKENS' });
}

function sendToRelay(tabId, payload) {
  return new Promise((resolve) => {
    const nonce = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      pendingRelays.delete(nonce);
      resolve({ ok: false, error: 'Timed out. Make sure your Outlook tab is fully loaded.' });
    }, 15000);
    pendingRelays.set(nonce, { resolve, timer });

    chrome.tabs.sendMessage(tabId, { type: 'JTP_RELAY_REQUEST', nonce, ...payload }, (res) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timer);
        pendingRelays.delete(nonce);
        chrome.storage.session.remove(['jtpRelayTabId', 'jtpRelayTabUrl']);
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      }
    });
  });
}

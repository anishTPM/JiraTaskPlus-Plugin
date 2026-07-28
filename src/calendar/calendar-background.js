// ── Calendar Background Handler ─────────────────────────────────────────────
// The relay content script registers itself on load via JTP_RELAY_REGISTER.
// Background never queries tabs or injects scripts — avoids all host permission issues.

export function initCalendarBackground() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'JTP_RELAY_REGISTER') {
      if (sender.tab?.id) {
        relayTabId = sender.tab.id;
        relayTabUrl = sender.tab.url || '';
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

  // Re-register when a tab is updated (e.g. page reload)
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'complete' && tabId === relayTabId) {
      // Tab reloaded — relay will re-register itself on load
      relayTabId = null;
    }
  });
}

const pendingRelays = new Map();
let relayTabId = null;
let relayTabUrl = '';

async function getRelayTab() {
  if (relayTabId !== null) return relayTabId;

  // No registered relay — open Outlook and wait for relay to register
  const tab = await chrome.tabs.create({ url: 'https://outlook.cloud.microsoft/calendar', active: false });
  // Wait up to 12s for relay to register itself
  return new Promise((resolve) => {
    const deadline = setTimeout(() => resolve(null), 12000);
    const check = setInterval(() => {
      if (relayTabId !== null) {
        clearInterval(check);
        clearTimeout(deadline);
        resolve(relayTabId);
      }
    }, 300);
  });
}

async function handleCalendarFetch(url) {
  const tabId = await getRelayTab();
  if (!tabId) return { ok: false, error: 'Could not reach Outlook. Make sure you are logged in and the calendar tab is open.' };

  // Rewrite URL to match the tab's actual Outlook domain
  let apiUrl = url;
  if (relayTabUrl.includes('outlook.cloud.microsoft')) {
    apiUrl = url.replace('https://outlook.office.com', 'https://outlook.cloud.microsoft');
  } else if (relayTabUrl.includes('outlook.office365.com')) {
    apiUrl = url.replace('https://outlook.office.com', 'https://outlook.office365.com');
  }

  return sendToRelay(tabId, { action: 'FETCH_CALENDAR', apiUrl });
}

async function debugCalendarTokens() {
  const tabId = await getRelayTab();
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
        // Relay tab may have been closed — clear registration
        relayTabId = null;
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      }
    });
  });
}

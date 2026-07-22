// ── Calendar Background Handler ─────────────────────────────────────────────
// Uses the relay content script (already injected on Outlook pages) via
// chrome.tabs.sendMessage instead of executeScript — avoids MV3 host access errors.

export function initCalendarBackground() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
    handleCalendarFetch(msg.url).then(sendResponse).catch(e => {
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  });
}

const pendingRelays = new Map();

const OUTLOOK_PATTERNS = ['*://outlook.office.com/*', '*://outlook.office365.com/*', '*://outlook.cloud.microsoft/*'];

async function getOutlookTab() {
  let tabs = await chrome.tabs.query({ url: OUTLOOK_PATTERNS });
  if (!tabs.length) {
    const tab = await chrome.tabs.create({ url: 'https://outlook.office.com/calendar', active: false });
    await waitForTab(tab.id);
    // Extra delay for content scripts to initialise after page load
    await delay(1500);
    tabs = await chrome.tabs.query({ url: OUTLOOK_PATTERNS });
  }
  return tabs[0] || null;
}

async function handleCalendarFetch(url) {
  const tab = await getOutlookTab();
  if (!tab) return { ok: false, error: 'Could not open Outlook. Are you logged in?' };

  // Rewrite URL to match the tab's actual Outlook domain
  let apiUrl = url;
  if (tab.url.includes('outlook.cloud.microsoft')) {
    apiUrl = url.replace('https://outlook.office.com', 'https://outlook.cloud.microsoft');
  } else if (tab.url.includes('outlook.office365.com')) {
    apiUrl = url.replace('https://outlook.office.com', 'https://outlook.office365.com');
  }

  return sendToRelay(tab.id, { action: 'FETCH_CALENDAR', apiUrl });
}

async function debugCalendarTokens() {
  const tab = await getOutlookTab();
  if (!tab) return { error: 'No Outlook tab open' };
  return sendToRelay(tab.id, { action: 'DEBUG_TOKENS' });
}

// Send a request to the relay content script, injecting it first if needed
async function sendToRelay(tabId, payload) {
  // Ping first; if not responding, inject the relay script dynamically
  let ready = await pingRelay(tabId);
  if (!ready) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['calendar/calendar-relay.js'],
      });
      await delay(300);
    } catch (e) {
      return { ok: false, error: `Could not inject relay: ${e.message}` };
    }
    ready = await pingRelay(tabId);
    if (!ready) return { ok: false, error: 'Relay injection failed. Try reloading the Outlook tab.' };
  }

  return new Promise((resolve) => {
    const nonce = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      pendingRelays.delete(nonce);
      resolve({ ok: false, error: 'Timed out. Make sure your Outlook tab is fully loaded and try again.' });
    }, 15000);
    pendingRelays.set(nonce, { resolve, timer });

    chrome.tabs.sendMessage(tabId, { type: 'JTP_RELAY_REQUEST', nonce, ...payload }, (res) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timer);
        pendingRelays.delete(nonce);
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      }
    });
  });
}

function pingRelay(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'JTP_RELAY_PING' }, (res) => {
      resolve(!chrome.runtime.lastError && res?.pong === true);
    });
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function waitForTab(tabId) {
  return new Promise(resolve => {
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 10000);
  });
}

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

const OUTLOOK_PATTERNS = ['*://outlook.office.com/*', '*://outlook.office365.com/*', '*://outlook.cloud.microsoft/*', '*://outlook.live.com/*'];

async function getOutlookTab() {
  let tabs = await chrome.tabs.query({ url: OUTLOOK_PATTERNS });
  if (tabs.length) return tabs[0];

  const tab = await chrome.tabs.create({ url: 'https://outlook.office.com/calendar', active: false });
  // Wait for final navigation (Outlook may redirect through login)
  await waitForTab(tab.id);
  await delay(2000);
  // Re-query — tab may have navigated to a different URL
  tabs = await chrome.tabs.query({ url: OUTLOOK_PATTERNS });
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

async function sendToRelay(tabId, payload) {
  // Ping first — declared content script may already be running
  let ready = await pingRelay(tabId);
  if (!ready) {
    // Inject relay logic as an inline function — avoids file/host permission
    // issues with executeScript({files}) on outlook.cloud.microsoft
    try {
      await chrome.scripting.executeScript({ target: { tabId }, func: injectRelayInline });
      await delay(200);
      ready = await pingRelay(tabId);
    } catch (e) {
      return { ok: false, error: `Injection failed: ${e.message}` };
    }
  }
  if (!ready) return { ok: false, error: 'Relay not ready. Make sure you are logged into Outlook.' };

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

// Injected into the Outlook tab as an inline function (no file access needed).
// Must be self-contained — no closures over outer scope.
function injectRelayInline() {
  if (window.__JTP_RELAY_INIT__) return;
  window.__JTP_RELAY_INIT__ = true;

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.data?.type !== 'JTP_CALENDAR_RELAY') return;
    chrome.runtime.sendMessage(e.data);
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'JTP_RELAY_PING') { sendResponse({ pong: true }); return; }
    if (msg.type !== 'JTP_RELAY_REQUEST') return;

    if (msg.action === 'DEBUG_TOKENS') {
      const now = Math.floor(Date.now() / 1000);
      const msalKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('msal.3|')) continue;
        try {
          const val = JSON.parse(localStorage.getItem(key));
          const exp = parseInt(val?.expiresOn || val?.expires_on || '0', 10);
          msalKeys.push({ key, hasSecret: !!val?.secret, expired: exp > 0 && exp < now, exp });
        } catch { msalKeys.push({ key, hasSecret: false, parseError: true }); }
      }
      chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_RELAY', nonce: msg.nonce, result: msalKeys });
      sendResponse({});
      return true;
    }

    if (msg.action === 'FETCH_CALENDAR') {
      const { nonce, apiUrl } = msg;
      const now2 = Math.floor(Date.now() / 1000);
      const candidates = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('msal.3|')) continue;
        if (key.includes('|refreshtoken|') || key.includes('|idtoken|')) continue;
        try {
          const val = JSON.parse(localStorage.getItem(key));
          if (!val?.secret) continue;
          const exp = parseInt(val.expiresOn || val.expires_on || '0', 10);
          if (exp > 0 && exp < now2) continue;
          candidates.push({ secret: val.secret, key });
        } catch (_) {}
      }
      const order = ['outlook.office.com/.default', 'calendars.readwrite', 'outlook.office365.com/.default', 'graph.microsoft.com/.default'];
      let token = null;
      for (const scope of order) { token = candidates.find(c => c.key.includes(scope)); if (token) break; }
      if (!token) token = candidates[0] || null;

      if (token) {
        let fetchUrl = apiUrl;
        if (token.key.includes('graph.microsoft.com') && !apiUrl.includes('graph.microsoft.com')) {
          try { fetchUrl = `https://graph.microsoft.com/v1.0/me/calendarview${new URL(apiUrl).search}`; } catch (_) {}
        }
        fetch(fetchUrl, { headers: { Accept: 'application/json', Authorization: `Bearer ${token.secret}`, Prefer: 'outlook.timezone="UTC"' } })
          .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(`API ${r.status}: ${t.slice(0, 200)}`)))
          .then(data => chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_RELAY', nonce, result: { ok: true, data } }))
          .catch(e => chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_RELAY', nonce, result: { ok: false, error: String(e) } }));
        sendResponse({});
        return true;
      }

      // OWA cookie fallback
      const origin = location.origin;
      const d = new Date();
      const startDt = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      const endDt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
      fetch(`${origin}/owa/service.svc?action=GetCalendarView&EP=1`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Action: 'GetCalendarView', 'X-OWA-CANARY': document.cookie.match(/X-OWA-CANARY=([^;]+)/)?.[1] || '' },
        body: JSON.stringify({ __type: 'GetCalendarViewRequest:#Exchange', Header: { __type: 'JsonRequestHeaders:#Exchange', RequestServerVersion: 'V2018_01_08' }, StartDate: startDt, EndDate: endDt }),
      })
        .then(r => r.ok ? r.json() : Promise.reject(`OWA ${r.status}`))
        .then(data => chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_RELAY', nonce, result: { ok: true, data } }))
        .catch(e => chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_RELAY', nonce, result: { ok: false, error: String(e) } }));
      sendResponse({});
      return true;
    }
  });
}

// ── Calendar Background Handler ─────────────────────────────────────────────
// Strategy:
//   Edge: tokens are plaintext in localStorage → extract + fetch from SW
//   Chrome: tokens are encrypted → do the fetch inside the Outlook tab via
//           a content script relay (injected script → content script → SW)

export function initCalendarBackground() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'JTP_CALENDAR_DEBUG') {
      debugCalendarTokens().then(sendResponse).catch(e => sendResponse({ error: e.message }));
      return true;
    }
    if (msg.type === 'JTP_CALENDAR_RELAY') {
      // Relayed result from content script inside Outlook tab
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

async function handleCalendarFetch(url) {
  let tabs = await chrome.tabs.query({ url: ['*://outlook.office.com/*', '*://outlook.office365.com/*', '*://outlook.cloud.microsoft/*'] });

  if (!tabs.length) {
    const tab = await chrome.tabs.create({ url: 'https://outlook.office.com/calendar', active: false });
    await waitForTab(tab.id);
    tabs = await chrome.tabs.query({ url: ['*://outlook.office.com/*', '*://outlook.office365.com/*', '*://outlook.cloud.microsoft/*'] });
    if (!tabs.length) return { ok: false, error: 'Could not open Outlook. Are you logged in?' };
  }

  const tabId = tabs[0].id;
  const tabUrl = tabs[0].url || '';

  // Rewrite URL to match the tab's actual Outlook domain
  let apiUrl = url;
  if (tabUrl.includes('outlook.cloud.microsoft')) {
    apiUrl = url.replace('https://outlook.office.com', 'https://outlook.cloud.microsoft');
  } else if (tabUrl.includes('outlook.office365.com')) {
    apiUrl = url.replace('https://outlook.office.com', 'https://outlook.office365.com');
  }

  // Try Edge path first: extract plaintext token from localStorage
  const token = await extractPlaintextToken(tabId);
  if (token) {
    // Determine fetch URL — if graph token, rewrite to Graph API
    let fetchUrl = apiUrl;
    if (token.key.includes('graph.microsoft.com') && !apiUrl.includes('graph.microsoft.com')) {
      fetchUrl = `https://graph.microsoft.com/v1.0/me/calendarview${new URL(apiUrl).search}`;
    }
    try {
      const res = await fetch(fetchUrl, {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token.secret}`, 'Prefer': 'outlook.timezone="UTC"' }
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `API ${res.status}: ${res.statusText}. ${text.substring(0, 200)}` };
      }
      return { ok: true, data: await res.json() };
    } catch (e) {
      return { ok: false, error: `Fetch failed: ${e.message}` };
    }
  }

  // Chrome path: tokens are encrypted — use OWA internal service endpoint
  // which is cookie-authenticated (same origin as the tab)
  return fetchViaTabRelay(tabId, tabUrl);
}

async function extractPlaintextToken(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const now = Math.floor(Date.now() / 1000);
        const prefer = [
          'outlook.office.com/.default',
          'calendars.readwrite',
          'outlook.office365.com/.default',
          'graph.microsoft.com/.default',
        ];
        const candidates = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith('msal.3|')) continue;
          if (key.includes('|refreshtoken|') || key.includes('|idtoken|')) continue;
          try {
            const val = JSON.parse(localStorage.getItem(key));
            if (!val?.secret) continue; // encrypted (Chrome) — skip
            const exp = parseInt(val.expiresOn || val.expires_on || '0', 10);
            if (exp > 0 && exp < now) continue;
            candidates.push({ secret: val.secret, key });
          } catch (_) {}
        }
        // Sort by preference
        const order = ['outlook.office.com/.default', 'calendars.readwrite', 'outlook.office365.com/.default', 'graph.microsoft.com/.default'];
        for (const scope of order) {
          const match = candidates.find(c => c.key.includes(scope));
          if (match) return match;
        }
        return candidates[0] || null;
      },
      args: [],
    });
    return results?.[0]?.result || null;
  } catch (_) { return null; }
}

function fetchViaTabRelay(tabId, tabUrl) {
  return new Promise((resolve) => {
    const nonce = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      pendingRelays.delete(nonce);
      resolve({ ok: false, error: 'Timed out. Make sure your Outlook tab is fully loaded and try again.' });
    }, 15000);
    pendingRelays.set(nonce, { resolve, timer });

    // Build date range for today
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    chrome.scripting.executeScript({
      target: { tabId },
      func: (nonce, startDt, endDt) => {
        const origin = location.origin; // https://outlook.cloud.microsoft

        // OWA internal service.svc endpoint — cookie authenticated, same origin
        const url = `${origin}/owa/service.svc?action=GetCalendarView&EP=1`;
        const body = JSON.stringify({
          __type: 'GetCalendarViewRequest:#Exchange',
          Header: { __type: 'JsonRequestHeaders:#Exchange', RequestServerVersion: 'V2018_01_08' },
          StartDate: startDt,
          EndDate: endDt,
        });

        fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Action': 'GetCalendarView',
            'X-OWA-CANARY': document.cookie.match(/X-OWA-CANARY=([^;]+)/)?.[1] || '',
          },
          body,
        })
          .then(r => {
            if (!r.ok) throw new Error(`OWA ${r.status} ${r.statusText}`);
            return r.json();
          })
          .then(data => window.postMessage({ type: 'JTP_CALENDAR_RELAY', nonce, result: { ok: true, data, source: 'owa' } }, '*'))
          .catch(e => window.postMessage({ type: 'JTP_CALENDAR_RELAY', nonce, result: { ok: false, error: e.message } }, '*'));
      },
      args: [nonce, start, end],
    }).catch(e => {
      clearTimeout(timer);
      pendingRelays.delete(nonce);
      resolve({ ok: false, error: e.message });
    });
  });
}

async function debugCalendarTokens() {
  const tabs = await chrome.tabs.query({ url: ['*://outlook.office.com/*', '*://outlook.office365.com/*', '*://outlook.cloud.microsoft/*'] });
  if (!tabs.length) return { error: 'No Outlook tab open' };
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => {
      const now = Math.floor(Date.now() / 1000);
      const msalKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('msal.3|')) continue;
        try {
          const val = JSON.parse(localStorage.getItem(key));
          const exp = parseInt(val?.expiresOn || val?.expires_on || '0', 10);
          msalKeys.push({ key, hasSecret: !!val?.secret, expired: exp > 0 && exp < now, exp, fields: Object.keys(val || {}) });
        } catch { msalKeys.push({ key, hasSecret: false, parseError: true }); }
      }
      return msalKeys;
    },
    args: [],
  });
  return results[0].result;
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

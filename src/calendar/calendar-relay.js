// Calendar relay content script — runs on Outlook pages.
// Handles requests from background via chrome.runtime.onMessage,
// does the actual work in page context, and relays results back.

// ── Forward window.postMessage results back to SW ──────────────────────────
window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.type !== 'JTP_CALENDAR_RELAY') return;
  chrome.runtime.sendMessage(e.data);
});

// ── Handle requests from background ───────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'JTP_RELAY_PING') {
    sendResponse({ pong: true });
    return;
  }

  if (msg.type !== 'JTP_RELAY_REQUEST') return;

  if (msg.action === 'DEBUG_TOKENS') {
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
    // Send back via relay message so background pendingRelays resolves it
    chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_RELAY', nonce: msg.nonce, result: msalKeys });
    sendResponse({});
    return true;
  }

  if (msg.action === 'FETCH_CALENDAR') {
    const nonce = msg.nonce;
    const apiUrl = msg.apiUrl;

    // Try plaintext token first (Edge)
    const token = extractToken();
    if (token) {
      let fetchUrl = apiUrl;
      if (token.key.includes('graph.microsoft.com') && !apiUrl.includes('graph.microsoft.com')) {
        try { fetchUrl = `https://graph.microsoft.com/v1.0/me/calendarview${new URL(apiUrl).search}`; } catch (_) {}
      }
      fetch(fetchUrl, {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token.secret}`, 'Prefer': 'outlook.timezone="UTC"' }
      })
        .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(`API ${r.status}: ${t.substring(0, 200)}`)))
        .then(data => chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_RELAY', nonce, result: { ok: true, data } }))
        .catch(e => chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_RELAY', nonce, result: { ok: false, error: String(e) } }));
      sendResponse({});
      return true;
    }

    // Fallback: OWA cookie-authenticated endpoint
    const origin = location.origin;
    const now = new Date();
    const startDt = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endDt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    fetch(`${origin}/owa/service.svc?action=GetCalendarView&EP=1`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Action': 'GetCalendarView',
        'X-OWA-CANARY': document.cookie.match(/X-OWA-CANARY=([^;]+)/)?.[1] || '',
      },
      body: JSON.stringify({
        __type: 'GetCalendarViewRequest:#Exchange',
        Header: { __type: 'JsonRequestHeaders:#Exchange', RequestServerVersion: 'V2018_01_08' },
        StartDate: startDt,
        EndDate: endDt,
      }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(`OWA ${r.status} ${r.statusText}`))
      .then(data => chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_RELAY', nonce, result: { ok: true, data } }))
      .catch(e => chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_RELAY', nonce, result: { ok: false, error: String(e) } }));

    sendResponse({});
    return true;
  }
});

function extractToken() {
  const now = Math.floor(Date.now() / 1000);
  const candidates = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('msal.3|')) continue;
    if (key.includes('|refreshtoken|') || key.includes('|idtoken|')) continue;
    try {
      const val = JSON.parse(localStorage.getItem(key));
      if (!val?.secret) continue;
      const exp = parseInt(val.expiresOn || val.expires_on || '0', 10);
      if (exp > 0 && exp < now) continue;
      candidates.push({ secret: val.secret, key });
    } catch (_) {}
  }
  const order = ['outlook.office.com/.default', 'calendars.readwrite', 'outlook.office365.com/.default', 'graph.microsoft.com/.default'];
  for (const scope of order) {
    const match = candidates.find(c => c.key.includes(scope));
    if (match) return match;
  }
  return candidates[0] || null;
}

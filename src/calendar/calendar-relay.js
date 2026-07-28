// Calendar relay content script — auto-injected by Chrome on Outlook pages.
// Registers itself with the background so it can receive fetch requests.
if (!window.__JTP_RELAY_INIT__) {
  window.__JTP_RELAY_INIT__ = true;

  // Tell background this tab is ready
  chrome.runtime.sendMessage({ type: 'JTP_RELAY_REGISTER' });

  // Re-register if service worker restarts
  chrome.runtime.connect({ name: 'jtp-relay-keepalive' });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
      const token = extractToken();

      if (token) {
        let fetchUrl = apiUrl;
        if (token.key.includes('graph.microsoft.com') && !apiUrl.includes('graph.microsoft.com')) {
          try { fetchUrl = `https://graph.microsoft.com/v1.0/me/calendarview${new URL(apiUrl).search}`; } catch (_) {}
        }
        fetch(fetchUrl, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token.secret}`, Prefer: 'outlook.timezone="UTC"' }
        })
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
}

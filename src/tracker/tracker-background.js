// ── Tracker Background Handler ──────────────────────────────────────────────
// Manages timer state via chrome.alarms + chrome.storage.local
// Also proxies Tempo API calls (content scripts can't due to CORS).

const TIMER_KEY = 'jtp-tracker-timer';
const ALARM_NAME = 'jtp-tracker-tick';

export function initTrackerBackground() {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      // Keepalive tick — ensures service worker stays alive during tracking
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'JTP_TIMER_START') {
      const timerState = {
        issueKey: msg.issueKey,
        summary: msg.summary,
        epicKey: msg.epicKey || '',
        epicSummary: msg.epicSummary || '',
        meetingTitle: msg.meetingTitle || '',
        startTime: Date.now(),
        running: true,
      };
      chrome.storage.local.set({ [TIMER_KEY]: timerState }, () => {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
        sendResponse({ ok: true });
      });
      return true;
    }

    if (msg.type === 'JTP_TIMER_STOP') {
      chrome.storage.local.get(TIMER_KEY, (result) => {
        const timer = result[TIMER_KEY];
        if (!timer || !timer.running) { sendResponse({ ok: false }); return; }
        const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
        chrome.alarms.clear(ALARM_NAME);
        chrome.storage.local.set({ [TIMER_KEY]: { ...timer, running: false, elapsed } }, () => {
          sendResponse({ ok: true, elapsed, issueKey: timer.issueKey, summary: timer.summary, startTime: timer.startTime, meetingTitle: timer.meetingTitle || '' });
        });
      });
      return true;
    }

    if (msg.type === 'JTP_TIMER_STATUS') {
      chrome.storage.local.get(TIMER_KEY, (result) => {
        sendResponse(result[TIMER_KEY] || null);
      });
      return true;
    }

    if (msg.type === 'JTP_TIMER_CLEAR') {
      chrome.storage.local.remove(TIMER_KEY, () => {
        chrome.alarms.clear(ALARM_NAME);
        sendResponse({ ok: true });
      });
      return true;
    }

    // Proxy Tempo API call from content script (avoids CORS)
    if (msg.type === 'JTP_TEMPO_LOG') {
      (async () => {
        try {
          const res = await fetch('https://api.tempo.io/4/worklogs', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${msg.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(msg.payload),
          });
          if (!res.ok) {
            const err = await res.text();
            sendResponse({ ok: false, error: `Tempo ${res.status}: ${err}` });
          } else {
            const data = await res.json();
            sendResponse({ ok: true, data });
          }
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true;
    }

    // Proxy Jira API calls from content script (avoids CORS on non-Atlassian pages)
    if (msg.type === 'JTP_JIRA_FETCH') {
      (async () => {
        try {
          const res = await fetch(msg.url, {
            method: msg.method || 'GET',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            ...(msg.body ? { body: JSON.stringify(msg.body) } : {}),
          });
          if (!res.ok) {
            const err = await res.text();
            sendResponse({ ok: false, error: `${res.status}: ${err}` });
          } else {
            const data = await res.json();
            sendResponse({ ok: true, data });
          }
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true;
    }
  });
}

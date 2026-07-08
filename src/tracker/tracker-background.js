// ── Tracker Background Handler ──────────────────────────────────────────────
// Manages timer state via chrome.alarms + chrome.storage.local
// Completely isolated — only activated when FEATURE_TRACKER is enabled.

const TIMER_KEY = 'jtp-tracker-timer';
const ALARM_NAME = 'jtp-tracker-tick';

export function initTrackerBackground() {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      // Keepalive tick — timer state is time-based, no increment needed
      // Just ensures service worker stays alive during tracking
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'JTP_TIMER_START') {
      const timerState = {
        issueKey: msg.issueKey,
        summary: msg.summary,
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
          sendResponse({ ok: true, elapsed, issueKey: timer.issueKey, summary: timer.summary, startTime: timer.startTime });
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
  });
}

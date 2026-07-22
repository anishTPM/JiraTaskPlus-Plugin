// ── Tracker Background Handler ──────────────────────────────────────────────
// Manages timer state via chrome.alarms + chrome.storage.local
// Also proxies Tempo API calls (content scripts can't due to CORS).
// Desktop notification reminders when timer is running (configurable interval).

const TIMER_KEY = 'jtp-tracker-timer';
const ALARM_NAME = 'jtp-tracker-tick';
const REMINDER_ALARM = 'jtp-tracker-reminder';
const REMINDER_SETTINGS_KEY = 'jtp-tracker-reminder';
const NOTIFICATION_ID = 'jtp-timer-reminder';

function formatElapsed(ms) {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function startReminderAlarm(intervalMin) {
  chrome.alarms.clear(REMINDER_ALARM, () => {
    if (intervalMin > 0) {
      chrome.alarms.create(REMINDER_ALARM, { periodInMinutes: intervalMin });
    }
  });
}

function stopReminderAlarm() {
  chrome.alarms.clear(REMINDER_ALARM);
  chrome.notifications.clear(NOTIFICATION_ID);
}

function showReminderNotification(timer) {
  const elapsed = formatElapsed(Date.now() - timer.startTime);
  chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'assets/icon128.png',
    title: `\u23f1\ufe0f Timer running \u2014 ${elapsed}`,
    message: `${timer.issueKey}: ${timer.summary || 'No summary'}`,
    priority: 2,
    requireInteraction: false,
  });
}

export function initTrackerBackground() {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      // Keepalive tick
    }
    if (alarm.name === REMINDER_ALARM) {
      chrome.storage.local.get(TIMER_KEY, (res) => {
        const timer = res[TIMER_KEY];
        if (timer && timer.running) showReminderNotification(timer);
      });
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
        // Start reminder alarm if enabled
        chrome.storage.local.get(REMINDER_SETTINGS_KEY, (res) => {
          const settings = res[REMINDER_SETTINGS_KEY] || { enabled: false, interval: 30 };
          if (settings.enabled) startReminderAlarm(settings.interval);
        });
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
        stopReminderAlarm();
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
        stopReminderAlarm();
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

    // Fetch weekly Tempo worklogs total
    if (msg.type === 'JTP_TEMPO_WEEKLY') {
      (async () => {
        try {
          const url = `https://api.tempo.io/4/worklogs/user/me?from=${msg.from}&to=${msg.to}&limit=1000`;
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${msg.token}` } });
          if (!res.ok) { sendResponse({ ok: false }); return; }
          const data = await res.json();
          const totalSeconds = (data.results || []).reduce((sum, w) => sum + (w.timeSpentSeconds || 0), 0);
          sendResponse({ ok: true, totalSeconds });
        } catch { sendResponse({ ok: false }); }
      })();
      return true;
    }

    // Proxy Jira API calls from content script (avoids CORS on non-Atlassian pages)
    if (msg.type === 'JTP_JIRA_FETCH') {
      (async () => {
        try {
          const res = await fetch(msg.url, {
            method: msg.method || 'GET',
            credentials: 'include',
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

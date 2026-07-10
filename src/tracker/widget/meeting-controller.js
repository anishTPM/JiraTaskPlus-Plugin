// Single Responsibility: Calendar event polling, filtering, and meeting chip UI.
// Open/Closed: Filtering rules loaded from storage, extensible without code changes.

import { isExtensionValid } from './task-service.js';

export function createMeetingController(refs, timerController) {
  let meetingCheckInterval = null;
  let cachedCalEvents = [];
  let lastCalFetch = 0;
  let dismissedMeetings = new Set();
  let activeMeetingEvent = null;
  let calFilters = { skipAllDay: true, blocklist: [] };

  async function loadFilters() {
    return new Promise(r => {
      chrome.storage.local.get('jtp-calendar-filters', (res) => {
        calFilters = res['jtp-calendar-filters'] || { skipAllDay: true, blocklist: [] };
        r(calFilters);
      });
    });
  }

  function shouldShowEvent(ev) {
    const isAllDay = ev.IsAllDay || ev.isAllDay;
    if (calFilters.skipAllDay && isAllDay) return false;

    const subject = (ev.Subject || ev.subject || '').toLowerCase();
    const blocklist = calFilters.blocklist || [];
    if (blocklist.some(kw => subject.includes(kw.toLowerCase()))) return false;

    return true;
  }

  function start() {
    if (meetingCheckInterval) return;
    loadFilters().then(() => {
      fetchAndCheck();
      meetingCheckInterval = setInterval(fetchAndCheck, 60000);
    });
  }

  function stop() {
    if (meetingCheckInterval) { clearInterval(meetingCheckInterval); meetingCheckInterval = null; }
  }

  function fetchAndCheck() {
    const now = new Date();
    if (now - lastCalFetch > 10 * 60 * 1000) {
      lastCalFetch = now.getTime();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      const url = `https://outlook.office.com/api/v2.0/me/calendarview?startDateTime=${startOfDay}&endDateTime=${endOfDay}&$orderby=start/dateTime&$top=20`;
      chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_FETCH', url }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res?.ok) {
          cachedCalEvents = res.data.value || [];
          checkUpcoming();
        } else {
          // Still try to show chip with whatever we have
          checkUpcoming();
        }
      });
    } else {
      checkUpcoming();
    }
  }

  function checkUpcoming() {
    const now = new Date();
    const in15 = new Date(now.getTime() + 15 * 60 * 1000);

    const next = cachedCalEvents.find(ev => {
      if (!shouldShowEvent(ev)) return false;
      const startRaw = ev.Start?.DateTime || ev.start?.dateTime || '';
      const endRaw = ev.End?.DateTime || ev.end?.dateTime || '';
      const start = new Date(startRaw.endsWith('Z') ? startRaw : startRaw + 'Z');
      const end = new Date(endRaw.endsWith('Z') ? endRaw : endRaw + 'Z');
      const id = (ev.Subject || ev.subject || '') + startRaw;
      return end > now && start <= in15 && !dismissedMeetings.has(id);
    });

    if (!next) {
      // If no upcoming meeting within 15m, find the next future event today to show passively
      const nextFuture = cachedCalEvents.find(ev => {
        if (!shouldShowEvent(ev)) return false;
        const startRaw = ev.Start?.DateTime || ev.start?.dateTime || '';
        const start = new Date(startRaw.endsWith('Z') ? startRaw : startRaw + 'Z');
        return start > now;
      });
      if (nextFuture) {
        const startRaw = nextFuture.Start?.DateTime || nextFuture.start?.dateTime || '';
        const start = new Date(startRaw.endsWith('Z') ? startRaw : startRaw + 'Z');
        const subject = nextFuture.Subject || nextFuture.subject || '(No subject)';
        const minsUntil = Math.round((start - now) / 60000);
        const timeLabel = minsUntil >= 60 ? `${Math.floor(minsUntil/60)}h ${minsUntil%60}m` : `${minsUntil}m`;
        refs.meetingTitle.textContent = subject.length > 25 ? subject.slice(0, 25) + '\u2026' : subject;
        refs.meetingBadge.textContent = `\ud83d\udcc5 ${timeLabel}`;
        refs.meetingChip.classList.add('visible', 'compact');
        activeMeetingEvent = null;
      } else {
        refs.meetingChip.classList.remove('visible');
        activeMeetingEvent = null;
      }
      return;
    }

    const startRaw = next.Start?.DateTime || next.start?.dateTime || '';
    const start = new Date(startRaw.endsWith('Z') ? startRaw : startRaw + 'Z');
    const subject = next.Subject || next.subject || '(No subject)';
    const minsUntil = Math.round((start - now) / 60000);
    const isNow = start <= now;

    activeMeetingEvent = next;
    refs.meetingTitle.textContent = subject;
    refs.meetingBadge.textContent = isNow ? '\ud83d\udfe2 Now' : `\ud83d\udcc5 ${minsUntil}m`;
    refs.meetingChip.classList.add('visible');
    // Show full interactive chip only when idle, compact when timer running
    if (timerController.current) {
      refs.meetingChip.classList.add('compact');
    } else {
      refs.meetingChip.classList.remove('compact');
    }
  }

  function dismiss() {
    if (activeMeetingEvent) {
      const startRaw = activeMeetingEvent.Start?.DateTime || activeMeetingEvent.start?.dateTime || '';
      const subject = activeMeetingEvent.Subject || activeMeetingEvent.subject || '';
      dismissedMeetings.add(subject + startRaw);
    }
    refs.meetingChip.classList.remove('visible');
    activeMeetingEvent = null;
  }

  return { start, stop, checkUpcoming, dismiss };
}

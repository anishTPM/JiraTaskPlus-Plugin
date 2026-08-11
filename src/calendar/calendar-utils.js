// Shared, pure helpers for calendar event fetching and rendering.
// Kept free of chrome.*/DOM dependencies so they are unit-testable.

export function todayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { startDateTime: start.toISOString(), endDateTime: end.toISOString() };
}

export function normalizeGraphEvents(data) {
  const raw = (data && (data.value || data.CalendarEvents || data.CalendarView)) || [];
  return raw.map(ev => ({
    subject: ev.Subject || ev.subject || '(No subject)',
    startDateTime: ev.Start?.DateTime || ev.start?.dateTime || '',
    endDateTime: ev.End?.DateTime || ev.end?.dateTime || '',
    isAllDay: !!(ev.IsAllDay || ev.isAllDay),
    webLink: ev.webLink || ev.WebLink || '',
    organizer: ev.organizer?.emailAddress?.address || ev.Organizer?.EmailAddress?.Address || '',
  }));
}

function toDate(raw) {
  if (!raw) return null;
  const parsed = new Date(String(raw).endsWith('Z') ? raw : `${raw}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildEventRows(events, now = new Date()) {
  return events.map(ev => {
    const subject = ev.subject || ev.Subject || '(No subject)';
    const start = toDate(ev.startDateTime || ev.Start?.DateTime || ev.start?.dateTime || '');
    const end = toDate(ev.endDateTime || ev.End?.DateTime || ev.end?.dateTime || '');
    const timeStr = start ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    const durMin = start && end ? Math.round((end - start) / 60000) : null;
    const isPast = !!(end && end < now);
    const isNow = !!(start && end && start <= now && end >= now);
    const status = isNow ? 'Now' : isPast ? 'Done' : 'Upcoming';
    return { timeStr, subject, durMin, status };
  });
}

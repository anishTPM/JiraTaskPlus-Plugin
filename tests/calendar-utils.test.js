import { todayRange, normalizeGraphEvents, buildEventRows } from '../src/calendar/calendar-utils.js';

describe('todayRange', () => {
  it('returns local midnight to 23:59:59.999 for the given date', () => {
    const now = new Date(2026, 7, 11, 15, 30, 0);
    const { startDateTime, endDateTime } = todayRange(now);
    expect(startDateTime).toBe(new Date(2026, 7, 11, 0, 0, 0).toISOString());
    expect(endDateTime).toBe(new Date(2026, 7, 11, 23, 59, 59, 999).toISOString());
  });

  it('defaults to the current date', () => {
    const now = new Date();
    const { startDateTime } = todayRange(now);
    expect(startDateTime).toBe(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
  });
});

describe('normalizeGraphEvents', () => {
  it('maps Graph value[] into a canonical shape', () => {
    const data = {
      value: [{
        subject: 'Standup',
        start: { dateTime: '2026-08-11T10:00:00Z', timeZone: 'UTC' },
        end: { dateTime: '2026-08-11T10:30:00Z', timeZone: 'UTC' },
        isAllDay: false,
        webLink: 'https://outlook.live.com/owa/?itemid=1',
        organizer: { emailAddress: { address: 'me@example.com' } },
      }],
    };
    const events = normalizeGraphEvents(data);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      subject: 'Standup',
      startDateTime: '2026-08-11T10:00:00Z',
      endDateTime: '2026-08-11T10:30:00Z',
      isAllDay: false,
      webLink: 'https://outlook.live.com/owa/?itemid=1',
      organizer: 'me@example.com',
    });
  });

  it('supports legacy uppercase Start/End/Subject and missing optional fields', () => {
    const events = normalizeGraphEvents({
      value: [{
        Subject: 'OOO',
        IsAllDay: true,
        Start: { DateTime: '2026-08-11T00:00:00Z' },
        End: { DateTime: '2026-08-11T23:59:59Z' },
      }],
    });
    expect(events[0].subject).toBe('OOO');
    expect(events[0].isAllDay).toBe(true);
    expect(events[0].organizer).toBe('');
  });

  it('returns an empty array for null/missing data', () => {
    expect(normalizeGraphEvents(null)).toEqual([]);
    expect(normalizeGraphEvents({})).toEqual([]);
  });

  it('falls back to CalendarView key', () => {
    const events = normalizeGraphEvents({ CalendarView: [{ subject: 'X' }] });
    expect(events[0].subject).toBe('X');
  });
});

describe('buildEventRows', () => {
  it('builds rows with time, duration, and status', () => {
    const now = new Date('2026-08-11T12:00:00Z');
    const events = [{
      subject: 'Morning Sync',
      startDateTime: '2026-08-11T09:00:00Z',
      endDateTime: '2026-08-11T10:00:00Z',
    }];
    const [row] = buildEventRows(events, now);
    expect(row.subject).toBe('Morning Sync');
    expect(row.durMin).toBe(60);
    expect(row.status).toBe('Done');
  });

  it('marks currently-running events as Now', () => {
    const now = new Date('2026-08-11T10:15:00Z');
    const events = [{
      subject: 'Meeting',
      startDateTime: '2026-08-11T10:00:00Z',
      endDateTime: '2026-08-11T11:00:00Z',
    }];
    expect(buildEventRows(events, now)[0].status).toBe('Now');
  });

  it('handles events missing start/end times', () => {
    const rows = buildEventRows([{ subject: 'No time' }], new Date());
    expect(rows[0].timeStr).toBe('—');
    expect(rows[0].durMin).toBeNull();
  });
});

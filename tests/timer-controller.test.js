import { createTimerController } from '../src/tracker/widget/timer-controller.js';

function createMockRefs() {
  const el = (text = '') => ({ textContent: text, style: {}, classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() } });
  return {
    rail: el(), railBrand: el(), railIdle: { style: { display: 'flex' } },
    railTimer: { classList: { add: jest.fn(), remove: jest.fn() } },
    timerDisplay: el(), activeKey: el(), activeSummary: el(),
    activeEpic: { style: { display: 'none' } }, activeEpicText: el(),
    stopBtn: el(), barLog: { classList: { add: jest.fn(), remove: jest.fn() } },
    logIssueKey: el(), logTime: { value: '' }, logDesc: { value: '' },
    logStatus: { textContent: '', className: '' },
    taskRow: { classList: { add: jest.fn(), remove: jest.fn() } },
    railBrand: { classList: { add: jest.fn(), remove: jest.fn() } },
    miniPill: el(), miniTimer: el(),
  };
}

describe('timer-controller', () => {
  let refs, ctrl;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    refs = createMockRefs();
    ctrl = createTimerController(refs);
  });

  afterEach(() => jest.useRealTimers());

  describe('formatElapsed', () => {
    it('formats 0 seconds', () => {
      expect(ctrl.formatElapsed(0)).toBe('00:00:00');
    });

    it('formats seconds only', () => {
      expect(ctrl.formatElapsed(45)).toBe('00:00:45');
    });

    it('formats minutes and seconds', () => {
      expect(ctrl.formatElapsed(125)).toBe('00:02:05');
    });

    it('formats hours, minutes, seconds', () => {
      expect(ctrl.formatElapsed(3661)).toBe('01:01:01');
    });
  });

  describe('showRunning', () => {
    it('sets UI to running state', () => {
      const timer = { issueKey: 'PROJ-10', summary: 'My task', epicKey: 'EP-1', epicSummary: 'Epic', startTime: Date.now() };
      ctrl.showRunning(timer);

      expect(refs.railIdle.style.display).toBe('none');
      expect(refs.railTimer.classList.add).toHaveBeenCalledWith('visible');
      expect(refs.activeKey.textContent).toBe('PROJ-10');
      expect(refs.activeSummary.textContent).toBe('My task');
      expect(refs.activeEpic.style.display).toBe('inline');
      expect(ctrl.current).toEqual(timer);
    });

    it('hides epic badge when no epicKey', () => {
      ctrl.showRunning({ issueKey: 'X-1', summary: '', epicKey: '', epicSummary: '', startTime: Date.now() });
      expect(refs.activeEpic.style.display).toBe('none');
    });
  });

  describe('showIdle', () => {
    it('resets UI to idle state', () => {
      ctrl.showRunning({ issueKey: 'X-1', summary: '', epicKey: '', epicSummary: '', startTime: Date.now() });
      ctrl.showIdle();

      expect(refs.railIdle.style.display).toBe('flex');
      expect(refs.railTimer.classList.remove).toHaveBeenCalledWith('visible');
      expect(ctrl.current).toBeNull();
    });
  });

  describe('showLogForm', () => {
    it('shows log form with pre-filled data', () => {
      const data = { issueKey: 'PROJ-5', elapsed: 3600, startTime: Date.now(), meetingTitle: 'Standup' };
      ctrl.showLogForm(data);

      expect(refs.logIssueKey.textContent).toBe('PROJ-5');
      expect(refs.logTime.value).toBe('1h');
      expect(refs.logDesc.value).toBe('Standup');
      expect(refs.barLog.classList.add).toHaveBeenCalledWith('visible');
    });

    it('formats time with hours and minutes', () => {
      ctrl.showLogForm({ issueKey: 'X-1', elapsed: 5400, startTime: Date.now(), meetingTitle: '' });
      expect(refs.logTime.value).toBe('1h 30m');
    });

    it('formats time with minutes only', () => {
      ctrl.showLogForm({ issueKey: 'X-1', elapsed: 900, startTime: Date.now(), meetingTitle: '' });
      expect(refs.logTime.value).toBe('15m');
    });

    it('defaults to 1m for very short durations', () => {
      ctrl.showLogForm({ issueKey: 'X-1', elapsed: 30, startTime: Date.now(), meetingTitle: '' });
      expect(refs.logTime.value).toBe('1m');
    });
  });

  describe('onStateChange callback', () => {
    it('fires with running state', () => {
      const spy = jest.fn();
      ctrl.onStateChange = spy;
      ctrl.showRunning({ issueKey: 'X-1', summary: '', epicKey: '', epicSummary: '', startTime: Date.now() });
      expect(spy).toHaveBeenCalledWith('running', expect.any(Object));
    });

    it('fires with idle state', () => {
      const spy = jest.fn();
      ctrl.onStateChange = spy;
      ctrl.showIdle();
      expect(spy).toHaveBeenCalledWith('idle', null);
    });
  });

  describe('handleStorageChange', () => {
    it('shows running when timer is active', () => {
      const spy = jest.fn();
      ctrl.onStateChange = spy;
      ctrl.handleStorageChange({
        'jtp-tracker-timer': { newValue: { running: true, issueKey: 'T-1', summary: 'Test', epicKey: '', epicSummary: '', startTime: Date.now() } }
      }, 'local');
      expect(refs.activeKey.textContent).toBe('T-1');
    });

    it('shows idle when timer is cleared', () => {
      ctrl.showRunning({ issueKey: 'X-1', summary: '', epicKey: '', epicSummary: '', startTime: Date.now() });
      ctrl.handleStorageChange({ 'jtp-tracker-timer': { newValue: null } }, 'local');
      expect(ctrl.current).toBeNull();
    });

    it('ignores non-local area changes', () => {
      const spy = jest.fn();
      ctrl.onStateChange = spy;
      ctrl.handleStorageChange({ 'jtp-tracker-timer': { newValue: null } }, 'sync');
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

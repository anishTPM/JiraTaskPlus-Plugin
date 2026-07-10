import { createLogController } from '../src/tracker/widget/log-controller.js';

function createMockRefs() {
  return {
    logIssueKey: { textContent: '' },
    logTime: { value: '' },
    logDesc: { value: '' },
    logStatus: { textContent: '', className: '' },
    btnLog: { disabled: false },
    btnDiscard: {},
    rail: { classList: { add: jest.fn(), remove: jest.fn() } },
    railIdle: { style: { display: '' } },
    railTimer: { classList: { add: jest.fn(), remove: jest.fn() } },
    barLog: { classList: { add: jest.fn(), remove: jest.fn() } },
    taskRow: { classList: { add: jest.fn(), remove: jest.fn() } },
    railBrand: { classList: { add: jest.fn(), remove: jest.fn() } },
    activeEpic: { style: {} }, activeEpicText: { textContent: '' },
    activeKey: { textContent: '' }, activeSummary: { textContent: '' },
    timerDisplay: { textContent: '' }, miniPill: { textContent: '' }, miniTimer: { textContent: '' },
  };
}

function createMockTimerCtrl() {
  return {
    clearTimer: jest.fn(),
    current: null,
  };
}

describe('log-controller', () => {
  let refs, timerCtrl, ctrl;

  beforeEach(() => {
    jest.clearAllMocks();
    __clearStorage();
    refs = createMockRefs();
    timerCtrl = createMockTimerCtrl();
    ctrl = createLogController(refs, timerCtrl, 'test-tempo-token');
  });

  describe('parseTimeInput (via submitLog validation)', () => {
    // We test parseTimeInput indirectly by checking submitLog behavior
    // But let's also extract and test the logic directly by calling submitLog with known inputs

    it('shows error when no tempo token', async () => {
      const noTokenCtrl = createLogController(refs, timerCtrl, '');
      noTokenCtrl.setStopData({ issueKey: 'X-1', elapsed: 60, startTime: Date.now() });
      await noTokenCtrl.submitLog();
      expect(refs.logStatus.textContent).toContain('No token');
    });

    it('shows error when no stop data', async () => {
      await ctrl.submitLog();
      expect(refs.logStatus.textContent).toContain('No token');
    });

    it('rejects time less than 1 minute', async () => {
      ctrl.setStopData({ issueKey: 'X-1', elapsed: 30, startTime: Date.now() });
      refs.logTime.value = '0m';

      // Mock the jiraFetch calls
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'JTP_JIRA_FETCH') {
          cb({ ok: true, data: { accountId: 'user-1', id: '12345' } });
        }
        if (msg.type === 'JTP_TEMPO_LOG') cb({ ok: true });
      });

      await ctrl.submitLog();
      expect(refs.logStatus.textContent).toContain('Min 1m');
    });
  });

  describe('discard', () => {
    it('calls clearTimer on discard', () => {
      ctrl.setStopData({ issueKey: 'X-1', elapsed: 60, startTime: Date.now() });
      ctrl.discard();
      expect(timerCtrl.clearTimer).toHaveBeenCalled();
    });
  });

  describe('setStopData / getStopData', () => {
    it('stores and retrieves stop data', () => {
      const data = { issueKey: 'PROJ-99', elapsed: 1800, startTime: Date.now() };
      ctrl.setStopData(data);
      expect(ctrl.getStopData()).toEqual(data);
    });
  });
});

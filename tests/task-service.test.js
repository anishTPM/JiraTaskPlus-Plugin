import { isExtensionValid, getRecentTasks, pushRecentTask, fetchTasks } from '../src/tracker/widget/task-service.js';

describe('task-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __clearStorage();
  });

  describe('isExtensionValid', () => {
    it('returns true when chrome.runtime.id exists', () => {
      expect(isExtensionValid()).toBe(true);
    });

    it('returns false when chrome.runtime.id is undefined', () => {
      const original = chrome.runtime.id;
      delete chrome.runtime.id;
      expect(isExtensionValid()).toBe(false);
      chrome.runtime.id = original;
    });
  });

  describe('getRecentTasks', () => {
    it('returns empty array when no recent tasks stored', async () => {
      const result = await getRecentTasks();
      expect(result).toEqual([]);
    });

    it('returns stored recent tasks', async () => {
      const tasks = [{ key: 'PROJ-1', summary: 'Task 1', epicKey: '', epicSummary: '' }];
      __setStorage('jtp-recent-tasks', tasks);
      const result = await getRecentTasks();
      expect(result).toEqual(tasks);
    });
  });

  describe('pushRecentTask', () => {
    it('adds a task to recent list', () => {
      pushRecentTask({ key: 'PROJ-1', summary: 'Test', epicKey: 'EP-1', epicSummary: 'Epic' });
      expect(chrome.storage.local.set).toHaveBeenCalled();
      const setCall = chrome.storage.local.set.mock.calls[0][0];
      expect(setCall['jtp-recent-tasks'][0].key).toBe('PROJ-1');
    });

    it('moves duplicate to front instead of adding twice', () => {
      __setStorage('jtp-recent-tasks', [
        { key: 'PROJ-1', summary: 'A', epicKey: '', epicSummary: '' },
        { key: 'PROJ-2', summary: 'B', epicKey: '', epicSummary: '' },
      ]);
      pushRecentTask({ key: 'PROJ-2', summary: 'B', epicKey: '', epicSummary: '' });
      const setCall = chrome.storage.local.set.mock.calls[0][0];
      expect(setCall['jtp-recent-tasks'][0].key).toBe('PROJ-2');
      expect(setCall['jtp-recent-tasks'].length).toBe(2);
    });

    it('caps at 5 recent tasks', () => {
      __setStorage('jtp-recent-tasks', [
        { key: 'A-1', summary: '', epicKey: '', epicSummary: '' },
        { key: 'A-2', summary: '', epicKey: '', epicSummary: '' },
        { key: 'A-3', summary: '', epicKey: '', epicSummary: '' },
        { key: 'A-4', summary: '', epicKey: '', epicSummary: '' },
        { key: 'A-5', summary: '', epicKey: '', epicSummary: '' },
      ]);
      pushRecentTask({ key: 'A-6', summary: 'New', epicKey: '', epicSummary: '' });
      const setCall = chrome.storage.local.set.mock.calls[0][0];
      expect(setCall['jtp-recent-tasks'].length).toBe(5);
      expect(setCall['jtp-recent-tasks'][0].key).toBe('A-6');
      expect(setCall['jtp-recent-tasks'][4].key).toBe('A-4');
    });
  });

  describe('fetchTasks', () => {
    it('sends JTP_JIRA_FETCH message with correct JQL', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'JTP_JIRA_FETCH') {
          cb({ ok: true, data: { issues: [{ key: 'T-1', fields: { summary: 'Test' } }] } });
        }
      });
      // Need to mock getJiraBaseUrl storage
      __setStorage('jtp-tracker-jira-base', 'https://test.atlassian.net');

      const issues = await fetchTasks('assignee = currentUser()');
      expect(issues).toHaveLength(1);
      expect(issues[0].key).toBe('T-1');
    });

    it('rejects on fetch failure', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'JTP_JIRA_FETCH') {
          cb({ ok: false, error: 'Unauthorized' });
        }
      });
      __setStorage('jtp-tracker-jira-base', 'https://test.atlassian.net');

      await expect(fetchTasks('assignee = currentUser()')).rejects.toThrow('Unauthorized');
    });
  });
});

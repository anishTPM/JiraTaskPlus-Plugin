// Single Responsibility: Worklog form logic — parse time, submit to Tempo, track analytics.

import { isExtensionValid, jiraFetch, getJiraBaseUrl } from './task-service.js';

export function createLogController(refs, timerController, tempoToken, onLogSuccess) {
  let stopData = null;

  function parseTimeInput(str) {
    let total = 0;
    const hMatch = str.match(/(\d+)\s*h/);
    const mMatch = str.match(/(\d+)\s*m/);
    const sMatch = str.match(/(\d+)\s*s/);
    if (hMatch) total += parseInt(hMatch[1]) * 3600;
    if (mMatch) total += parseInt(mMatch[1]) * 60;
    if (sMatch) total += parseInt(sMatch[1]);
    if (!hMatch && !mMatch && !sMatch) {
      const num = parseInt(str);
      if (!isNaN(num)) total = num * 60;
    }
    return total;
  }

  function setStopData(data) { stopData = data; }
  function getStopData() { return stopData; }

  async function submitLog() {
    if (!stopData || !tempoToken) {
      refs.logStatus.textContent = '\u26a0\ufe0f No token';
      refs.logStatus.className = 'log-status error';
      return;
    }

    refs.btnLog.disabled = true;
    refs.logStatus.textContent = '\u23f3';
    refs.logStatus.className = 'log-status';

    try {
      const timeSeconds = parseTimeInput(refs.logTime.value);
      if (timeSeconds < 60) throw new Error('Min 1m');

      const startDate = new Date(stopData.startTime);
      const dateStr = startDate.toISOString().split('T')[0];
      const timeStr = startDate.toTimeString().split(' ')[0];

      const jiraBase = await getJiraBaseUrl();
      const [user, issue] = await Promise.all([
        jiraFetch(`${jiraBase}/rest/api/3/myself`),
        jiraFetch(`${jiraBase}/rest/api/3/issue/${stopData.issueKey}?fields=id`),
      ]);
      const issueId = parseInt(issue.id);
      if (!issueId) throw new Error('No issue ID');

      const tempoRes = await new Promise(r => {
        chrome.runtime.sendMessage({
          type: 'JTP_TEMPO_LOG',
          token: tempoToken,
          payload: {
            issueId,
            timeSpentSeconds: timeSeconds,
            startDate: dateStr,
            startTime: timeStr,
            description: refs.logDesc.value || '',
            authorAccountId: user.accountId,
          }
        }, r);
      });

      if (!tempoRes || !tempoRes.ok) throw new Error(tempoRes?.error || 'Failed');

      refs.logStatus.textContent = '\u2705 Logged!';
      refs.logStatus.className = 'log-status success';
      if (onLogSuccess) onLogSuccess();
      trackTimerLog();
      timerController.clearTimer();
      stopData = null;
    } catch (e) {
      refs.logStatus.textContent = `\u274c ${e.message}`;
      refs.logStatus.className = 'log-status error';
    } finally {
      refs.btnLog.disabled = false;
    }
  }

  function discard() {
    stopData = null;
    timerController.clearTimer();
  }

  function trackTimerLog() {
    if (!isExtensionValid()) return;
    chrome.storage.local.get('jtp-analytics', (result) => {
      const analytics = result['jtp-analytics'] || { totalTasks: 0, sessions: 0, sprintAssigned: 0, csvImported: 0, history: [] };
      analytics.history.push({ date: new Date().toISOString().split('T')[0], count: 1, project: stopData?.issueKey?.split('-')[0] || '', method: 'timer' });
      if (analytics.history.length > 100) analytics.history = analytics.history.slice(-100);
      chrome.storage.local.set({ 'jtp-analytics': analytics });
    });
  }

  return { submitLog, discard, setStopData, getStopData };
}

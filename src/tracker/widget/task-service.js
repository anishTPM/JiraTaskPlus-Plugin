// Single Responsibility: Jira API communication, task fetching, and recent tasks tracking.
// Dependency Inversion: Depends on abstract messaging (chrome.runtime.sendMessage).

const MAX_FETCH = 30;
const MAX_RECENT = 5;
const RECENT_KEY = 'jtp-recent-tasks';

export function isExtensionValid() {
  try { return !!chrome.runtime?.id; } catch (e) { return false; }
}

export function jiraFetch(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    if (!isExtensionValid()) { reject(new Error('Extension invalid')); return; }
    chrome.runtime.sendMessage({ type: 'JTP_JIRA_FETCH', url, method, body }, (res) => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      if (!res || !res.ok) { reject(new Error(res?.error || 'Fetch failed')); return; }
      resolve(res.data);
    });
  });
}

export async function getJiraBaseUrl() {
  return new Promise(r => {
    if (!isExtensionValid()) { r('https://teneritycloud.atlassian.net'); return; }
    chrome.storage.local.get('jtp-tracker-jira-base', (res) => {
      r(res['jtp-tracker-jira-base'] || 'https://teneritycloud.atlassian.net');
    });
  });
}

export async function fetchTasks(jqlFilter) {
  const jiraBase = await getJiraBaseUrl();
  const data = await jiraFetch(`${jiraBase}/rest/api/3/search/jql`, 'POST', {
    jql: jqlFilter,
    maxResults: MAX_FETCH,
    fields: ['summary', 'parent', 'status', 'timetracking']
  });
  return data.issues || [];
}

export async function getRecentTasks() {
  return new Promise(r => {
    chrome.storage.local.get(RECENT_KEY, (res) => {
      r(res[RECENT_KEY] || []);
    });
  });
}

export function pushRecentTask(issue) {
  chrome.storage.local.get(RECENT_KEY, (res) => {
    let recent = res[RECENT_KEY] || [];
    // Remove if already exists, then prepend
    recent = recent.filter(r => r.key !== issue.key);
    recent.unshift({ key: issue.key, summary: issue.summary, epicKey: issue.epicKey || '', epicSummary: issue.epicSummary || '' });
    if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
    chrome.storage.local.set({ [RECENT_KEY]: recent });
  });
}

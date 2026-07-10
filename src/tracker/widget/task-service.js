// Single Responsibility: Jira API communication and task fetching.
// Dependency Inversion: Depends on abstract messaging (chrome.runtime.sendMessage).

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
    maxResults: 15,
    fields: ['summary', 'parent']
  });
  return data.issues || [];
}

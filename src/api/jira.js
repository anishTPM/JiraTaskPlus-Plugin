import ORG_CONFIG from '../org-config.js';

const BASE = ORG_CONFIG.JIRA_BASE_URL;

async function jiraFetch(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jira API error ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export async function getCurrentUser() {
  return jiraFetch('/rest/api/3/myself');
}

export async function getIssue(issueKey) {
  return jiraFetch(`/rest/api/3/issue/${issueKey}?expand=names`);
}

export async function getProjectBoards(projectKey) {
  return jiraFetch(`/rest/agile/1.0/board?projectKeyOrId=${projectKey}&type=scrum`);
}

export async function getBoardSprints(boardId) {
  const active = await jiraFetch(`/rest/agile/1.0/board/${boardId}/sprint?state=active`);
  const future = await jiraFetch(`/rest/agile/1.0/board/${boardId}/sprint?state=future`);
  return [
    ...(active.values || []).map(s => ({ ...s, state: 'active' })),
    ...(future.values || []).map(s => ({ ...s, state: 'future' })),
  ];
}

export async function searchUsers(query, projectKey) {
  // Use empty query to get all users, increase maxResults
  const q = query || '';
  return jiraFetch(`/rest/api/3/user/assignable/search?project=${projectKey}&query=${encodeURIComponent(q)}&maxResults=1000`);
}

export async function getFinancialCategoryOptions(projectKey) {
  const meta = await jiraFetch(
    `/rest/api/3/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=Task&expand=projects.issuetypes.fields`
  );
  const fields = meta?.projects?.[0]?.issuetypes?.[0]?.fields || {};
  const fc = fields[ORG_CONFIG.CUSTOM_FIELDS.FINANCIAL_CATEGORY];
  return fc?.allowedValues || [];
}

export async function searchJql(jql, fields = ['summary'], maxResults = 100) {
  console.log('JTP: searchJql request:', { jql, fields, maxResults });
  const res = await jiraFetch('/rest/api/3/search/jql', {
    method: 'POST',
    body: JSON.stringify({ jql, maxResults, fields }),
  });
  console.log('JTP: searchJql response:', JSON.stringify(res).substring(0, 500));
  return res;
}

export async function searchLabels(query) {
  return jiraFetch(`/rest/api/3/jql/autocompletedata/suggestions?fieldName=labels&fieldValue=${encodeURIComponent(query)}`);
}

export async function getProjectLabels(projectKey) {
  const res = await searchJql(`project = "${projectKey}" AND labels is not EMPTY`, ['labels'], 100);
  const labelSet = new Set();
  (res.issues || []).forEach(issue => {
    (issue.fields.labels || []).forEach(label => labelSet.add(label));
  });
  return Array.from(labelSet).sort();
}

export async function getChildIssues(parentKey, childType) {
  const jql = `issuetype = ${childType} AND parent = "${parentKey}" AND statusCategory != "Done"`;
  console.log('JTP: getChildIssues JQL:', jql);
  return searchJql(jql, ['summary']);
}

export async function createIssue(payload) {
  return jiraFetch('/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createIssueLink(inwardIssueKey, outwardIssueKey) {
  return jiraFetch('/rest/api/3/issueLink', {
    method: 'POST',
    body: JSON.stringify({
      type: { name: ORG_CONFIG.ISSUE_LINK_TYPE },
      inwardIssue: { key: inwardIssueKey },
      outwardIssue: { key: outwardIssueKey },
    }),
  });
}

export async function addIssueToSprint(sprintId, issueKeys) {
  return jiraFetch(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
    method: 'POST',
    body: JSON.stringify({ issues: issueKeys }),
  });
}

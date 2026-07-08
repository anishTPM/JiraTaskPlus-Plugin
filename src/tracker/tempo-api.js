// ── Tempo Cloud API Client ──────────────────────────────────────────────────
// Completely isolated from main Jira API. Uses api.tempo.io/4 with Bearer token.

const TEMPO_BASE = 'https://api.tempo.io/4';

async function tempoFetch(path, token, options = {}) {
  const res = await fetch(`${TEMPO_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tempo API ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export async function logWorkToTempo(token, { issueKey, timeSpentSeconds, startDate, startTime, description, authorAccountId }) {
  return tempoFetch('/worklogs', token, {
    method: 'POST',
    body: JSON.stringify({
      issueKey,
      timeSpentSeconds,
      startDate,
      startTime,
      description: description || '',
      authorAccountId,
    }),
  });
}

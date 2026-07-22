import ORG_CONFIG from '../org-config.js';

// ── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.body.classList.toggle('dark', dark);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = dark ? '☀️ Light Mode' : '🌙 Dark Mode';
}
chrome.storage.local.get('jtp-dark-mode', (res) => applyTheme(!!res['jtp-dark-mode']));
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark');
    chrome.storage.local.set({ 'jtp-dark-mode': !isDark }, () => applyTheme(!isDark));
  });
});

// ── Navigation ──────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`page-${item.dataset.page}`).classList.add('active');
    if (item.dataset.page === 'analytics') loadAnalytics();
    if (item.dataset.page === 'tracker') loadTrackerSettings();
    if (item.dataset.page === 'calendar') loadCalendarSettings();
  });
});

// ── Org Configs Page ────────────────────────────────────────────────────────
document.getElementById('cfg-env').textContent = ORG_CONFIG._ENV || 'production';
document.getElementById('cfg-base-url').textContent = ORG_CONFIG.JIRA_BASE_URL;
document.getElementById('cfg-confluence-url').textContent = ORG_CONFIG.CONFLUENCE_BASE_URL || 'Not configured';
document.getElementById('cfg-confluence-space').textContent = ORG_CONFIG.CONFLUENCE_SPACE_KEY || 'N/A';
document.getElementById('cfg-link-type').textContent = ORG_CONFIG.ISSUE_LINK_TYPE;

const fieldsEl = document.getElementById('cfg-fields');
Object.entries(ORG_CONFIG.CUSTOM_FIELDS).forEach(([key, value]) => {
  fieldsEl.innerHTML += `<span class="label">${key}</span><span class="value">${value}</span>`;
});

document.getElementById('cfg-fc-options').innerHTML = ORG_CONFIG.FINANCIAL_CATEGORY_OPTIONS
  .map(o => `<span class="badge">${o}</span>`).join('');

// ── Analytics ───────────────────────────────────────────────────────────────
// Time-saved algorithm constants (in minutes)
const TIME_PER_TASK_MANUAL = 3;       // navigating, filling fields, submitting
const TIME_PER_SPRINT_ASSIGN = 1;     // batch sprint assignment bonus
const TIME_PER_CSV_IMPORT = 2;        // extra time saved per CSV-imported task

async function loadAnalytics() {
  const data = await getAnalyticsData();
  renderStats(data);
  syncToConfluence(data);
}

async function getAnalyticsData() {
  return new Promise(resolve => {
    chrome.storage.local.get('jtp-analytics', (result) => {
      resolve(result['jtp-analytics'] || { totalTasks: 0, sessions: 0, sprintAssigned: 0, csvImported: 0, history: [] });
    });
  });
}

function calculateTimeSaved(data) {
  const taskMinutes = data.totalTasks * TIME_PER_TASK_MANUAL;
  const sprintMinutes = (data.sprintAssigned || 0) * TIME_PER_SPRINT_ASSIGN;
  const csvMinutes = (data.csvImported || 0) * TIME_PER_CSV_IMPORT;
  return taskMinutes + sprintMinutes + csvMinutes;
}

function formatTime(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function renderStats(data) {
  const totalMinutes = calculateTimeSaved(data);
  const avgPerSession = data.sessions > 0 ? Math.round(data.totalTasks / data.sessions) : 0;

  document.getElementById('stat-total-tasks').textContent = data.totalTasks;
  document.getElementById('stat-time-saved').textContent = formatTime(totalMinutes);
  document.getElementById('stat-sessions').textContent = data.sessions;
  document.getElementById('stat-avg-per-session').textContent = avgPerSession;

  // Breakdown table
  const taskMin = data.totalTasks * TIME_PER_TASK_MANUAL;
  const sprintMin = (data.sprintAssigned || 0) * TIME_PER_SPRINT_ASSIGN;
  const csvMin = (data.csvImported || 0) * TIME_PER_CSV_IMPORT;

  document.getElementById('breakdown-body').innerHTML = `
    <tr><td>Bulk task creation</td><td>${data.totalTasks}</td><td>${formatTime(taskMin)}</td></tr>
    <tr><td>Sprint batch assignment</td><td>${data.sprintAssigned || 0}</td><td>${formatTime(sprintMin)}</td></tr>
    <tr><td>CSV import</td><td>${data.csvImported || 0}</td><td>${formatTime(csvMin)}</td></tr>
    <tr style="font-weight:700; border-top:2px solid #e2e8f0"><td>Total</td><td>${data.totalTasks}</td><td>${formatTime(totalMinutes)}</td></tr>
  `;

  // Recent activity
  const history = (data.history || []).slice(-20).reverse();
  document.getElementById('activity-body').innerHTML = history.length
    ? history.map(h => `<tr><td>${h.date}</td><td>${h.count}</td><td>${h.project || '-'}</td><td>${h.method || 'bulk'}</td></tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center; color:#9ca3af">No activity yet</td></tr>';
}

// ── Confluence Sync ─────────────────────────────────────────────────────────
// Updates the existing table on the Confluence page.
// Finds user row by email/name → updates it, or appends a new row.
async function syncToConfluence(data) {
  const statusEl = document.getElementById('sync-status');
  if (!ORG_CONFIG.CONFLUENCE_BASE_URL || !ORG_CONFIG.CONFLUENCE_PAGE_ID) {
    statusEl.className = 'sync-status error';
    statusEl.textContent = '⚠️ Confluence page not configured in org config.';
    return;
  }

  statusEl.className = 'sync-status syncing';
  statusEl.textContent = '⏳ Syncing analytics to Confluence...';

  try {
    // Get current Jira user — use emailAddress as unique identifier
    const userRes = await fetch(`${ORG_CONFIG.JIRA_BASE_URL}/rest/api/3/myself`, { credentials: 'include' });
    if (!userRes.ok) throw new Error('Failed to fetch current user');
    const user = await userRes.json();
    const email = user.emailAddress;
    if (!email) throw new Error('No email found for current user');

    const totalMinutes = calculateTimeSaved(data);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Fetch existing page
    const pageUrl = `${ORG_CONFIG.CONFLUENCE_BASE_URL}/${ORG_CONFIG.CONFLUENCE_PAGE_ID}?expand=body.storage,version`;
    const pageRes = await fetch(pageUrl, { credentials: 'include' });
    if (!pageRes.ok) throw new Error(`Failed to fetch page: ${pageRes.status}`);
    const page = await pageRes.json();

    let body = page.body.storage.value || '';

    // Row cells: User (email) | Tasks | Time Saved | Bulk Sessions | Last Updated
    const cells = `<td>${escHtml(email)}</td><td>${data.totalTasks}</td><td>${formatTime(totalMinutes)}</td><td>${data.sessions}</td><td>${now}</td>`;

    // Match row by email — handle both plain <td> and Confluence storage format
    const emailEscaped = escHtml(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rowRegex = new RegExp(`<tr[^>]*>[\\s\\S]*?${emailEscaped}[\\s\\S]*?<\/tr>`, 'i');

    if (rowRegex.test(body)) {
      body = body.replace(rowRegex, `<tr>${cells}</tr>`);
    } else if (body.includes('</tbody>')) {
      body = body.replace(/<\/tbody>/, `<tr>${cells}</tr>\n</tbody>`);
    } else if (body.includes('</table>')) {
      body = body.replace(/<\/table>/, `<tr>${cells}</tr>\n</table>`);
    } else {
      body += `<table><tbody><tr><th>User</th><th>Tasks</th><th>Time Saved</th><th>Sessions</th><th>Last Updated</th></tr><tr>${cells}</tr></tbody></table>`;
    }

    // PUT updated page
    const updateRes = await fetch(`${ORG_CONFIG.CONFLUENCE_BASE_URL}/${ORG_CONFIG.CONFLUENCE_PAGE_ID}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ORG_CONFIG.CONFLUENCE_PAGE_ID,
        type: 'page',
        title: page.title,
        space: { key: ORG_CONFIG.CONFLUENCE_SPACE_KEY },
        version: { number: page.version.number + 1 },
        body: { storage: { value: body, representation: 'storage' } }
      })
    });
    if (!updateRes.ok) throw new Error(`Update failed: ${updateRes.status}`);

    const pageLink = `${ORG_CONFIG.CONFLUENCE_BASE_URL.replace('/wiki/rest/api/content', '/wiki/spaces')}/${ORG_CONFIG.CONFLUENCE_SPACE_KEY}/pages/${ORG_CONFIG.CONFLUENCE_PAGE_ID}`;
    statusEl.className = 'sync-status';
    statusEl.innerHTML = `✅ Synced as <b>${escHtml(email)}</b> &nbsp;·&nbsp; <a href="${pageLink}" target="_blank" style="color:#166534;text-decoration:underline;">View Confluence page ↗</a> &nbsp;(${new Date().toLocaleTimeString()})`;
  } catch (e) {
    statusEl.className = 'sync-status error';
    statusEl.textContent = `❌ Confluence sync failed: ${e.message}`;
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Tracker Settings ──────────────────────────────────────────────────────
function loadTrackerSettings() {
  chrome.storage.local.get(['jtp-features', 'jtp-tempo-token', 'jtp-tracker-jql', 'jtp-tracker-jira-base', 'jtp-tracker-reminder', 'jtp-pill-style'], (res) => {
    const features = res['jtp-features'] || {};
    const reminder = res['jtp-tracker-reminder'] || { enabled: false, interval: 30 };
    const pillStyle = res['jtp-pill-style'] || 'default';
    document.getElementById('tracker-enabled').checked = !!features.tracker;
    document.getElementById('tempo-token').value = res['jtp-tempo-token'] || '';
    document.getElementById('tracker-jql').value = res['jtp-tracker-jql'] || 'assignee = currentUser() AND sprint in openSprints() AND statusCategory != Done';
    document.getElementById('tracker-jira-base').value = res['jtp-tracker-jira-base'] || ORG_CONFIG.JIRA_BASE_URL;
    document.getElementById('reminder-enabled').checked = !!reminder.enabled;
    document.getElementById('reminder-interval').value = String(reminder.interval || 30);
    // Pill style
    const radio = document.querySelector(`input[name="pill-style"][value="${pillStyle}"]`);
    if (radio) radio.checked = true;
    highlightPillOption();
  });
}

function highlightPillOption() {
  document.querySelectorAll('.pill-option').forEach(label => {
    const radio = label.querySelector('input[type="radio"]');
    label.style.borderColor = radio.checked ? '#6366f1' : '#e2e8f0';
    label.style.background = radio.checked ? '#eef2ff' : '#fff';
  });
}
document.querySelectorAll('input[name="pill-style"]').forEach(r => r.addEventListener('change', highlightPillOption));

document.getElementById('toggle-token-vis').addEventListener('click', () => {
  const inp = document.getElementById('tempo-token');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

document.getElementById('save-tracker').addEventListener('click', () => {
  const enabled = document.getElementById('tracker-enabled').checked;
  const token = document.getElementById('tempo-token').value.trim();
  const jql = document.getElementById('tracker-jql').value.trim();
  const jiraBase = document.getElementById('tracker-jira-base').value.trim();
  const reminderEnabled = document.getElementById('reminder-enabled').checked;
  const reminderInterval = parseInt(document.getElementById('reminder-interval').value, 10);
  const pillStyle = document.querySelector('input[name="pill-style"]:checked')?.value || 'default';

  chrome.storage.local.get('jtp-features', (res) => {
    const features = res['jtp-features'] || {};
    features.tracker = enabled;
    chrome.storage.local.set({
      'jtp-features': features,
      'jtp-tempo-token': token,
      'jtp-tracker-jql': jql,
      'jtp-tracker-jira-base': jiraBase,
      'jtp-tracker-reminder': { enabled: reminderEnabled, interval: reminderInterval },
      'jtp-pill-style': pillStyle,
    }, () => {
      const status = document.getElementById('tracker-save-status');
      status.textContent = '✅ Saved! Reload browser tabs for changes to take effect.';
      setTimeout(() => { status.textContent = ''; }, 4000);
    });
  });
});

// ── Calendar Settings ───────────────────────────────────────────────────────
const isEdge = navigator.userAgent.includes('Edg/');

function loadCalendarSettings() {
  if (!isEdge) {
    document.getElementById('calendar-edge-notice').style.display = 'block';
    document.getElementById('calendar-controls').style.opacity = '0.4';
    document.getElementById('calendar-controls').style.pointerEvents = 'none';
    return;
  }
  chrome.storage.local.get(['jtp-features', 'jtp-calendar-filters'], (res) => {
    const features = res['jtp-features'] || {};
    const filters = res['jtp-calendar-filters'] || { skipAllDay: true, blocklist: [] };
    document.getElementById('calendar-enabled').checked = !!features.calendar;
    document.getElementById('filter-allday').checked = filters.skipAllDay !== false;
    document.getElementById('filter-blocklist').value = (filters.blocklist || []).join(', ');
  });
}

document.getElementById('save-calendar').addEventListener('click', () => {
  const enabled = document.getElementById('calendar-enabled').checked;
  const skipAllDay = document.getElementById('filter-allday').checked;
  const blocklistRaw = document.getElementById('filter-blocklist').value;
  const blocklist = blocklistRaw.split(',').map(s => s.trim()).filter(Boolean);

  chrome.storage.local.get('jtp-features', (res) => {
    const features = res['jtp-features'] || {};
    features.calendar = enabled;
    chrome.storage.local.set({
      'jtp-features': features,
      'jtp-calendar-filters': { skipAllDay, blocklist }
    }, () => {
      const status = document.getElementById('calendar-save-status');
      status.textContent = '✅ Saved! Reload browser tabs for changes to take effect.';
      setTimeout(() => { status.textContent = ''; }, 4000);
    });
  });
});

document.getElementById('debug-calendar').addEventListener('click', async () => {
  const statusEl = document.getElementById('calendar-test-status');
  statusEl.textContent = '⏳ Reading Outlook localStorage...';
  statusEl.style.color = '#1e40af';
  chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_DEBUG' }, (res) => {
    if (chrome.runtime.lastError || res?.error) {
      statusEl.textContent = `❌ ${res?.error || chrome.runtime.lastError?.message}`;
      statusEl.style.color = '#991b1b';
      return;
    }
    // Log each key on its own line so nothing is truncated
    console.log('[JTP Debug] msal.3| entries:');
    res.forEach(e => console.log(JSON.stringify(e)));
    statusEl.textContent = `🔍 ${res.length} msal.3| keys logged to console (F12 → expand each line).`;
    statusEl.style.color = '#92400e';
  });
});

document.getElementById('test-calendar').addEventListener('click', async () => {
  const statusEl = document.getElementById('calendar-test-status');
  const resultsEl = document.getElementById('calendar-results');
  const bodyEl = document.getElementById('calendar-events-body');

  statusEl.textContent = '⏳ Fetching...';
  statusEl.style.color = '#1e40af';
  resultsEl.style.display = 'none';

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const url = `https://outlook.office.com/api/v2.0/me/calendarview?startDateTime=${startOfDay}&endDateTime=${endOfDay}&$orderby=start/dateTime&$top=20`;

  chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_FETCH', url }, (res) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = `❌ Extension error: ${chrome.runtime.lastError.message}`;
      statusEl.style.color = '#991b1b';
      return;
    }
    if (!res || !res.ok) {
      statusEl.textContent = `❌ ${res?.error || 'Failed to fetch. Are you logged into Outlook in this browser?'}`;
      statusEl.style.color = '#991b1b';
      return;
    }

    // Handle both REST API format and OWA service.svc format
    const events = res.data.value || res.data.CalendarEvents || res.data.CalendarView || [];
    statusEl.style.color = '#16a34a';

    // Apply filters to test view
    const filterAllDay = document.getElementById('filter-allday').checked;
    const blocklistVal = document.getElementById('filter-blocklist').value;
    const blockWords = blocklistVal.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const filtered = events.filter(ev => {
      if (filterAllDay && (ev.IsAllDay || ev.isAllDay)) return false;
      const subj = (ev.Subject || ev.subject || '').toLowerCase();
      if (blockWords.some(kw => subj.includes(kw))) return false;
      return true;
    });

    statusEl.textContent = `✅ Found ${events.length} event(s) today (${filtered.length} after filters)`;

    if (filtered.length === 0) {
      bodyEl.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#9ca3af">No events after filtering</td></tr>';
    } else {
      bodyEl.innerHTML = filtered.map(ev => {
        // Support REST API (Start.DateTime), Graph API (start.dateTime), and OWA (Start/End as ISO strings)
        const startRaw = ev.Start?.DateTime || ev.start?.dateTime || ev.Start || '';
        const endRaw = ev.End?.DateTime || ev.end?.dateTime || ev.End || '';
        const subject = ev.Subject || ev.subject || '(No subject)';
        const start = new Date(startRaw.endsWith('Z') ? startRaw : startRaw + 'Z');
        const end = new Date(endRaw.endsWith('Z') ? endRaw : endRaw + 'Z');
        const durMin = Math.round((end - start) / 60000);
        const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isPast = end < now;
        const isNow = start <= now && end >= now;
        const status = isNow ? '🟢 Now' : isPast ? '✅ Done' : '🔵 Upcoming';
        return `<tr><td>${timeStr}</td><td>${escHtml(subject)}</td><td>${durMin}m</td><td>${status}</td></tr>`;
      }).join('');
    }
    resultsEl.style.display = 'block';
  });
});

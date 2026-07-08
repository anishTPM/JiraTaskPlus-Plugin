import ORG_CONFIG from '../org-config.js';

// ── Navigation ──────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`page-${item.dataset.page}`).classList.add('active');
    if (item.dataset.page === 'analytics') loadAnalytics();
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

    // Match row by email in first <td>
    const emailEscaped = escHtml(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rowRegex = new RegExp(`<tr>\\s*<td>${emailEscaped}<\/td>[\\s\\S]*?<\/tr>`);

    if (rowRegex.test(body)) {
      body = body.replace(rowRegex, `<tr>${cells}</tr>`);
    } else {
      body = body.replace(/<\/tbody>/, `<tr>${cells}</tr>\n</tbody>`);
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

    statusEl.className = 'sync-status';
    statusEl.textContent = `✅ Synced to Confluence as ${email} (${new Date().toLocaleTimeString()})`;
  } catch (e) {
    statusEl.className = 'sync-status error';
    statusEl.textContent = `❌ Confluence sync failed: ${e.message}`;
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

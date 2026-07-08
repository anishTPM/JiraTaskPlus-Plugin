// ── Tracker Floating Widget ─────────────────────────────────────────────────
// Injected on all pages. Uses Shadow DOM for complete style isolation.
// Feature-flagged: checks chrome.storage for 'jtp-feature-tracker' before rendering.

(async function () {
  // Feature flag check
  const flags = await new Promise(r => chrome.storage.local.get('jtp-features', res => r(res['jtp-features'] || {})));
  if (!flags.tracker) return;

  const config = await new Promise(r => chrome.storage.local.get(['jtp-tracker-jql', 'jtp-tempo-token', 'jtp-tracker-position'], res => r(res)));
  const TEMPO_TOKEN = config['jtp-tempo-token'] || '';
  const JQL_FILTER = config['jtp-tracker-jql'] || 'assignee = currentUser() AND sprint in openSprints() AND statusCategory != Done';

  // ── Create Shadow DOM host ──────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'jtp-tracker-host';
  host.style.cssText = 'position:fixed; z-index:2147483647; top:0; left:0; width:0; height:0; pointer-events:none;';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  // ── Styles ──────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    .bubble { position:fixed; bottom:24px; right:24px; pointer-events:auto; cursor:pointer; user-select:none; transition:all 0.2s ease; }
    .pill { display:flex; align-items:center; gap:8px; background:#1e293b; color:#f1f5f9; padding:8px 14px; border-radius:24px; box-shadow:0 4px 20px rgba(0,0,0,0.25); font-size:13px; font-weight:500; white-space:nowrap; }
    .pill:hover { background:#334155; transform:scale(1.03); }
    .pill .dot { width:8px; height:8px; border-radius:50%; background:#ef4444; animation:blink 1.2s infinite; }
    .pill .idle-icon { font-size:18px; }
    .pill .timer { font-family:'SF Mono',monospace; font-size:13px; letter-spacing:0.5px; }
    .pill .stop-btn { background:#ef4444; color:#fff; border:none; border-radius:50%; width:22px; height:22px; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
    .pill .stop-btn:hover { background:#dc2626; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

    .panel { position:fixed; bottom:70px; right:24px; width:320px; background:#fff; border-radius:14px; box-shadow:0 8px 40px rgba(0,0,0,0.18); pointer-events:auto; display:none; overflow:hidden; border:1px solid #e2e8f0; }
    .panel.open { display:block; animation:slideUp 0.2s ease; }
    @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .panel-header { padding:14px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; }
    .panel-header h3 { font-size:13px; font-weight:700; color:#1e293b; }
    .panel-header .close-btn { background:none; border:none; font-size:18px; cursor:pointer; color:#94a3b8; line-height:1; }
    .task-list { max-height:320px; overflow-y:auto; padding:8px; }
    .task-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:pointer; transition:background 0.1s; }
    .task-item:hover { background:#f1f5f9; }
    .task-item .task-key { font-size:11px; font-weight:700; color:#6366f1; min-width:70px; }
    .task-item .task-summary { font-size:12px; color:#334155; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .task-item .play-btn { background:#22c55e; color:#fff; border:none; border-radius:50%; width:26px; height:26px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 0.15s; }
    .task-item .play-btn:hover { background:#16a34a; }
    .empty-state { padding:24px; text-align:center; color:#94a3b8; font-size:12px; }
    .loading { padding:24px; text-align:center; color:#94a3b8; font-size:12px; }

    /* Log Modal */
    .log-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:none; align-items:center; justify-content:center; pointer-events:auto; z-index:999; }
    .log-overlay.open { display:flex; animation:fadeIn 0.15s ease; }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    .log-modal { background:#fff; border-radius:16px; padding:28px; width:340px; box-shadow:0 12px 48px rgba(0,0,0,0.2); }
    .log-modal h3 { font-size:15px; font-weight:700; color:#1e293b; margin-bottom:4px; }
    .log-modal .issue-key { font-size:12px; color:#6366f1; font-weight:600; margin-bottom:16px; }
    .log-modal label { font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:4px; }
    .log-modal input, .log-modal textarea { width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; font-size:13px; outline:none; transition:border-color 0.15s; margin-bottom:12px; }
    .log-modal input:focus, .log-modal textarea:focus { border-color:#6366f1; }
    .log-modal textarea { resize:none; height:70px; }
    .log-modal .actions { display:flex; gap:10px; justify-content:flex-end; margin-top:8px; }
    .log-modal .btn-discard { background:none; border:1px solid #e2e8f0; border-radius:8px; padding:8px 16px; font-size:13px; cursor:pointer; color:#64748b; }
    .log-modal .btn-discard:hover { background:#f8fafc; }
    .log-modal .btn-log { background:linear-gradient(135deg,#6366f1,#3b82f6); color:#fff; border:none; border-radius:8px; padding:8px 20px; font-size:13px; font-weight:600; cursor:pointer; transition:opacity 0.15s; }
    .log-modal .btn-log:hover { opacity:0.9; }
    .log-modal .btn-log:disabled { opacity:0.5; cursor:not-allowed; }
    .log-status { font-size:11px; margin-top:8px; text-align:center; }
    .log-status.success { color:#16a34a; }
    .log-status.error { color:#ef4444; }
  `;
  shadow.appendChild(style);

  // ── DOM Structure ───────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="bubble" id="bubble">
      <div class="pill" id="pill">
        <span class="idle-icon" id="idle-icon">😴</span>
        <span class="dot" id="dot" style="display:none"></span>
        <span class="timer" id="timer-display" style="display:none">00:00:00</span>
        <span id="active-key" style="display:none; font-size:11px; color:#94a3b8;"></span>
        <button class="stop-btn" id="stop-btn" style="display:none">⏹</button>
      </div>
    </div>
    <div class="panel" id="panel">
      <div class="panel-header">
        <h3>🎯 My Tasks</h3>
        <button class="close-btn" id="panel-close">×</button>
      </div>
      <div class="task-list" id="task-list"><div class="loading">Loading tasks...</div></div>
    </div>
    <div class="log-overlay" id="log-overlay">
      <div class="log-modal">
        <h3>✨ Log Time</h3>
        <div class="issue-key" id="log-issue-key"></div>
        <label>⏱️ Time Spent</label>
        <input type="text" id="log-time" placeholder="1h 30m" />
        <label>📝 Description</label>
        <textarea id="log-desc" placeholder="What did you work on?"></textarea>
        <div class="actions">
          <button class="btn-discard" id="btn-discard">Discard</button>
          <button class="btn-log" id="btn-log">✨ Log It!</button>
        </div>
        <div class="log-status" id="log-status"></div>
      </div>
    </div>
  `;
  shadow.appendChild(container);

  // ── Element refs ────────────────────────────────────────────────────────
  const bubble = shadow.getElementById('bubble');
  const pill = shadow.getElementById('pill');
  const idleIcon = shadow.getElementById('idle-icon');
  const dot = shadow.getElementById('dot');
  const timerDisplay = shadow.getElementById('timer-display');
  const activeKey = shadow.getElementById('active-key');
  const stopBtn = shadow.getElementById('stop-btn');
  const panel = shadow.getElementById('panel');
  const panelClose = shadow.getElementById('panel-close');
  const taskList = shadow.getElementById('task-list');
  const logOverlay = shadow.getElementById('log-overlay');
  const logIssueKey = shadow.getElementById('log-issue-key');
  const logTime = shadow.getElementById('log-time');
  const logDesc = shadow.getElementById('log-desc');
  const btnDiscard = shadow.getElementById('btn-discard');
  const btnLog = shadow.getElementById('btn-log');
  const logStatus = shadow.getElementById('log-status');

  let timerInterval = null;
  let currentTimer = null;
  let stopData = null;

  // ── Restore position ────────────────────────────────────────────────────
  const savedPos = config['jtp-tracker-position'];
  if (savedPos) {
    bubble.style.bottom = savedPos.bottom || '24px';
    bubble.style.right = savedPos.right || '24px';
  }

  // ── Timer Display ───────────────────────────────────────────────────────
  function formatElapsed(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function formatForInput(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

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
      if (!isNaN(num)) total = num * 60; // assume minutes
    }
    return total;
  }

  function showRunning(timer) {
    idleIcon.style.display = 'none';
    dot.style.display = 'block';
    timerDisplay.style.display = 'inline';
    activeKey.style.display = 'inline';
    stopBtn.style.display = 'flex';
    activeKey.textContent = timer.issueKey;
    currentTimer = timer;
    startTickDisplay();
  }

  function showIdle() {
    idleIcon.style.display = 'inline';
    dot.style.display = 'none';
    timerDisplay.style.display = 'none';
    activeKey.style.display = 'none';
    stopBtn.style.display = 'none';
    currentTimer = null;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function startTickDisplay() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!currentTimer) return;
      const elapsed = Math.floor((Date.now() - currentTimer.startTime) / 1000);
      timerDisplay.textContent = formatElapsed(elapsed);
    }, 1000);
  }

  // ── Check initial state ─────────────────────────────────────────────────
  chrome.runtime.sendMessage({ type: 'JTP_TIMER_STATUS' }, (timer) => {
    if (timer && timer.running) showRunning(timer);
    else showIdle();
  });

  // ── Bubble click → toggle panel ─────────────────────────────────────────
  pill.addEventListener('click', (e) => {
    if (e.target === stopBtn || stopBtn.contains(e.target)) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) loadTasks();
  });

  panelClose.addEventListener('click', () => panel.classList.remove('open'));

  // ── Stop button ─────────────────────────────────────────────────────────
  stopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'JTP_TIMER_STOP' }, (res) => {
      if (!res || !res.ok) return;
      showIdle();
      stopData = res;
      logIssueKey.textContent = `${res.issueKey} — ${res.summary || ''}`;
      logTime.value = formatForInput(res.elapsed);
      logDesc.value = '';
      logStatus.textContent = '';
      logOverlay.classList.add('open');
    });
  });

  // ── Log Modal ───────────────────────────────────────────────────────────
  btnDiscard.addEventListener('click', () => {
    logOverlay.classList.remove('open');
    chrome.runtime.sendMessage({ type: 'JTP_TIMER_CLEAR' });
    stopData = null;
  });

  btnLog.addEventListener('click', async () => {
    if (!stopData || !TEMPO_TOKEN) {
      logStatus.textContent = '⚠️ Tempo token not configured. Add it in Admin Panel → Tracker.';
      logStatus.className = 'log-status error';
      return;
    }

    btnLog.disabled = true;
    logStatus.textContent = 'Logging...';
    logStatus.className = 'log-status';

    try {
      const timeSeconds = parseTimeInput(logTime.value);
      if (timeSeconds < 60) throw new Error('Minimum 1 minute');

      const startDate = new Date(stopData.startTime);
      const dateStr = startDate.toISOString().split('T')[0];
      const timeStr = startDate.toTimeString().split(' ')[0];

      // Get current user accountId
      const jiraBase = await getJiraBaseUrl();
      const userRes = await fetch(`${jiraBase}/rest/api/3/myself`, { credentials: 'include' });
      const user = await userRes.json();

      // Log to Tempo
      const res = await fetch('https://api.tempo.io/4/worklogs', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TEMPO_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueKey: stopData.issueKey,
          timeSpentSeconds: timeSeconds,
          startDate: dateStr,
          startTime: timeStr,
          description: logDesc.value || '',
          authorAccountId: user.accountId,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      logStatus.textContent = '✅ Logged!';
      logStatus.className = 'log-status success';
      chrome.runtime.sendMessage({ type: 'JTP_TIMER_CLEAR' });

      // Track in analytics
      trackTimerLog();

      setTimeout(() => { logOverlay.classList.remove('open'); stopData = null; }, 1200);
    } catch (e) {
      logStatus.textContent = `❌ ${e.message}`;
      logStatus.className = 'log-status error';
    } finally {
      btnLog.disabled = false;
    }
  });

  // ── Load Tasks ──────────────────────────────────────────────────────────
  async function loadTasks() {
    taskList.innerHTML = '<div class="loading">Loading tasks...</div>';
    try {
      const jiraBase = await getJiraBaseUrl();
      const res = await fetch(`${jiraBase}/rest/api/3/search`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql: JQL_FILTER, maxResults: 10, fields: ['summary'] }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const issues = data.issues || [];

      if (!issues.length) {
        taskList.innerHTML = '<div class="empty-state">😴 No tasks found for your filter</div>';
        return;
      }

      taskList.innerHTML = issues.map(i => `
        <div class="task-item" data-key="${i.key}" data-summary="${esc(i.fields.summary)}">
          <span class="task-key">${i.key}</span>
          <span class="task-summary">${esc(i.fields.summary)}</span>
          <button class="play-btn">▶</button>
        </div>
      `).join('');

      taskList.querySelectorAll('.play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const item = btn.closest('.task-item');
          startTimer(item.dataset.key, item.dataset.summary);
        });
      });
    } catch (e) {
      taskList.innerHTML = `<div class="empty-state">❌ Failed to load: ${e.message}</div>`;
    }
  }

  function startTimer(issueKey, summary) {
    chrome.runtime.sendMessage({ type: 'JTP_TIMER_START', issueKey, summary }, (res) => {
      if (res && res.ok) {
        showRunning({ issueKey, summary, startTime: Date.now(), running: true });
        panel.classList.remove('open');
      }
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  async function getJiraBaseUrl() {
    return new Promise(r => {
      chrome.storage.local.get('jtp-tracker-jira-base', (res) => {
        r(res['jtp-tracker-jira-base'] || 'https://teneritycloud.atlassian.net');
      });
    });
  }

  function trackTimerLog() {
    chrome.storage.local.get('jtp-analytics', (result) => {
      const analytics = result['jtp-analytics'] || { totalTasks: 0, sessions: 0, sprintAssigned: 0, csvImported: 0, history: [] };
      analytics.history.push({ date: new Date().toISOString().split('T')[0], count: 1, project: stopData?.issueKey?.split('-')[0] || '', method: 'timer' });
      if (analytics.history.length > 100) analytics.history = analytics.history.slice(-100);
      chrome.storage.local.set({ 'jtp-analytics': analytics });
    });
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();

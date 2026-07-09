// ── Tracker Floating Widget ─────────────────────────────────────────────────
// Injected on all pages. Uses Shadow DOM for complete style isolation.
// Feature-flagged: checks chrome.storage for 'jtp-feature-tracker' before rendering.

(async function () {
  function isExtensionValid() {
    try { return !!chrome.runtime?.id; } catch (e) { return false; }
  }

  if (!isExtensionValid()) return;

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

  const style = document.createElement('style');
  style.textContent = `
    * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }

    /* Idle bubble */
    .bubble { position:fixed; bottom:28px; right:28px; pointer-events:auto; cursor:grab; user-select:none; }
    .bubble.dragging { cursor:grabbing; }
    .pill-idle { display:flex; align-items:center; justify-content:center; width:52px; height:52px; background:linear-gradient(135deg,#1e293b,#0f172a); border-radius:50%; box-shadow:0 6px 24px rgba(0,0,0,0.35), 0 0 0 3px rgba(99,102,241,0.15); transition:transform 0.2s ease, box-shadow 0.2s ease; }
    .pill-idle:hover { transform:scale(1.1); box-shadow:0 8px 32px rgba(0,0,0,0.4), 0 0 0 4px rgba(99,102,241,0.25); }
    .pill-idle .icon { font-size:22px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3)); animation:float 3s ease-in-out infinite; }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }

    /* Full-width bottom bar (active timer) */
    .bottom-bar { position:fixed; bottom:0; left:0; right:0; pointer-events:auto; background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%); border-top:1px solid #334155; box-shadow:0 -4px 24px rgba(0,0,0,0.3); display:none; z-index:2147483647; animation:barSlideUp 0.25s ease; }
    .bottom-bar.visible { display:block; }
    .bottom-bar.collapsed { left:auto; right:28px; bottom:28px; width:auto; border-radius:24px; border:1px solid #334155; }
    .bottom-bar.collapsed .bar-timer { padding:8px 14px; gap:10px; }
    .bottom-bar.collapsed .bar-timer .divider,
    .bottom-bar.collapsed .bar-timer .bar-task-info { display:none; }
    .bottom-bar.collapsed .bar-timer .timer-text { font-size:14px; }
    .bottom-bar.collapsed .bar-timer .stop-btn { padding:6px 12px; font-size:11px; border-radius:8px; }
    .bottom-bar.collapsed .bar-log { display:none !important; }
    .bottom-bar.collapsed .collapse-btn { transform:rotate(180deg); }
    @keyframes barSlideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }

    .bar-timer { display:flex; align-items:center; padding:12px 24px; gap:16px; }
    .collapse-btn { background:none; border:1px solid #475569; border-radius:6px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#94a3b8; font-size:14px; transition:all 0.2s; flex-shrink:0; }
    .collapse-btn:hover { border-color:#6366f1; color:#e2e8f0; background:rgba(99,102,241,0.1); }
    .bottom-bar.collapsed .collapse-btn { border-color:#6366f1; color:#818cf8; }
    .bar-timer .pulse-dot { width:10px; height:10px; border-radius:50%; background:#ef4444; animation:pulse 1.5s infinite; flex-shrink:0; }
    @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
    .bar-timer .timer-text { font-family:'SF Mono','Fira Code',monospace; font-size:22px; font-weight:700; color:#f1f5f9; letter-spacing:1px; min-width:100px; }
    .bar-timer .divider { width:1px; height:32px; background:#334155; }
    .bar-task-info { display:flex; flex-direction:column; gap:2px; flex:1; overflow:hidden; }
    .bar-task-info .task-key { font-size:11px; font-weight:700; color:#818cf8; }
    .bar-task-info .task-summary { font-size:13px; color:#e2e8f0; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .bar-task-info .epic-badge { display:inline-flex; align-items:center; gap:4px; font-size:10px; color:#a5b4fc; font-weight:500; margin-top:1px; }
    .bar-actions { display:flex; align-items:center; gap:12px; margin-left:auto; flex-shrink:0; }
    .stop-btn { background:#ef4444; color:#fff; border:none; border-radius:10px; padding:10px 20px; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.15s; }
    .stop-btn:hover { background:#dc2626; transform:scale(1.03); }

    /* Log form inside bottom bar */
    .bar-log { display:none; align-items:center; padding:12px 24px; gap:14px; border-top:1px solid #334155; }
    .bar-log.visible { display:flex; }
    .bar-log .log-label { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; flex-shrink:0; }
    .bar-log .log-issue { font-size:12px; color:#818cf8; font-weight:700; flex-shrink:0; min-width:80px; }
    .bar-log input, .bar-log textarea { border:1.5px solid #334155; border-radius:8px; padding:8px 12px; font-size:13px; outline:none; background:#0f172a; color:#f1f5f9; transition:border-color 0.15s; }
    .bar-log input:focus, .bar-log textarea:focus { border-color:#6366f1; }
    .bar-log input { width:100px; }
    .bar-log textarea { flex:1; resize:none; height:36px; min-width:200px; }
    .bar-log .btn-discard { background:transparent; border:1.5px solid #475569; border-radius:8px; padding:8px 16px; font-size:12px; font-weight:600; cursor:pointer; color:#94a3b8; transition:all 0.15s; }
    .bar-log .btn-discard:hover { border-color:#64748b; color:#e2e8f0; }
    .bar-log .btn-log { background:linear-gradient(135deg,#6366f1,#3b82f6); color:#fff; border:none; border-radius:8px; padding:8px 20px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.15s; box-shadow:0 2px 8px rgba(99,102,241,0.3); }
    .bar-log .btn-log:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(99,102,241,0.4); }
    .bar-log .btn-log:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
    .bar-log .log-status { font-size:11px; font-weight:500; min-width:60px; text-align:center; }
    .bar-log .log-status.success { color:#4ade80; }
    .bar-log .log-status.error { color:#f87171; }

    /* Task list panel */
    .panel { position:fixed; bottom:28px; right:28px; width:380px; background:#fff; border-radius:16px; box-shadow:0 12px 48px rgba(0,0,0,0.2); pointer-events:auto; display:none; overflow:hidden; border:1px solid #e2e8f0; }
    .panel.open { display:block; animation:slideUp 0.2s ease; }
    @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .panel-header { padding:18px 20px; background:linear-gradient(135deg,#f8fafc,#eef2ff); border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; }
    .panel-header h3 { font-size:15px; font-weight:700; color:#1e293b; display:flex; align-items:center; gap:8px; }
    .panel-header .close-btn { background:none; border:none; font-size:20px; cursor:pointer; color:#94a3b8; line-height:1; padding:4px; border-radius:6px; }
    .panel-header .close-btn:hover { background:#f1f5f9; color:#64748b; }
    .task-list { max-height:400px; overflow-y:auto; padding:10px; }
    .task-item { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:10px; transition:background 0.1s; border:1px solid transparent; }
    .task-item:hover { background:#f8fafc; border-color:#e2e8f0; }
    .task-info { flex:1; overflow:hidden; }
    .task-item .task-key { font-size:11px; font-weight:700; color:#6366f1; }
    .task-item .task-summary { font-size:13px; color:#334155; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px; }
    .task-item .task-epic { font-size:10px; color:#94a3b8; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .task-item .play-btn { background:#22c55e; color:#fff; border:none; border-radius:50%; width:32px; height:32px; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.15s; }
    .task-item .play-btn:hover { background:#16a34a; transform:scale(1.1); }
    /* Meeting reminder bar (idle, Edge+calendar only) */
    .meeting-bar { position:fixed; bottom:0; left:0; right:0; pointer-events:auto; background:linear-gradient(135deg,#1e1b4b,#312e81); border-top:2px solid #6366f1; box-shadow:0 -4px 24px rgba(99,102,241,0.25); display:none; z-index:2147483646; animation:barSlideUp 0.25s ease; }
    .meeting-bar.visible { display:block; }
    .meeting-row { display:flex; align-items:center; padding:10px 24px; gap:14px; }
    .meeting-badge { background:#6366f1; color:#fff; font-size:10px; font-weight:700; padding:3px 8px; border-radius:10px; flex-shrink:0; white-space:nowrap; }
    .meeting-info { flex:1; overflow:hidden; }
    .meeting-title { font-size:13px; font-weight:600; color:#e0e7ff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .meeting-meta { font-size:10px; color:#a5b4fc; margin-top:1px; }
    .meeting-link-btn { background:#6366f1; color:#fff; border:none; border-radius:8px; padding:7px 14px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; flex-shrink:0; transition:all 0.15s; }
    .meeting-link-btn:hover { background:#4f46e5; transform:scale(1.03); }
    .meeting-dismiss { background:none; border:1px solid #4338ca; border-radius:6px; color:#a5b4fc; font-size:12px; padding:5px 10px; cursor:pointer; flex-shrink:0; transition:all 0.15s; }
    .meeting-dismiss:hover { border-color:#6366f1; color:#e0e7ff; }
    /* Task picker inside meeting bar */
    .meeting-picker { display:none; padding:8px 24px 12px; border-top:1px solid #3730a3; }
    .meeting-picker.open { display:block; }
    .meeting-picker-label { font-size:10px; font-weight:700; color:#a5b4fc; text-transform:uppercase; margin-bottom:6px; }
    .meeting-picker-list { display:flex; flex-wrap:wrap; gap:6px; max-height:80px; overflow-y:auto; }
    .mpk-item { background:#1e1b4b; border:1px solid #4338ca; border-radius:8px; padding:5px 10px; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; gap:6px; }
    .mpk-item:hover { background:#312e81; border-color:#6366f1; }
    .mpk-key { font-size:10px; font-weight:700; color:#818cf8; }
    .mpk-sum { font-size:11px; color:#c7d2fe; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  `;
  shadow.appendChild(style);

  // ── DOM ──────────────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="bubble" id="bubble">
      <div class="pill-idle" id="pill-idle"><span class="icon">⏱️</span></div>
    </div>

    <div class="bottom-bar" id="bottom-bar">
      <div class="bar-timer" id="bar-timer">
        <button class="collapse-btn" id="collapse-btn" title="Collapse">«</button>
        <span class="pulse-dot"></span>
        <span class="timer-text" id="timer-display">00:00:00</span>
        <span class="divider"></span>
        <div class="bar-task-info">
          <span class="task-key" id="active-key"></span>
          <span class="task-summary" id="active-summary"></span>
          <span class="epic-badge" id="active-epic" style="display:none">⚡ <span id="active-epic-text"></span></span>
        </div>
        <div class="bar-actions">
          <button class="stop-btn" id="stop-btn">⏹ Stop</button>
        </div>
      </div>
      <div class="bar-log" id="bar-log">
        <span class="log-issue" id="log-issue-key"></span>
        <input type="text" id="log-time" placeholder="1h 30m" />
        <textarea id="log-desc" placeholder="What did you work on?"></textarea>
        <button class="btn-discard" id="btn-discard">Discard</button>
        <button class="btn-log" id="btn-log">✨ Log It!</button>
        <span class="log-status" id="log-status"></span>
      </div>
    </div>

    <div class="panel" id="panel">
      <div class="panel-header">
        <h3>🎯 My Tasks</h3>
        <button class="close-btn" id="panel-close">×</button>
      </div>
      <div class="task-list" id="task-list"><div class="loading">Loading tasks...</div></div>
    </div>

    <div class="meeting-bar" id="meeting-bar">
      <div class="meeting-row">
        <span class="meeting-badge" id="meeting-badge">📅 In 15m</span>
        <div class="meeting-info">
          <div class="meeting-title" id="meeting-title"></div>
          <div class="meeting-meta" id="meeting-meta"></div>
        </div>
        <button class="meeting-link-btn" id="meeting-link-btn">▶ Link &amp; Start</button>
        <button class="meeting-dismiss" id="meeting-dismiss">× Dismiss</button>
      </div>
      <div class="meeting-picker" id="meeting-picker">
        <div class="meeting-picker-label">Pick a Jira task to track</div>
        <div class="meeting-picker-list" id="meeting-picker-list"></div>
      </div>
    </div>
  `;
  shadow.appendChild(container);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const bubble = shadow.getElementById('bubble');
  const pillIdle = shadow.getElementById('pill-idle');
  const bottomBar = shadow.getElementById('bottom-bar');
  const barTimer = shadow.getElementById('bar-timer');
  const barLog = shadow.getElementById('bar-log');
  const timerDisplay = shadow.getElementById('timer-display');
  const activeKeyEl = shadow.getElementById('active-key');
  const activeSummaryEl = shadow.getElementById('active-summary');
  const activeEpicEl = shadow.getElementById('active-epic');
  const activeEpicText = shadow.getElementById('active-epic-text');
  const stopBtn = shadow.getElementById('stop-btn');
  const panel = shadow.getElementById('panel');
  const panelClose = shadow.getElementById('panel-close');
  const taskList = shadow.getElementById('task-list');
  const logIssueKey = shadow.getElementById('log-issue-key');
  const logTime = shadow.getElementById('log-time');
  const logDesc = shadow.getElementById('log-desc');
  const btnDiscard = shadow.getElementById('btn-discard');
  const btnLog = shadow.getElementById('btn-log');
  const logStatus = shadow.getElementById('log-status');

  const meetingBar = shadow.getElementById('meeting-bar');
  const meetingBadge = shadow.getElementById('meeting-badge');
  const meetingTitle = shadow.getElementById('meeting-title');
  const meetingMeta = shadow.getElementById('meeting-meta');
  const meetingLinkBtn = shadow.getElementById('meeting-link-btn');
  const meetingDismiss = shadow.getElementById('meeting-dismiss');
  const meetingPicker = shadow.getElementById('meeting-picker');
  const meetingPickerList = shadow.getElementById('meeting-picker-list');

  // cached jira issues for meeting picker (populated by loadTasks)
  let cachedIssues = [];
  let dismissedMeetings = new Set(); // track dismissed event ids
  let meetingCheckInterval = null;
  let activeMeetingEvent = null;
  let timerInterval = null;
  let currentTimer = null;
  let stopData = null;

  // ── Helpers ──────────────────────────────────────────────────────────────
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
    return `${m || 1}m`;
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
      if (!isNaN(num)) total = num * 60;
    }
    return total;
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function getJiraBaseUrl() {
    return new Promise(r => {
      if (!isExtensionValid()) { r('https://teneritycloud.atlassian.net'); return; }
      chrome.storage.local.get('jtp-tracker-jira-base', (res) => {
        r(res['jtp-tracker-jira-base'] || 'https://teneritycloud.atlassian.net');
      });
    });
  }

  // Route all Jira API calls through background service worker (avoids CORS)
  function jiraFetch(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      if (!isExtensionValid()) { reject(new Error('Extension invalid')); return; }
      chrome.runtime.sendMessage({ type: 'JTP_JIRA_FETCH', url, method, body }, (res) => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        if (!res || !res.ok) { reject(new Error(res?.error || 'Fetch failed')); return; }
        resolve(res.data);
      });
    });
  }

  // ── State transitions ───────────────────────────────────────────────────
  function showRunning(timer) {
    bubble.style.display = 'none';
    panel.classList.remove('open');
    barLog.classList.remove('visible');
    meetingBar.classList.remove('visible'); // hide meeting reminder when timer active
    bottomBar.classList.add('visible');
    barTimer.style.display = 'flex';
    activeKeyEl.textContent = timer.issueKey;
    activeSummaryEl.textContent = timer.summary || '';
    if (timer.epicKey) {
      activeEpicEl.style.display = 'inline-flex';
      activeEpicText.textContent = `${timer.epicKey}${timer.epicSummary ? ' — ' + timer.epicSummary : ''}`;
    } else {
      activeEpicEl.style.display = 'none';
    }
    currentTimer = timer;
    startTickDisplay();
  }

  function showIdle() {
    bottomBar.classList.remove('visible');
    barLog.classList.remove('visible');
    bubble.style.display = 'block';
    currentTimer = null;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    // Re-check meeting bar when returning to idle
    if (flags.calendar && navigator.userAgent.includes('Edg/')) checkUpcomingMeetings();
  }

  function showLogForm(data) {
    barTimer.style.display = 'none';
    barLog.classList.add('visible');
    logIssueKey.textContent = data.issueKey;
    logTime.value = formatForInput(data.elapsed);
    logDesc.value = data.meetingTitle || '';
    logStatus.textContent = '';
    logStatus.className = 'log-status';
  }

  function startTickDisplay() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!currentTimer) return;
      const elapsed = Math.floor((Date.now() - currentTimer.startTime) / 1000);
      timerDisplay.textContent = formatElapsed(elapsed);
    }, 1000);
  }

  // ── Init state ──────────────────────────────────────────────────────────
  if (isExtensionValid()) {
    chrome.runtime.sendMessage({ type: 'JTP_TIMER_STATUS' }, (timer) => {
      if (chrome.runtime.lastError) return;
      if (timer && timer.running) showRunning(timer);
      else {
        showIdle();
        if (flags.calendar && navigator.userAgent.includes('Edg/')) startMeetingCheck();
      }
    });

    // Keep all tabs in sync — react to storage changes made by other tabs
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes['jtp-tracker-timer']) return;
      const timer = changes['jtp-tracker-timer'].newValue;
      if (!timer) {
        showIdle();
        if (flags.calendar && navigator.userAgent.includes('Edg/')) startMeetingCheck();
      } else if (timer.running) {
        showRunning(timer);
      } else if (!timer.running && timer.elapsed != null) {
        // Another tab stopped the timer — show log form
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        currentTimer = null;
        stopData = timer;
        showLogForm(timer);
      }
    });
  }

  // ── Restore position ─────────────────────────────────────────────────────
  const savedPos = config['jtp-tracker-position'];
  if (savedPos) {
    bubble.style.bottom = savedPos.bottom;
    bubble.style.right = savedPos.right;
    bubble.style.left = 'auto';
    bubble.style.top = 'auto';
  }

  // ── Draggable bubble ────────────────────────────────────────────────────
  let isDragging = false;
  let dragStartX, dragStartY, bubbleStartX, bubbleStartY;
  let hasMoved = false;

  bubble.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    hasMoved = false;
    bubble.classList.add('dragging');
    const rect = bubble.getBoundingClientRect();
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    bubbleStartX = rect.left;
    bubbleStartY = rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved = true;
    const newX = bubbleStartX + dx;
    const newY = bubbleStartY + dy;
    const maxX = window.innerWidth - 60;
    const maxY = window.innerHeight - 60;
    const clampedX = Math.max(0, Math.min(newX, maxX));
    const clampedY = Math.max(0, Math.min(newY, maxY));
    bubble.style.left = clampedX + 'px';
    bubble.style.top = clampedY + 'px';
    bubble.style.right = 'auto';
    bubble.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    bubble.classList.remove('dragging');
    // Save position
    const rect = bubble.getBoundingClientRect();
    const pos = {
      bottom: (window.innerHeight - rect.bottom) + 'px',
      right: (window.innerWidth - rect.right) + 'px',
    };
    bubble.style.left = 'auto';
    bubble.style.top = 'auto';
    bubble.style.bottom = pos.bottom;
    bubble.style.right = pos.right;
    if (isExtensionValid()) {
      chrome.storage.local.set({ 'jtp-tracker-position': pos });
    }
  });

  // ── Bubble click → panel (only if not dragged) ──────────────────────────
  pillIdle.addEventListener('click', () => {
    if (hasMoved) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) loadTasks();
  });

  panelClose.addEventListener('click', () => panel.classList.remove('open'));

  // ── Collapse toggle ───────────────────────────────────────────────────
  const collapseBtn = shadow.getElementById('collapse-btn');
  collapseBtn.addEventListener('click', () => {
    const collapsed = bottomBar.classList.toggle('collapsed');
    collapseBtn.textContent = collapsed ? '»' : '«';
    collapseBtn.title = collapsed ? 'Expand' : 'Collapse';
  });

  // ── Stop → show log form in bar ─────────────────────────────────────────
  stopBtn.addEventListener('click', () => {
    if (!isExtensionValid()) return;
    // Expand bar if collapsed before showing log form
    if (bottomBar.classList.contains('collapsed')) {
      bottomBar.classList.remove('collapsed');
      collapseBtn.textContent = '«';
      collapseBtn.title = 'Collapse';
    }
    chrome.runtime.sendMessage({ type: 'JTP_TIMER_STOP' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.ok) return;
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      currentTimer = null;
      stopData = res;
      showLogForm(res);
    });
  });

  // ── Log actions ─────────────────────────────────────────────────────────
  btnDiscard.addEventListener('click', () => {
    if (isExtensionValid()) chrome.runtime.sendMessage({ type: 'JTP_TIMER_CLEAR' });
    stopData = null;
    showIdle();
  });

  btnLog.addEventListener('click', async () => {
    if (!stopData || !TEMPO_TOKEN) {
      logStatus.textContent = '⚠️ No token';
      logStatus.className = 'log-status error';
      return;
    }

    btnLog.disabled = true;
    logStatus.textContent = '⏳';
    logStatus.className = 'log-status';

    try {
      const timeSeconds = parseTimeInput(logTime.value);
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
          token: TEMPO_TOKEN,
          payload: {
            issueId,
            timeSpentSeconds: timeSeconds,
            startDate: dateStr,
            startTime: timeStr,
            description: logDesc.value || '',
            authorAccountId: user.accountId,
          }
        }, r);
      });

      if (!tempoRes || !tempoRes.ok) throw new Error(tempoRes?.error || 'Failed');

      logStatus.textContent = '✅ Logged!';
      logStatus.className = 'log-status success';
      if (isExtensionValid()) chrome.runtime.sendMessage({ type: 'JTP_TIMER_CLEAR' });
      trackTimerLog();
      setTimeout(() => { stopData = null; showIdle(); }, 1200);
    } catch (e) {
      logStatus.textContent = `❌ ${e.message}`;
      logStatus.className = 'log-status error';
    } finally {
      btnLog.disabled = false;
    }
  });

  // ── Load Tasks ──────────────────────────────────────────────────────────
  async function loadTasks() {
    taskList.innerHTML = '<div class="loading">⏳ Loading tasks...</div>';
    try {
      const jiraBase = await getJiraBaseUrl();
      const data = await jiraFetch(`${jiraBase}/rest/api/3/search/jql`, 'POST', { jql: JQL_FILTER, maxResults: 10, fields: ['summary', 'parent'] });
      const issues = data.issues || [];
      cachedIssues = issues;

      if (!issues.length) {
        taskList.innerHTML = '<div class="empty-state">😴 No tasks match your filter</div>';
      } else {
        taskList.innerHTML = issues.map(i => {
          const parent = i.fields.parent;
          const epicInfo = parent ? `${parent.key} — ${parent.fields?.summary || ''}` : '';
          return `
            <div class="task-item" data-key="${i.key}" data-summary="${esc(i.fields.summary)}" data-epic-key="${parent?.key || ''}" data-epic-summary="${esc(parent?.fields?.summary || '')}">
              <div class="task-info">
                <div class="task-key">${i.key}</div>
                <div class="task-summary">${esc(i.fields.summary)}</div>
                ${epicInfo ? `<div class="task-epic">⚡ ${esc(epicInfo)}</div>` : ''}
              </div>
              <button class="play-btn">▶</button>
            </div>
          `;
        }).join('');

        taskList.querySelectorAll('.play-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('.task-item');
            startTimer(item.dataset.key, item.dataset.summary, item.dataset.epicKey, item.dataset.epicSummary);
          });
        });
      }
    } catch (e) {
      taskList.innerHTML = `<div class="empty-state">❌ Failed: ${e.message}</div>`;
    }

    // Cache issues for meeting picker and start meeting check (Edge+calendar only)
    if (flags.calendar && navigator.userAgent.includes('Edg/')) startMeetingCheck();
  }

  // ── Meeting reminder in footer bar ─────────────────────────────────────
  // Polls every minute; shows bar when a meeting starts within 15 minutes.
  function startMeetingCheck() {
    if (meetingCheckInterval) return; // already running
    fetchAndCheckMeetings();
    meetingCheckInterval = setInterval(fetchAndCheckMeetings, 60000);
  }

  let cachedCalEvents = [];
  let lastCalFetch = 0;

  function fetchAndCheckMeetings() {
    const now = new Date();
    // Re-fetch calendar at most once per 10 minutes
    if (now - lastCalFetch > 10 * 60 * 1000) {
      lastCalFetch = now.getTime();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      const url = `https://outlook.office.com/api/v2.0/me/calendarview?startDateTime=${startOfDay}&endDateTime=${endOfDay}&$orderby=start/dateTime&$top=20`;
      chrome.runtime.sendMessage({ type: 'JTP_CALENDAR_FETCH', url }, (res) => {
        if (res?.ok) {
          cachedCalEvents = res.data.value || [];
          checkUpcomingMeetings();
        }
      });
    } else {
      checkUpcomingMeetings();
    }
  }

  function checkUpcomingMeetings() {
    if (currentTimer) return; // don't show while timer is running
    const now = new Date();
    const in15 = new Date(now.getTime() + 15 * 60 * 1000);

    // Find the next meeting starting within 15 min (or currently happening)
    const next = cachedCalEvents.find(ev => {
      const startRaw = ev.Start?.DateTime || ev.start?.dateTime || '';
      const endRaw = ev.End?.DateTime || ev.end?.dateTime || '';
      const start = new Date(startRaw.endsWith('Z') ? startRaw : startRaw + 'Z');
      const end = new Date(endRaw.endsWith('Z') ? endRaw : endRaw + 'Z');
      const id = startRaw + (ev.Subject || ev.subject || '');
      return end > now && start <= in15 && !dismissedMeetings.has(id);
    });

    if (!next) {
      meetingBar.classList.remove('visible');
      activeMeetingEvent = null;
      return;
    }

    const startRaw = next.Start?.DateTime || next.start?.dateTime || '';
    const start = new Date(startRaw.endsWith('Z') ? startRaw : startRaw + 'Z');
    const subject = next.Subject || next.subject || '(No subject)';
    const minsUntil = Math.round((start - now) / 60000);
    const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isNow = start <= now;

    activeMeetingEvent = next;
    meetingTitle.textContent = subject;
    meetingMeta.textContent = `${timeStr} · ${isNow ? 'Happening now' : `Starts in ${minsUntil}m`}`;
    meetingBadge.textContent = isNow ? '\uD83D\uDFE2 Now' : `\uD83D\uDCC5 In ${minsUntil}m`;
    meetingBar.classList.add('visible');

    // Populate task picker
    meetingPickerList.innerHTML = cachedIssues.length
      ? cachedIssues.map(i => `
          <div class="mpk-item"
            data-key="${i.key}"
            data-summary="${esc(i.fields.summary)}"
            data-epic-key="${i.fields.parent?.key || ''}"
            data-epic-summary="${esc(i.fields.parent?.fields?.summary || '')}"
            data-meeting="${esc(subject)}">
            <span class="mpk-key">${i.key}</span>
            <span class="mpk-sum">${esc(i.fields.summary)}</span>
          </div>`).join('')
      : '<span style="font-size:11px;color:#a5b4fc">Open widget first to load tasks</span>';

    meetingPickerList.querySelectorAll('.mpk-item').forEach(item => {
      item.addEventListener('click', () => {
        startTimer(item.dataset.key, item.dataset.summary, item.dataset.epicKey, item.dataset.epicSummary, item.dataset.meeting);
        meetingPicker.classList.remove('open');
      });
    });
  }

  meetingLinkBtn.addEventListener('click', () => {
    meetingPicker.classList.toggle('open');
  });

  meetingDismiss.addEventListener('click', () => {
    if (activeMeetingEvent) {
      const startRaw = activeMeetingEvent.Start?.DateTime || activeMeetingEvent.start?.dateTime || '';
      const subject = activeMeetingEvent.Subject || activeMeetingEvent.subject || '';
      dismissedMeetings.add(startRaw + subject);
    }
    meetingBar.classList.remove('visible');
    meetingPicker.classList.remove('open');
    activeMeetingEvent = null;
  });


  function startTimer(issueKey, summary, epicKey, epicSummary, meetingTitle = '') {
    if (!isExtensionValid()) return;
    chrome.runtime.sendMessage({ type: 'JTP_TIMER_START', issueKey, summary, epicKey, epicSummary, meetingTitle }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.ok) {
        panel.classList.remove('open');
        showRunning({ issueKey, summary, epicKey, epicSummary, meetingTitle, startTime: Date.now(), running: true });
      }
    });
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
})();

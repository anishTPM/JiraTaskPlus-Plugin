// ── Tracker Widget Orchestrator ─────────────────────────────────────────────
// Entry point. Wires together modular controllers following SOLID principles.
// S: Each module has one job. D: Orchestrator injects shared refs into controllers.

import { RAIL_CSS } from './widget/rail-styles.js';
import { RAIL_HTML } from './widget/rail-dom.js';
import { isExtensionValid, fetchTasks, getRecentTasks, pushRecentTask } from './widget/task-service.js';
import { createTimerController } from './widget/timer-controller.js';
import { createMeetingController } from './widget/meeting-controller.js';
import { createLogController } from './widget/log-controller.js';

(async function () {
  if (!isExtensionValid()) return;

  const flags = await new Promise(r => chrome.storage.local.get('jtp-features', res => r(res['jtp-features'] || {})));
  if (!flags.tracker) return;

  const config = await new Promise(r => chrome.storage.local.get(['jtp-tracker-jql', 'jtp-tempo-token', 'jtp-pill-style', 'jtp-rail-theme'], res => r(res)));
  const TEMPO_TOKEN = config['jtp-tempo-token'] || '';
  const JQL_FILTER = config['jtp-tracker-jql'] || 'assignee = currentUser() AND sprint in openSprints() AND statusCategory != Done';
  const PILL_STYLE = config['jtp-pill-style'] || 'default';
  let isLight = config['jtp-rail-theme'] === 'light';

  // ── Shadow DOM Setup ────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'jtp-tracker-host';
  host.style.cssText = 'position:fixed; z-index:2147483647; top:0; left:0; width:0; height:0; pointer-events:none;';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = RAIL_CSS;
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.innerHTML = RAIL_HTML;
  shadow.appendChild(container);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const refs = {
    rail: shadow.getElementById('rail'),
    railBrand: shadow.getElementById('rail-brand'),
    railIdle: shadow.getElementById('rail-idle'),
    railTimer: shadow.getElementById('rail-timer'),
    timerDisplay: shadow.getElementById('timer-display'),
    activeKey: shadow.getElementById('active-key'),
    activeSummary: shadow.getElementById('active-summary'),
    activeEpic: shadow.getElementById('active-epic'),
    activeEpicText: shadow.getElementById('active-epic-text'),
    activeEstimate: shadow.getElementById('active-estimate'),
    stopBtn: shadow.getElementById('stop-btn'),
    barLog: shadow.getElementById('bar-log'),
    logIssueKey: shadow.getElementById('log-issue-key'),
    logTime: shadow.getElementById('log-time'),
    logDesc: shadow.getElementById('log-desc'),
    btnDiscard: shadow.getElementById('btn-discard'),
    btnLog: shadow.getElementById('btn-log'),
    logStatus: shadow.getElementById('log-status'),
    taskRow: shadow.getElementById('task-row'),
    taskSearch: shadow.getElementById('task-search'),
    taskList: shadow.getElementById('task-list'),
    meetingChip: shadow.getElementById('meeting-chip'),
    meetingBadge: shadow.getElementById('meeting-badge'),
    meetingTitle: shadow.getElementById('meeting-title'),
    meetingLinkBtn: shadow.getElementById('meeting-link-btn'),
    meetingDismiss: shadow.getElementById('meeting-dismiss'),
    railHide: shadow.getElementById('rail-hide'),
    railTheme: shadow.getElementById('rail-theme'),
    miniPill: shadow.getElementById('mini-pill'),
    miniTimer: shadow.getElementById('mini-timer'),
    miniWeek: shadow.getElementById('mini-week'),
    activeDesc: shadow.getElementById('active-desc'),
    descDivider: shadow.getElementById('desc-divider'),
    logToast: shadow.getElementById('log-toast'),
  };

  // Apply pill style
  if (PILL_STYLE && PILL_STYLE !== 'default') refs.miniPill.classList.add(`pill-${PILL_STYLE}`);

  // ── Theme ─────────────────────────────────────────────────────────────────
  function applyTheme(light) {
    refs.rail.classList.toggle('light', light);
    refs.miniPill.classList.toggle('light', light);
    if (refs.logToast) refs.logToast.classList.toggle('light', light);
    refs.railTheme.textContent = light ? '\ud83c\udf19' : '\u2600\ufe0f';
    refs.railTheme.title = light ? 'Switch to dark mode' : 'Switch to light mode';
  }
  applyTheme(isLight);
  refs.railTheme.addEventListener('click', () => {
    isLight = !isLight;
    applyTheme(isLight);
    chrome.storage.local.set({ 'jtp-rail-theme': isLight ? 'light' : 'dark' });
  });

  // ── Initialize Controllers ──────────────────────────────────────────────
  const timerCtrl = createTimerController(refs);
  const logCtrl = createLogController(refs, timerCtrl, TEMPO_TOKEN, showLogToast);

  function showLogToast() {
    refs.logToast.classList.add('visible');
    setTimeout(() => refs.logToast.classList.remove('visible'), 2000);
    loadWeeklyTime(); // refresh weekly total
  }

  // Fetch weekly logged time
  async function loadWeeklyTime() {
    if (!TEMPO_TOKEN) { refs.miniWeek.textContent = '—'; return; }
    try {
      const now = new Date();
      const day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0,0,0,0);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const from = mon.toISOString().split('T')[0];
      const to = sun.toISOString().split('T')[0];
      const res = await new Promise(r => chrome.runtime.sendMessage({ type: 'JTP_TEMPO_WEEKLY', token: TEMPO_TOKEN, from, to }, r));
      if (res && res.ok) {
        const secs = res.totalSeconds || 0;
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        refs.miniWeek.textContent = `${h}h${m > 0 ? ` ${m}m` : ''} this week`;
      } else {
        refs.miniWeek.textContent = '—';
      }
    } catch { refs.miniWeek.textContent = '—'; }
  }
  loadWeeklyTime();
  let pendingMeetingLink = null;
  const meetingCtrl = createMeetingController(refs, timerCtrl);

  // ── Wire timer state changes ────────────────────────────────────────────
  timerCtrl.onStateChange = (state, data) => {
    if (state === 'running') {
      refs.meetingChip.classList.add('compact');
      // When timer starts, always show the rail so user sees it
      refs.miniPill.classList.remove('visible');
      refs.rail.classList.remove('hidden');
      // Show remaining/estimate if available
      const issue = allIssues.find(i => i.key === data?.issueKey);
      const tt = issue?.fields?.timetracking;
      if (tt && tt.originalEstimateSeconds) {
        const est = formatHours(tt.originalEstimateSeconds);
        const rem = formatHours(tt.remainingEstimateSeconds || 0);
        refs.activeEstimate.textContent = `(${rem} / ${est})`;
        refs.activeEstimate.style.display = 'inline';
      } else {
        refs.activeEstimate.style.display = 'none';
      }
    } else if (state === 'idle') {
      refs.meetingChip.classList.remove('compact');
      refs.activeEstimate.style.display = 'none';
      if (flags.calendar && navigator.userAgent.includes('Edg/')) meetingCtrl.checkUpcoming();
    } else if (state === 'stopped') {
      logCtrl.setStopData(data);
    }
  };

  function formatHours(seconds) {
    if (!seconds) return '0h';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  // ── Event Bindings ──────────────────────────────────────────────────────

  // Brand click → toggle inline task row
  refs.railBrand.addEventListener('click', () => {
    const isOpen = refs.taskRow.classList.toggle('visible');
    refs.railBrand.classList.toggle('active', isOpen);
    if (isOpen) loadTasks();
  });

  // Stop button
  refs.stopBtn.addEventListener('click', () => timerCtrl.stopTimer());

  // Log actions
  refs.btnLog.addEventListener('click', () => logCtrl.submitLog());
  refs.btnDiscard.addEventListener('click', () => logCtrl.discard());

  // Meeting chip — Link opens task row for linking (deferred start at meeting time)
  let pendingMeetingStartTime = null;
  refs.meetingLinkBtn.addEventListener('click', () => {
    pendingMeetingLink = refs.meetingTitle.textContent || '';
    pendingMeetingStartTime = meetingCtrl.getActiveMeetingStart();
    refs.taskRow.classList.add('visible');
    refs.railBrand.classList.add('active');
    loadTasks();
  });
  refs.meetingDismiss.addEventListener('click', () => meetingCtrl.dismiss());

  // Rail hide → mini pill
  refs.railHide.addEventListener('click', () => {
    refs.rail.classList.add('hidden');
    refs.miniPill.classList.add('visible');
  });
  refs.miniPill.addEventListener('click', () => {
    refs.miniPill.classList.remove('visible');
    refs.rail.classList.remove('hidden');
  });

  // ── Cross-tab Sync ──────────────────────────────────────────────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    timerCtrl.handleStorageChange(changes, area);
  });

  // ── Task Loading (search-first, recent-aware) ───────────────────────────
  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  let allIssues = [];
  let recentTasks = [];

  function renderChips(issues, recentKeys) {
    if (!issues.length) {
      refs.taskList.innerHTML = '<span class="task-row-msg">No matches</span>';
      return;
    }
    refs.taskList.innerHTML = issues.map(i => {
      const parent = i.fields?.parent || null;
      const key = i.key;
      const summary = i.fields?.summary || i.summary || '';
      const epicName = parent?.fields?.summary || i.epicSummary || '';
      const epicLabel = epicName ? `(${epicName.length > 22 ? epicName.slice(0, 22) + '\u2026' : epicName})` : '';
      const status = i.fields?.status?.name || '';
      const isRecent = recentKeys.has(key);
      return `
        <div class="task-chip${isRecent ? ' recent' : ''}" data-key="${key}" data-summary="${esc(summary)}" data-epic-key="${parent?.key || i.epicKey || ''}" data-epic-summary="${esc(epicName)}">
          <div class="chip-info">
            <div class="chip-key">${key}${status ? ` <span class="chip-status">${esc(status)}</span>` : ''}</div>
            <div class="chip-summary">${esc(summary)}</div>
            ${epicLabel ? `<div class="chip-epic">${esc(epicLabel)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    refs.taskList.querySelectorAll('.task-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const meetingTitle = pendingMeetingLink || '';
        const meetingStart = pendingMeetingStartTime;
        pendingMeetingLink = null;
        pendingMeetingStartTime = null;
        const key = chip.dataset.key;
        const summary = chip.dataset.summary;
        const epicKey = chip.dataset.epicKey;
        const epicSummary = chip.dataset.epicSummary;
        pushRecentTask({ key, summary, epicKey, epicSummary });

        // If linked from a meeting, always schedule — auto-starts at meeting time
        if (meetingTitle && meetingStart) {
          meetingCtrl.scheduleLink({ key, summary, epicKey, epicSummary, meetingTitle, startTime: meetingStart });
          refs.meetingLinkBtn.textContent = `\u2705 Linked to ${key}`;
          refs.meetingBadge.textContent = '\u2705 Linked';
        } else {
          timerCtrl.startTimer(key, summary, epicKey, epicSummary, meetingTitle);
        }

        refs.taskRow.classList.remove('visible');
        refs.railBrand.classList.remove('active');
        refs.taskSearch.value = '';
      });
    });
  }

  function filterAndRender(query) {
    const q = query.toLowerCase().trim();
    const recentKeys = new Set(recentTasks.map(r => r.key));

    if (!q) {
      // Show recent first, then fill remaining up to 8
      const recentIssues = recentTasks
        .map(r => allIssues.find(i => i.key === r.key) || { key: r.key, fields: { summary: r.summary, parent: r.epicKey ? { key: r.epicKey, fields: { summary: r.epicSummary } } : null }, epicKey: r.epicKey, epicSummary: r.epicSummary })
        .filter(Boolean);
      const rest = allIssues.filter(i => !recentKeys.has(i.key)).slice(0, 8 - recentIssues.length);
      renderChips([...recentIssues, ...rest], recentKeys);
    } else {
      const filtered = allIssues.filter(i => {
        const k = i.key.toLowerCase();
        const s = (i.fields?.summary || '').toLowerCase();
        return k.includes(q) || s.includes(q);
      }).slice(0, 10);
      renderChips(filtered, recentKeys);
    }
  }

  async function loadTasks() {
    recentTasks = await getRecentTasks();
    const recentKeys = new Set(recentTasks.map(r => r.key));

    // Show recent instantly while API loads
    if (recentTasks.length && !allIssues.length) {
      const recentAsIssues = recentTasks.map(r => ({ key: r.key, fields: { summary: r.summary, parent: r.epicKey ? { key: r.epicKey, fields: { summary: r.epicSummary } } : null }, epicKey: r.epicKey, epicSummary: r.epicSummary }));
      renderChips(recentAsIssues, recentKeys);
    }

    // Fetch from API once, then cache
    if (!allIssues.length) {
      if (!recentTasks.length) refs.taskList.innerHTML = '<span class="task-row-msg">\u23f3 Loading...</span>';
      try {
        allIssues = await fetchTasks(JQL_FILTER);
      } catch (e) {
        if (!recentTasks.length) refs.taskList.innerHTML = `<span class="task-row-msg">\u274c ${e.message}</span>`;
        return;
      }
    }

    filterAndRender(refs.taskSearch.value);
    refs.taskSearch.focus();
  }

  // Search — filter on every keystroke
  refs.taskSearch.addEventListener('input', () => {
    filterAndRender(refs.taskSearch.value);
  });

  // Prevent host page shortcuts from firing when typing in our inputs
  ['keydown', 'keyup', 'keypress'].forEach(evt => {
    refs.taskSearch.addEventListener(evt, e => e.stopPropagation());
    refs.logDesc.addEventListener(evt, e => e.stopPropagation());
    refs.logTime.addEventListener(evt, e => e.stopPropagation());
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  // Start collapsed — show mini-pill by default
  refs.rail.classList.add('hidden');
  refs.miniPill.classList.add('visible');

  if (flags.calendar && navigator.userAgent.includes('Edg/')) meetingCtrl.start();
  timerCtrl.checkInitialState();
})();

// ── Tracker Widget Orchestrator ─────────────────────────────────────────────
// Entry point. Wires together modular controllers following SOLID principles.
// S: Each module has one job. D: Orchestrator injects shared refs into controllers.

import { RAIL_CSS } from './widget/rail-styles.js';
import { RAIL_HTML } from './widget/rail-dom.js';
import { isExtensionValid, fetchTasks } from './widget/task-service.js';
import { createTimerController } from './widget/timer-controller.js';
import { createMeetingController } from './widget/meeting-controller.js';
import { createLogController } from './widget/log-controller.js';

(async function () {
  if (!isExtensionValid()) return;

  const flags = await new Promise(r => chrome.storage.local.get('jtp-features', res => r(res['jtp-features'] || {})));
  if (!flags.tracker) return;

  const config = await new Promise(r => chrome.storage.local.get(['jtp-tracker-jql', 'jtp-tempo-token'], res => r(res)));
  const TEMPO_TOKEN = config['jtp-tempo-token'] || '';
  const JQL_FILTER = config['jtp-tracker-jql'] || 'assignee = currentUser() AND sprint in openSprints() AND statusCategory != Done';

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
    stopBtn: shadow.getElementById('stop-btn'),
    barLog: shadow.getElementById('bar-log'),
    logIssueKey: shadow.getElementById('log-issue-key'),
    logTime: shadow.getElementById('log-time'),
    logDesc: shadow.getElementById('log-desc'),
    btnDiscard: shadow.getElementById('btn-discard'),
    btnLog: shadow.getElementById('btn-log'),
    logStatus: shadow.getElementById('log-status'),
    taskRow: shadow.getElementById('task-row'),
    taskList: shadow.getElementById('task-list'),
    meetingChip: shadow.getElementById('meeting-chip'),
    meetingBadge: shadow.getElementById('meeting-badge'),
    meetingTitle: shadow.getElementById('meeting-title'),
    meetingLinkBtn: shadow.getElementById('meeting-link-btn'),
    meetingDismiss: shadow.getElementById('meeting-dismiss'),
    railHide: shadow.getElementById('rail-hide'),
    miniPill: shadow.getElementById('mini-pill'),
    miniTimer: shadow.getElementById('mini-timer'),
  };

  // ── Initialize Controllers ──────────────────────────────────────────────
  const timerCtrl = createTimerController(refs);
  const logCtrl = createLogController(refs, timerCtrl, TEMPO_TOKEN);

  let cachedIssues = [];
  let pendingMeetingLink = null; // meeting title to link when task is picked
  const meetingCtrl = createMeetingController(refs, timerCtrl);

  // ── Wire timer state changes ────────────────────────────────────────────
  timerCtrl.onStateChange = (state, data) => {
    if (state === 'running') {
      // Keep meeting chip visible but in compact mode (no buttons, just info)
      refs.meetingChip.classList.add('compact');
      refs.miniPill.classList.remove('visible');
      refs.rail.classList.remove('hidden');
    } else if (state === 'idle') {
      refs.meetingChip.classList.remove('compact');
      refs.miniPill.classList.remove('visible');
      refs.rail.classList.remove('hidden');
      if (flags.calendar && navigator.userAgent.includes('Edg/')) meetingCtrl.checkUpcoming();
    } else if (state === 'stopped') {
      logCtrl.setStopData(data);
    }
  };

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

  // Meeting chip actions — Link opens task row for linking
  refs.meetingLinkBtn.addEventListener('click', () => {
    pendingMeetingLink = refs.meetingTitle.textContent || '';
    refs.taskRow.classList.add('visible');
    refs.railBrand.classList.add('active');
    loadTasks();
  });
  refs.meetingDismiss.addEventListener('click', () => meetingCtrl.dismiss());

  // Rail hide → show mini pill
  refs.railHide.addEventListener('click', () => {
    refs.rail.classList.add('hidden');
    refs.miniPill.classList.add('visible');
  });

  // Mini pill → restore rail
  refs.miniPill.addEventListener('click', () => {
    refs.miniPill.classList.remove('visible');
    refs.rail.classList.remove('hidden');
  });

  // ── Cross-tab Sync ──────────────────────────────────────────────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    timerCtrl.handleStorageChange(changes, area);
  });

  // ── Task Loading ────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function loadTasks() {
    refs.taskList.innerHTML = '<span class="task-row-msg">\u23f3 Loading...</span>';
    try {
      const issues = await fetchTasks(JQL_FILTER);
      cachedIssues = issues;

      if (!issues.length) {
        refs.taskList.innerHTML = '<span class="task-row-msg">\ud83d\ude34 No tasks match your filter</span>';
      } else {
        refs.taskList.innerHTML = issues.map(i => {
          const parent = i.fields.parent;
          const epicName = parent?.fields?.summary || '';
          const epicLabel = epicName ? `(${epicName.length > 22 ? epicName.slice(0, 22) + '\u2026' : epicName})` : '';
          return `
            <div class="task-chip" data-key="${i.key}" data-summary="${esc(i.fields.summary)}" data-epic-key="${parent?.key || ''}" data-epic-summary="${esc(parent?.fields?.summary || '')}">
              <div class="chip-info">
                <div class="chip-key">${i.key}</div>
                <div class="chip-summary">${esc(i.fields.summary)}</div>
                ${epicLabel ? `<div class="chip-epic">${esc(epicLabel)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('');

        refs.taskList.querySelectorAll('.task-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const meetingTitle = pendingMeetingLink || '';
            pendingMeetingLink = null;
            timerCtrl.startTimer(chip.dataset.key, chip.dataset.summary, chip.dataset.epicKey, chip.dataset.epicSummary, meetingTitle);
            refs.taskRow.classList.remove('visible');
            refs.railBrand.classList.remove('active');
          });
        });
      }
    } catch (e) {
      refs.taskList.innerHTML = `<span class="task-row-msg">\u274c ${e.message}</span>`;
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  // Start calendar polling first so events are cached before timer state resolves
  if (flags.calendar && navigator.userAgent.includes('Edg/')) meetingCtrl.start();
  timerCtrl.checkInitialState();
})();

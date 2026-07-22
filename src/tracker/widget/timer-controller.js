// Single Responsibility: Timer state machine — start, stop, tick display, state transitions.
// Open/Closed: Exposes onStateChange callback for other modules to react.

import { isExtensionValid } from './task-service.js';

export function createTimerController(refs) {
  let timerInterval = null;
  let currentTimer = null;
  let onStateChange = null; // callback: (state, data) => void

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

  function startTickDisplay() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!currentTimer) return;
      const elapsed = Math.floor((Date.now() - currentTimer.startTime) / 1000);
      refs.timerDisplay.textContent = formatElapsed(elapsed);
      if (refs.miniTimer) refs.miniTimer.textContent = formatElapsed(elapsed);
    }, 1000);
  }

  function showRunning(timer) {
    currentTimer = timer;
    refs.railIdle.style.display = 'none';
    refs.railTimer.classList.add('visible');
    refs.barLog.classList.remove('visible');
    refs.rail.classList.remove('log-open');
    if (refs.taskRow) refs.taskRow.classList.remove('visible');
    if (refs.railBrand) refs.railBrand.classList.remove('active');
    refs.activeKey.textContent = timer.issueKey;
    refs.activeSummary.textContent = timer.summary || '';
    if (timer.epicKey) {
      refs.activeEpic.style.display = 'inline';
      refs.activeEpicText.textContent = `${timer.epicKey}${timer.epicSummary ? ' \u2014 ' + timer.epicSummary : ''}`;
    } else {
      refs.activeEpic.style.display = 'none';
    }
    // Working-on description — inline input, no popup
    if (refs.activeDesc) {
      const desc = timer.workingOn || timer.meetingTitle || '';
      refs.activeDesc.value = desc;
      refs.activeDesc.classList.toggle('has-desc', !!desc);
      if (refs.descDivider) refs.descDivider.style.display = 'inline-block';
      // Remove old listener by replacing with a fresh one via flag
      if (!refs.activeDesc._wired) {
        refs.activeDesc._wired = true;
        refs.activeDesc.addEventListener('input', () => {
          refs.activeDesc.classList.toggle('has-desc', !!refs.activeDesc.value);
        });
        refs.activeDesc.addEventListener('change', () => {
          const val = refs.activeDesc.value.trim();
          if (currentTimer) currentTimer.workingOn = val;
          chrome.storage.local.get('jtp-tracker-timer', (r) => {
            const t = r['jtp-tracker-timer'];
            if (t) chrome.storage.local.set({ 'jtp-tracker-timer': { ...t, workingOn: val } });
          });
        });
        // Stop host page shortcuts while typing
        ['keydown', 'keyup', 'keypress'].forEach(evt =>
          refs.activeDesc.addEventListener(evt, e => e.stopPropagation())
        );
      }
    }
    startTickDisplay();
    if (onStateChange) onStateChange('running', timer);
  }

  function showIdle() {
    currentTimer = null;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    refs.rail.classList.remove('log-open');
    refs.railTimer.classList.remove('visible');
    refs.barLog.classList.remove('visible');
    refs.railIdle.style.display = 'flex';
    if (onStateChange) onStateChange('idle', null);
  }
  function showLogForm(data) {
    currentTimer = null;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    refs.railTimer.classList.remove('visible');
    refs.railIdle.style.display = 'none';
    refs.rail.classList.add('log-open');
    refs.barLog.classList.add('visible');
    refs.logIssueKey.textContent = data.issueKey;
    refs.logTime.value = formatForInput(data.elapsed);
    refs.logDesc.value = data.meetingTitle || (refs.activeDesc ? refs.activeDesc.value : '') || '';
    refs.logStatus.textContent = '';
    refs.logStatus.className = 'log-status';
    if (onStateChange) onStateChange('logging', data);
  }

  function startTimer(issueKey, summary, epicKey, epicSummary, meetingTitle = '') {
    if (!isExtensionValid()) return;
    chrome.runtime.sendMessage({ type: 'JTP_TIMER_START', issueKey, summary, epicKey, epicSummary, meetingTitle }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.ok) {
        showRunning({ issueKey, summary, epicKey, epicSummary, meetingTitle, startTime: Date.now(), running: true });
      }
    });
  }

  function stopTimer() {
    if (!isExtensionValid()) return;
    chrome.runtime.sendMessage({ type: 'JTP_TIMER_STOP' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.ok) return;
      showLogForm(res);
      if (onStateChange) onStateChange('stopped', res);
    });
  }

  function clearTimer() {
    if (isExtensionValid()) chrome.runtime.sendMessage({ type: 'JTP_TIMER_CLEAR' });
    showIdle();
  }

  function checkInitialState() {
    if (!isExtensionValid()) return;
    chrome.runtime.sendMessage({ type: 'JTP_TIMER_STATUS' }, (timer) => {
      if (chrome.runtime.lastError) return;
      if (timer && timer.running) showRunning(timer);
      else showIdle();
    });
  }

  function handleStorageChange(changes, area) {
    if (area !== 'local' || !changes['jtp-tracker-timer']) return;
    const timer = changes['jtp-tracker-timer'].newValue;
    if (!timer) {
      showIdle();
    } else if (timer.running) {
      showRunning(timer);
    } else if (!timer.running && timer.elapsed != null) {
      showLogForm(timer);
    }
  }

  return {
    get current() { return currentTimer; },
    set onStateChange(fn) { onStateChange = fn; },
    showRunning,
    showIdle,
    showLogForm,
    startTimer,
    stopTimer,
    clearTimer,
    checkInitialState,
    handleStorageChange,
    formatElapsed,
  };
}

import ORG_CONFIG from './org-config.js';

const BUTTON_ID = 'jtp-add-tasks-btn';
const ANCHOR_SELECTOR = '[data-testid="issue.watchers.action-button.tooltip--container"]';

function getIssueKeyFromUrl() {
  const match = window.location.pathname.match(/\/browse\/([A-Z]+-\d+)/);
  if (match) return match[1];
  const param = new URLSearchParams(window.location.search).get('selectedIssue');
  return param || null;
}

function createButton(issueKey) {
  const wrap = document.createElement('div');
  wrap.id = BUTTON_ID;
  wrap.style.cssText = 'display: inline-flex; align-items: center;';

  const btn = document.createElement('button');
  btn.style.cssText = `
    padding: 8px 12px;
    background: #f4f5f7;
    color: #42526e;
    border: 1px solid #dfe1e6;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('assets/icon16.png');
  icon.style.cssText = 'width:16px; height:16px;';
  btn.appendChild(icon);
  btn.appendChild(document.createTextNode('Bulk Add'));
  btn.title = 'Bulk create Jira tasks linked to this issue';
  btn.addEventListener('mouseenter', () => { btn.style.background = '#ebecf0'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#f4f5f7'; });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal(issueKey);
  });

  wrap.appendChild(btn);
  return wrap;
}

function injectButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const issueKey = getIssueKeyFromUrl();
  if (!issueKey) return;

  const headerActions = document.getElementById('jira-issue-header-actions');
  if (!headerActions) return false;

  const group = headerActions.querySelector('div[role="group"][aria-label="Action items"]');
  if (!group) return false;

  const btn = createButton(issueKey);
  group.insertBefore(btn, group.firstChild);
  return true;
}

function tryInjectWithRetry(maxAttempts = 20, delay = 200) {
  let attempts = 0;
  const interval = setInterval(() => {
    if (document.getElementById(BUTTON_ID)) {
      clearInterval(interval);
      return;
    }
    attempts++;
    if (injectButton()) {
      clearInterval(interval);
    } else if (attempts >= maxAttempts) {
      clearInterval(interval);
    }
  }, delay);
}

function openModal(issueKey) {
  document.getElementById('jtp-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'jtp-modal-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    z-index: 99999; display: flex; align-items: center; justify-content: center;
  `;

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL(`modal/modal.html?issueKey=${issueKey}`);
  iframe.style.cssText = `
    width: 98vw; max-width: 1400px; height: 90vh;
    border: none; border-radius: 8px; background: #fff;
  `;

  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  window.addEventListener('message', function handler(e) {
    if (e.data === 'jtp-close-modal') {
      overlay.remove();
      window.removeEventListener('message', handler);
    }
  });
}

// ── Focus Mode ────────────────────────────────────────────────────────────
const FOCUS_SELECTORS = [
  '#jira-frontend-header',
  '#atlassian-navigation',
  '[data-testid="navigation-apps.main-nav"]',
  'nav[aria-label="Primary"]',
  '#banner',
].join(', ');

function applyFocusMode(enabled) {
  let style = document.getElementById('jtp-focus-style');
  if (enabled) {
    if (!style) {
      style = document.createElement('style');
      style.id = 'jtp-focus-style';
      document.head.appendChild(style);
    }
    style.textContent = `${FOCUS_SELECTORS} { display: none !important; }`;
  } else {
    style?.remove();
  }
}

chrome.storage.local.get('jtp-focus-mode', (data) => {
  if (data['jtp-focus-mode']) applyFocusMode(true);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'JTP_FOCUS_MODE') applyFocusMode(msg.enabled);
});

// ── Persistent injection ───────────────────────────────────────────────────
// Jira's React re-renders can remove our button. Keep checking and re-inject.
let lastUrl = location.href;

new MutationObserver(() => {
  // Re-inject if button was removed by Jira's React re-render
  if (!document.getElementById(BUTTON_ID)) {
    injectButton();
  }
  // On URL change, reset and retry
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    document.getElementById(BUTTON_ID)?.remove();
    tryInjectWithRetry();
  }
}).observe(document.body, { childList: true, subtree: true });

// Initial inject
tryInjectWithRetry();

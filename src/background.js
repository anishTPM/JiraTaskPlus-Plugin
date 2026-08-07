import { initTrackerBackground, initJiraProxy } from './tracker/tracker-background.js';
import { initCalendarBackground } from './calendar/calendar-background.js';

const FOCUS_KEY = 'jtp-focus-mode';

// ── Feature Flags ─────────────────────────────────────────────────────────
// Calendar listener always active (lightweight proxy, needed by settings page)
initCalendarBackground();

// Jira API proxy is always on — the options page and tracker widget rely on it
// to call Jira/Confluence from a non-Jira origin without CORS issues.
initJiraProxy();

chrome.storage.local.get('jtp-features', (res) => {
  const features = res['jtp-features'] || {};
  if (features.tracker) initTrackerBackground();
});

// ── Register context menu items on install/startup ─────────────────────────
function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'jtp-options',
      title: '⚙️ Options',
      contexts: ['action'],
    });
    chrome.contextMenus.create({
      id: 'jtp-focus',
      title: '🎯 Focus Mode',
      contexts: ['action'],
      type: 'checkbox',
      checked: false,
    });
  });
}

chrome.runtime.onInstalled.addListener(createMenus);
chrome.runtime.onStartup.addListener(createMenus);

// Sync the Focus Mode checkbox state with storage on startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(FOCUS_KEY, (data) => {
    try { chrome.contextMenus.update('jtp-focus', { checked: !!data[FOCUS_KEY] }); } catch (e) {}
  });
});

// ── Handle context menu clicks ─────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'jtp-options') {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/options.html') });
    return;
  }

  if (info.menuItemId === 'jtp-focus') {
    const enabled = info.checked;
    await chrome.storage.local.set({ [FOCUS_KEY]: enabled });
    // Send message to the active Jira tab
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'JTP_FOCUS_MODE', enabled });
    } catch {
      // Tab may not have content script (non-Jira page) — ignore
    }
  }
});

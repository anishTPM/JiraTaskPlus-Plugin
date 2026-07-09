// Calendar relay content script — runs on Outlook pages.
// Bridges window.postMessage from injected scripts to chrome.runtime.sendMessage.
window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.type !== 'JTP_CALENDAR_RELAY') return;
  console.log('[JTP Relay] Forwarding to SW:', e.data.nonce, e.data.result?.ok);
  chrome.runtime.sendMessage(e.data);
});
console.log('[JTP Relay] Calendar relay content script loaded on', location.origin);

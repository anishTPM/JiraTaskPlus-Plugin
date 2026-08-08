import ORG_CONFIG from '../org-config.js';

const TOKEN_KEY = 'jtp-microsoft-oauth';
const GRAPH_CALENDAR_URL = 'https://graph.microsoft.com/v1.0/me/calendarView';
const SCOPES = ['openid', 'profile', 'offline_access', 'Calendars.Read'];

export function initCalendarBackground() {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'JTP_CALENDAR_AUTH_STATUS') {
      getAuthStatus().then(sendResponse).catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }

    if (msg.type === 'JTP_CALENDAR_CONNECT') {
      connectMicrosoft().then(sendResponse).catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }

    if (msg.type === 'JTP_CALENDAR_DISCONNECT') {
      chrome.storage.local.remove(TOKEN_KEY, () => sendResponse({ ok: true }));
      return true;
    }

    if (msg.type === 'JTP_CALENDAR_OPEN') {
      chrome.tabs.create({ url: ORG_CONFIG.OUTLOOK_CALENDAR_URL, active: true }, tab => {
        if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        else sendResponse({ ok: true, tabId: tab.id, url: tab.url });
      });
      return true;
    }

    if (msg.type === 'JTP_CALENDAR_FETCH') {
      const range = parseRange(msg.url, msg.startDateTime, msg.endDateTime);
      fetchCalendar(range.startDateTime, range.endDateTime)
        .then(data => sendResponse({ ok: true, data }))
        .catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });
}

function parseRange(url, startDateTime, endDateTime) {
  if (startDateTime && endDateTime) return { startDateTime, endDateTime };
  try {
    const parsed = new URL(url);
    return {
      startDateTime: parsed.searchParams.get('startDateTime') || undefined,
      endDateTime: parsed.searchParams.get('endDateTime') || undefined,
    };
  } catch (_) {
    return { startDateTime, endDateTime };
  }
}

async function getAuthStatus() {
  const redirectUrl = chrome.identity.getRedirectURL('microsoft');
  const token = await storageGet(TOKEN_KEY);
  return {
    ok: true,
    configured: isClientConfigured(),
    connected: !!token?.refreshToken || isAccessTokenValid(token),
    account: token?.account || '',
    redirectUrl,
  };
}

async function connectMicrosoft() {
  assertConfigured();
  const redirectUrl = chrome.identity.getRedirectURL('microsoft');
  const verifier = createRandomString(64);
  const challenge = await sha256Base64Url(verifier);
  const state = createRandomString(32);
  const tenant = ORG_CONFIG.MICROSOFT_OAUTH_TENANT || 'common';
  const authUrl = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  authUrl.search = new URLSearchParams({
    client_id: ORG_CONFIG.MICROSOFT_OAUTH_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUrl,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();

  const callbackUrl = await launchAuthFlow(authUrl.toString());
  const callback = new URL(callbackUrl);
  if (callback.searchParams.get('state') !== state) throw new Error('Microsoft sign-in state validation failed.');
  const authError = callback.searchParams.get('error_description') || callback.searchParams.get('error');
  if (authError) throw new Error(authError);
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('Microsoft sign-in did not return an authorization code.');

  const token = await exchangeToken({ code, verifier, redirectUrl, tenant });
  await saveToken(token);
  return getAuthStatus();
}

async function fetchCalendar(startDateTime, endDateTime) {
  const accessToken = await getAccessToken();
  const start = startDateTime || startOfToday();
  const end = endDateTime || endOfToday();
  const url = new URL(GRAPH_CALENDAR_URL);
  url.search = new URLSearchParams({
    startDateTime: start,
    endDateTime: end,
    '$orderby': 'start/dateTime',
    '$top': '50',
    '$select': 'subject,start,end,isAllDay,webLink,organizer',
  }).toString();

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  if (response.status === 401) {
    await chrome.storage.local.remove(TOKEN_KEY);
    throw new Error('Microsoft Calendar session expired. Connect Outlook again.');
  }
  if (!response.ok) throw new Error(`Microsoft Graph ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function getAccessToken() {
  assertConfigured();
  let token = await storageGet(TOKEN_KEY);
  if (isAccessTokenValid(token)) return token.accessToken;
  if (!token?.refreshToken) throw new Error('Outlook Calendar is not connected. Click Connect Microsoft Account first.');

  const tenant = ORG_CONFIG.MICROSOFT_OAUTH_TENANT || 'common';
  const body = new URLSearchParams({
    client_id: ORG_CONFIG.MICROSOFT_OAUTH_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
    scope: SCOPES.join(' '),
  });
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok) {
    await chrome.storage.local.remove(TOKEN_KEY);
    throw new Error(data.error_description || 'Microsoft token refresh failed. Connect again.');
  }
  token = await saveToken({ ...data, refresh_token: data.refresh_token || token.refreshToken });
  return token.accessToken;
}

async function exchangeToken({ code, verifier, redirectUrl, tenant }) {
  const body = new URLSearchParams({
    client_id: ORG_CONFIG.MICROSOFT_OAUTH_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUrl,
    code_verifier: verifier,
    scope: SCOPES.join(' '),
  });
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'Microsoft token exchange failed.');
  return data;
}

async function saveToken(data) {
  const token = {
    accessToken: data.access_token || data.accessToken,
    refreshToken: data.refresh_token || data.refreshToken || '',
    expiresAt: Date.now() + Math.max(0, (Number(data.expires_in) || 3600) - 120) * 1000,
    account: parseAccount(data.id_token),
  };
  await storageSet({ [TOKEN_KEY]: token });
  return token;
}

function parseAccount(idToken) {
  if (!idToken) return '';
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.preferred_username || payload.email || payload.name || '';
  } catch (_) {
    return '';
  }
}

function isClientConfigured() {
  const clientId = ORG_CONFIG.MICROSOFT_OAUTH_CLIENT_ID || '';
  return !!clientId && !clientId.includes('YOUR_') && !clientId.includes('__');
}

function assertConfigured() {
  if (!isClientConfigured()) throw new Error('MICROSOFT_OAUTH_CLIENT_ID is not configured in org-config.js.');
}

function isAccessTokenValid(token) {
  return !!token?.accessToken && Number(token.expiresAt) > Date.now();
}

function launchAuthFlow(url) {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, callbackUrl => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (!callbackUrl) reject(new Error('Microsoft sign-in was cancelled.'));
      else resolve(callbackUrl);
    });
  });
}

function createRandomString(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, value => (value % 36).toString(36)).join('');
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function storageGet(key) {
  return new Promise(resolve => chrome.storage.local.get(key, result => resolve(result[key])));
}

function storageSet(value) {
  return new Promise(resolve => chrome.storage.local.set(value, resolve));
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function endOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
}

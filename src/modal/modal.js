import ORG_CONFIG from '../org-config.js';
import {
  getCurrentUser,
  getIssue,
  getProjectBoards,
  getBoardSprints,
  getAllProjectSprints,
  searchUsers,
  createIssue,
  addIssueToSprint,
  getFinancialCategoryOptions,
  getProjectLabels,
  searchJql,
  getChildIssues,
  searchLabels,
} from '../api/jira.js';

const CF = ORG_CONFIG.CUSTOM_FIELDS;

const state = {
  issueKey: null,
  issueData: null,
  issueType: null,
  projectKey: null,
  storyKey: null,
  storyData: null,
  epicKey: null,
  epicData: null,
  epicsUnderProgram: [],
  storiesUnderEpic: [],
  currentUser: null,
  boards: [],
  sprints: [],
  users: [],
  financialCategories: [],
  existingLabels: [],
  rows: [],
  rowId: 0,
  loaded: false,
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const params = new URLSearchParams(window.location.search);
  state.issueKey = params.get('issueKey');

  document.getElementById('btn-close').addEventListener('click', () => parent.postMessage('jtp-close-modal', '*'));
  document.getElementById('btn-cancel').addEventListener('click', () => parent.postMessage('jtp-close-modal', '*'));
  document.getElementById('btn-add-row').addEventListener('click', () => addRow());
  document.getElementById('btn-create').addEventListener('click', createAll);
  document.getElementById('btn-import-csv').addEventListener('click', () => document.getElementById('csv-file-input').click());
  document.getElementById('csv-file-input').addEventListener('change', handleCsvImport);
  document.getElementById('btn-sample-csv').addEventListener('click', downloadSampleCsv);

  // Show UI immediately, add first row, then load data
  addRow();
  loadContext();
}

async function loadContext() {
  try {
    [state.currentUser, state.issueData] = await Promise.all([
      getCurrentUser(),
      getIssue(state.issueKey),
    ]);

    state.projectKey = state.issueData.fields.project.key;
    state.issueType = state.issueData.fields.issuetype.name;
    document.getElementById('header-issue-key').textContent = state.issueKey;
    document.getElementById('header-issue-key').classList.remove('ctx-loading');

    if (state.issueType === ORG_CONFIG.ISSUE_TYPES.EPIC) {
      state.epicKey = state.issueKey;
      state.epicData = state.issueData;
      const epicSummary = state.epicData.fields.summary || '';
      const epicEl = document.getElementById('ctx-epic');
      epicEl.classList.remove('hidden');
      epicEl.innerHTML = `<span class="icon">⚡</span> Epic: <b>${state.issueKey}</b> — ${escapeHtml(epicSummary)}`;
      document.getElementById('story-selection').classList.remove('hidden');
      await loadStoriesUnderEpic(state.issueKey);
      state.parentKey = state.issueKey;
    } else {
      state.storyKey = state.issueKey;
      state.storyData = state.issueData;
      const storySummary = state.storyData.fields.summary || '';
      const storyEl = document.getElementById('ctx-story');
      storyEl.classList.remove('hidden');
      storyEl.innerHTML = `<span class="icon">📋</span> Story: <b>${state.issueKey}</b> — ${escapeHtml(storySummary)}`;
      state.parentKey = state.issueData?.fields?.parent?.key || null;
    }

    await Promise.all([loadBoards(), loadUsers(), loadFinancialCategories(), loadExistingLabels()]);

    // Pre-fill current user in existing rows
    state.rows.forEach(row => {
      if (!row.assignee && state.currentUser) {
        row.assignee = state.currentUser.accountId;
        row.assigneeDisplay = state.currentUser.displayName;
        const el = document.getElementById(`row-${row.id}`);
        if (el) {
          const ac = el.querySelector('.assignee-dropdown');
          const opt = state.users.find(u => u.accountId === row.assignee);
          if (opt && ac) {
            ac.querySelector('.dropdown-search').value = opt.displayName;
            updateDropdownValue(ac, row.assignee);
          }
        }
      }
    });

    // Refresh all row dropdowns with loaded data
    refreshAllRowDropdowns();

    state.loaded = true;
    document.getElementById('btn-create').disabled = false;
  } catch (e) {
    document.getElementById('status-msg').textContent = `Error: ${e.message}`;
    document.getElementById('status-msg').style.color = '#ef4444';
  }
}

function refreshAllRowDropdowns() {
  state.rows.forEach(row => {
    const el = document.getElementById(`row-${row.id}`);
    if (!el) return;

    // Financial Category
    const fcContainer = el.querySelector('.fc-dropdown');
    const fcOptions = state.financialCategories.map(fc => ({ value: fc.value || fc.id || fc, label: fc.value || fc.name || fc }));
    renderSearchableDropdown(fcContainer, 'financialCategory', fcOptions, 'Financial Cat.');
    if (row.financialCategory) {
      const opt = fcOptions.find(o => o.value === row.financialCategory);
      if (opt) { fcContainer.querySelector('.dropdown-search').value = opt.label; updateDropdownValue(fcContainer, row.financialCategory); }
    }
    trackDropdownChange(fcContainer, row, 'financialCategory');

    // Assignee
    const assigneeContainer = el.querySelector('.assignee-dropdown');
    const assigneeOptions = state.users.map(u => ({ value: u.accountId, label: u.displayName }));
    renderSearchableDropdown(assigneeContainer, 'assignee', assigneeOptions, 'Assignee');
    if (row.assignee) {
      const opt = assigneeOptions.find(o => o.value === row.assignee);
      if (opt) { assigneeContainer.querySelector('.dropdown-search').value = opt.label; updateDropdownValue(assigneeContainer, row.assignee); }
    }
    trackDropdownChange(assigneeContainer, row, 'assignee');

    // Sprint
    const sprintContainer = el.querySelector('.sprint-dropdown');
    const sprintOptions = state.sprints.map(s => ({ value: s.id, label: `${s.state === 'active' ? '🟢' : '🔵'} ${s.name}` }));
    renderSearchableDropdown(sprintContainer, 'sprintId', [{ value: '', label: '-- Sprint --' }, ...sprintOptions], '-- Sprint --');
    if (row.sprintId) {
      const opt = sprintOptions.find(o => String(o.value) === String(row.sprintId));
      if (opt) { sprintContainer.querySelector('.dropdown-search').value = opt.label; updateDropdownValue(sprintContainer, row.sprintId); }
    }
    trackDropdownChange(sprintContainer, row, 'sprintId');
  });
}

async function loadStoriesUnderEpic(epicKey) {
  try {
    const data = await getChildIssues(epicKey, 'Story');
    state.storiesUnderEpic = (data.issues || []).map(i => ({ key: i.key, name: i.fields.summary }));

    const container = document.getElementById('story-dropdown');
    const options = state.storiesUnderEpic.map(s => ({ value: s.key, label: `${s.key} - ${s.name}` }));
    renderSearchableDropdown(container, 'story-select', options, '-- Link to Story (optional) --');

    container.querySelector('.dropdown-list').addEventListener('click', async (e) => {
      const li = e.target.closest('li[data-value]');
      if (li) {
        state.storyKey = li.dataset.value;
        state.storyData = await getIssue(state.storyKey);
      }
    });
  } catch (e) {
    state.storiesUnderEpic = [];
  }
}

async function loadUsers() {
  try { state.users = (await searchUsers('', state.projectKey)) || []; } catch (e) { state.users = []; }
}

async function loadFinancialCategories() {
  try { state.financialCategories = (await getFinancialCategoryOptions(state.projectKey)) || []; } catch (e) { state.financialCategories = []; }
}

async function loadExistingLabels() {
  try { state.existingLabels = await getProjectLabels(state.projectKey); } catch (e) { state.existingLabels = []; }
}

async function loadBoards() {
  try {
    const data = await getProjectBoards(state.projectKey);
    state.boards = data.values || [];

    const container = document.getElementById('board-dropdown');
    renderSearchableDropdown(container, 'board-select', state.boards.map(b => ({ value: b.id, label: b.name })), '-- Select Board for Sprints --', onBoardChange);

    const saved = localStorage.getItem(`jtp-board-${state.projectKey}`);
    if (saved) {
      updateDropdownValue(container, saved);
      const opt = state.boards.find(b => String(b.id) === String(saved));
      if (opt) container.querySelector('.dropdown-search').value = opt.name;
    }

    if (state.boards.length) {
      await onBoardChange();
    } else {
      state.sprints = await getAllProjectSprints(state.projectKey);
      refreshSprintDropdowns();
    }
  } catch (e) {}
}

async function onBoardChange() {
  const boardId = getDropdownValue(document.getElementById('board-dropdown'));
  if (!boardId) { state.sprints = []; return; }
  localStorage.setItem(`jtp-board-${state.projectKey}`, boardId);
  try {
    state.sprints = await getBoardSprints(boardId);
    refreshSprintDropdowns();
  } catch (e) {}
}

function refreshSprintDropdowns() {
  document.querySelectorAll('.sprint-dropdown').forEach(container => {
    const current = getDropdownValue(container);
    const options = state.sprints.map(s => ({ value: s.id, label: `${s.state === 'active' ? '🟢' : '🔵'} ${s.name}` }));
    renderSearchableDropdown(container, 'sprint-select', [{ value: '', label: '-- Sprint --' }, ...options], '-- Sprint --');
    if (current) {
      updateDropdownValue(container, current);
      const opt = options.find(o => String(o.value) === String(current));
      if (opt) container.querySelector('.dropdown-search').value = opt.label;
    }
  });
}

function renderSearchableDropdown(container, name, options, placeholder, onChange, allowCustom = false) {
  const current = container.querySelector('.dropdown-value')?.value;
  container.innerHTML = `
    <div class="relative">
      <input type="text" class="dropdown-search field-select w-full" placeholder="${placeholder}" autocomplete="off" />
      <input type="hidden" class="dropdown-value" name="${name}" value="${current || ''}" />
      <ul class="dropdown-list w-full hidden"></ul>
    </div>
  `;

  const searchInput = container.querySelector('.dropdown-search');
  const hiddenInput = container.querySelector('.dropdown-value');
  const list = container.querySelector('.dropdown-list');

  function filterAndShow(search = '') {
    const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
    list.innerHTML = filtered.map(o => `<li data-value="${o.value}">${o.label}</li>`).join('');
    if (!filtered.length) list.innerHTML = allowCustom ? '<li class="opacity-50">Press Enter to use custom value</li>' : '<li class="opacity-50">No results</li>';
    list.classList.remove('hidden');
  }

  searchInput.addEventListener('focus', () => filterAndShow(searchInput.value));
  searchInput.addEventListener('input', () => filterAndShow(searchInput.value));

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = searchInput.value.trim();
      const match = options.find(o => o.label.toLowerCase() === val.toLowerCase());
      if (match) {
        hiddenInput.value = match.value;
        searchInput.value = match.label;
        list.classList.add('hidden');
        if (onChange) onChange();
      } else if (allowCustom && val) {
        hiddenInput.value = `custom:${val}`;
        searchInput.value = val;
        list.classList.add('hidden');
        if (onChange) onChange();
      }
    }
  });

  searchInput.addEventListener('blur', () => {
    const val = searchInput.value.trim();
    const match = options.find(o => o.label.toLowerCase() === val.toLowerCase());
    if (match) {
      hiddenInput.value = match.value;
      searchInput.value = match.label;
    } else if (allowCustom && val && !hiddenInput.value) {
      hiddenInput.value = `custom:${val}`;
    }
    list.classList.add('hidden');
  });

  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-value]');
    if (li) {
      hiddenInput.value = li.dataset.value;
      searchInput.value = li.textContent;
      list.classList.add('hidden');
      if (onChange) onChange();
    }
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) list.classList.add('hidden');
  });

  if (current) {
    const opt = options.find(o => String(o.value) === String(current));
    if (opt) searchInput.value = opt.label;
  }
}

function getDropdownValue(container) {
  return container.querySelector('.dropdown-value')?.value || '';
}

function updateDropdownValue(container, value) {
  const hidden = container.querySelector('.dropdown-value');
  if (hidden) hidden.value = value;
}

function trackDropdownChange(container, rowObj, fieldName) {
  const list = container.querySelector('.dropdown-list');
  if (!list) return;
  list.addEventListener('click', () => {
    setTimeout(() => { rowObj[fieldName] = container.querySelector('.dropdown-value')?.value || ''; }, 0);
  });
}

function addRow(data = {}) {
  const prev = state.rows[state.rows.length - 1];
  const id = ++state.rowId;

  const row = {
    id,
    title: data.title || '',
    description: data.description || '',
    estimate: data.estimate || '',
    remaining: data.remaining || data.estimate || '',
    labels: data.labels || prev?.labels || '',
    financialCategory: data.financialCategory || prev?.financialCategory || '',
    assignee: data.assignee || prev?.assignee || state.currentUser?.accountId || '',
    assigneeDisplay: data.assigneeDisplay || prev?.assigneeDisplay || state.currentUser?.displayName || '',
    sprintId: data.sprintId || prev?.sprintId || '',
  };
  state.rows.push(row);
  renderRow(row);
}

function renderRow(row) {
  const container = document.getElementById('task-container');

  const el = document.createElement('div');
  el.id = `row-${row.id}`;
  el.className = 'task-row';
  el.innerHTML = `
    <div class="task-row-main">
      <button class="btn-expand" title="Expand row">▶</button>
      <input class="field-input" style="flex:2; min-width:160px" data-field="title" value="${esc(row.title)}" placeholder="Task title *" />
      <input class="field-input" style="width:60px" data-field="estimate" type="number" min="0" value="${esc(row.estimate)}" placeholder="Est. *" title="Estimate (hours)" />
      <div class="fc-dropdown" style="width:130px"></div>
      <div class="assignee-dropdown" style="width:140px"></div>
      <div class="sprint-dropdown" style="width:140px"></div>
      <button class="btn-remove-row" data-id="${row.id}">×</button>
    </div>
    <div class="task-row-expanded">
      <input class="field-input" style="flex:2; min-width:160px" data-field="description" value="${esc(row.description)}" placeholder="Description" />
      <input class="field-input" style="width:60px" data-field="remaining" type="number" min="0" value="${esc(row.remaining)}" placeholder="Rem. *" title="Remaining (hours)" />
      <div class="labels-container" style="flex:1; min-width:160px; position:relative"></div>
    </div>
  `;

  container.appendChild(el);

  // Expand/collapse toggle
  const expandBtn = el.querySelector('.btn-expand');
  expandBtn.addEventListener('click', () => {
    el.classList.toggle('expanded');
    expandBtn.textContent = el.classList.contains('expanded') ? '▼' : '▶';
  });

  // Financial Category
  const fcContainer = el.querySelector('.fc-dropdown');
  const fcOptions = state.financialCategories.map(fc => ({ value: fc.value || fc.id || fc, label: fc.value || fc.name || fc }));
  renderSearchableDropdown(fcContainer, 'financialCategory', fcOptions, 'Financial Cat.');
  if (row.financialCategory) {
    const opt = fcOptions.find(o => o.value === row.financialCategory);
    if (opt) { fcContainer.querySelector('.dropdown-search').value = opt.label; updateDropdownValue(fcContainer, row.financialCategory); }
  }
  trackDropdownChange(fcContainer, row, 'financialCategory');

  // Assignee
  const assigneeContainer = el.querySelector('.assignee-dropdown');
  const assigneeOptions = state.users.map(u => ({ value: u.accountId, label: u.displayName }));
  renderSearchableDropdown(assigneeContainer, 'assignee', assigneeOptions, 'Assignee');
  if (row.assignee) {
    const opt = assigneeOptions.find(o => o.value === row.assignee);
    if (opt) { assigneeContainer.querySelector('.dropdown-search').value = opt.label; updateDropdownValue(assigneeContainer, row.assignee); }
  }
  trackDropdownChange(assigneeContainer, row, 'assignee');

  // Sprint
  const sprintContainer = el.querySelector('.sprint-dropdown');
  const sprintOptions = state.sprints.map(s => ({ value: String(s.id), label: `${s.state === 'active' ? '🟢' : '🔵'} ${s.name}` }));
  renderSearchableDropdown(sprintContainer, 'sprintId', [{ value: '', label: '-- Sprint (optional) --' }, ...sprintOptions], '-- Sprint (optional) --', null, true);
  if (row.sprintId) {
    const opt = sprintOptions.find(o => String(o.value) === String(row.sprintId));
    if (opt) { sprintContainer.querySelector('.dropdown-search').value = opt.label; updateDropdownValue(sprintContainer, row.sprintId); }
    else if (String(row.sprintId).startsWith('custom:')) {
      sprintContainer.querySelector('.dropdown-search').value = String(row.sprintId).slice(7);
    }
  }
  trackDropdownChange(sprintContainer, row, 'sprintId');

  // Labels
  const labelsContainer = el.querySelector('.labels-container');
  renderLabelsInput(labelsContainer, row);

  // Field listeners
  el.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', (e) => {
      const field = e.target.dataset.field;
      row[field] = e.target.value;
    });
  });

  // Remove
  el.querySelector('.btn-remove-row').addEventListener('click', () => {
    state.rows = state.rows.filter(r => r.id !== row.id);
    el.remove();
  });
}

function renderLabelsInput(container, row) {
  const labelsArray = (row.labels || '').split(',').map(l => l.trim()).filter(l => l);

  container.innerHTML = `
    <div class="labels-input-wrap">
      <div class="labels-tags" style="display:inline"></div>
      <input type="text" class="label-text-input" placeholder="Labels..." autocomplete="off" />
    </div>
    <ul class="label-suggestions hidden" style="position:absolute; top:100%; left:0; width:100%"></ul>
  `;

  const tagsContainer = container.querySelector('.labels-tags');
  const textInput = container.querySelector('.label-text-input');
  const suggestions = container.querySelector('.label-suggestions');
  let debounceTimer = null;

  function renderTags() {
    tagsContainer.innerHTML = labelsArray.map((label, i) => `
      <span class="label-tag">${escapeHtml(label)}<button data-index="${i}">×</button></span>
    `).join('');
    tagsContainer.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        labelsArray.splice(parseInt(btn.dataset.index), 1);
        row.labels = labelsArray.join(', ');
        renderTags();
      });
    });
  }
  renderTags();

  async function fetchSuggestions(search) {
    if (!search) { suggestions.classList.add('hidden'); return; }
    try {
      const data = await searchLabels(search);
      const results = (data.results || []).map(r => r.value).filter(v => !labelsArray.includes(v));
      if (!results.length) {
        suggestions.innerHTML = `<li data-label="${esc(search)}">+ Create "${escapeHtml(search)}"</li>`;
      } else {
        suggestions.innerHTML = results.slice(0, 15).map(l => `<li data-label="${esc(l)}">${escapeHtml(l)}</li>`).join('');
      }
      suggestions.classList.remove('hidden');
    } catch (e) {
      suggestions.classList.add('hidden');
    }
  }

  textInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = textInput.value.trim();
    debounceTimer = setTimeout(() => fetchSuggestions(val), 250);
  });

  textInput.addEventListener('focus', () => {
    if (textInput.value.trim()) fetchSuggestions(textInput.value.trim());
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && textInput.value.trim()) {
      e.preventDefault();
      const val = textInput.value.trim();
      if (!labelsArray.includes(val)) { labelsArray.push(val); row.labels = labelsArray.join(', '); renderTags(); }
      textInput.value = '';
      suggestions.classList.add('hidden');
    } else if (e.key === 'Backspace' && !textInput.value && labelsArray.length) {
      labelsArray.pop();
      row.labels = labelsArray.join(', ');
      renderTags();
    }
  });

  suggestions.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-label]');
    if (li) {
      const label = li.dataset.label;
      if (!labelsArray.includes(label)) { labelsArray.push(label); row.labels = labelsArray.join(', '); renderTags(); }
      textInput.value = '';
      suggestions.classList.add('hidden');
      textInput.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) suggestions.classList.add('hidden');
  });

  container.querySelector('.labels-input-wrap').addEventListener('click', () => textInput.focus());
}

async function createAll() {
  if (!validateRows()) return;

  const btn = document.getElementById('btn-create');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  const sprintGroups = {};
  let created = 0;
  const errors = [];

  for (const row of state.rows) {
    try {
      const issue = await createIssue(buildPayload(row));
      if (row.sprintId) {
        if (!sprintGroups[row.sprintId]) sprintGroups[row.sprintId] = [];
        sprintGroups[row.sprintId].push(issue.key);
      }
      created++;
      markRowCreated(row, issue.key);
    } catch (e) {
      errors.push(`Row ${state.rows.indexOf(row) + 1}: ${e.message}`);
      markRowError(row, e.message);
    }
  }

  let sprintAssignedCount = 0;
  for (const [sprintId, keys] of Object.entries(sprintGroups)) {
    const resolvedId = String(sprintId);
    if (resolvedId.startsWith('custom:')) {
      const customName = resolvedId.slice(7);
      const match = state.sprints.find(s => s.name.toLowerCase() === customName.toLowerCase());
      if (match) {
        try { await addIssueToSprint(match.id, keys); sprintAssignedCount += keys.length; } catch (e) {}
      } else {
        console.warn('JTP: Could not resolve custom sprint:', customName);
      }
    } else {
      try { await addIssueToSprint(resolvedId, keys); sprintAssignedCount += keys.length; } catch (e) {}
    }
  }

  // Track analytics
  if (created > 0) trackAnalytics(created, sprintAssignedCount, 0);

  btn.disabled = false;
  btn.textContent = 'Create All';

  const statusEl = document.getElementById('status-msg');
  if (errors.length) {
    statusEl.textContent = `${created} created, ${errors.length} failed`;
    statusEl.style.color = '#ef4444';
  } else {
    statusEl.textContent = `✅ ${created} tasks created`;
    statusEl.style.color = '#22c55e';
    setTimeout(() => parent.postMessage('jtp-close-modal', '*'), 2500);
  }
}

function buildPayload(row) {
  const fields = {
    project: { key: state.projectKey },
    issuetype: { name: ORG_CONFIG.ISSUE_TYPES.TASK },
    summary: row.title,
    assignee: { accountId: row.assignee },
  };

  if (state.parentKey) {
    fields.parent = { key: state.parentKey };
  }

  const estimateHours = parseFloat(row.estimate);
  const remainingHours = parseFloat(row.remaining);
  if (estimateHours > 0 || remainingHours > 0) {
    const tt = {};
    if (estimateHours > 0) tt.originalEstimate = `${estimateHours}h`;
    if (remainingHours > 0) tt.remainingEstimate = `${remainingHours}h`;
    fields.timetracking = tt;
  }

  // Only set optional fields if they have values
  if (row.financialCategory) {
    fields[CF.FINANCIAL_CATEGORY] = { value: row.financialCategory };
  }

  if (row.description && row.description.trim()) {
    fields.description = {
      type: 'doc', version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: row.description }] }],
    };
  }

  if (row.labels && row.labels.trim()) {
    fields.labels = row.labels.split(',').map(l => l.trim()).filter(l => l);
  }

  console.log('JTP: Create payload:', JSON.stringify({ fields }, null, 2));
  return { fields };
}

function validateRows() {
  const statusEl = document.getElementById('status-msg');

  if (!state.rows.length) {
    statusEl.textContent = 'Add at least one task';
    statusEl.style.color = '#ef4444';
    return false;
  }

  for (let i = 0; i < state.rows.length; i++) {
    const r = state.rows[i];
    const missing = [];
    if (!r.title.trim()) missing.push('Title');
    if (!r.estimate) missing.push('Estimate');
    if (!r.assignee) missing.push('Assignee');
    if (missing.length) {
      statusEl.textContent = `Row ${i + 1}: missing ${missing.join(', ')}`;
      statusEl.style.color = '#ef4444';
      return false;
    }
  }
  return true;
}

function downloadSampleCsv() {
  const csv = 'title,description,estimate,remaining,financialCategory,labels\nExample Task,Task description,4,4,Capitalised,frontend';
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'jtp-sample.csv';
  a.click();
}

function handleCsvImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const lines = ev.target.result.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    let importedCount = 0;
    lines.slice(1).forEach(line => {
      const vals = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, i) => row[h] = vals[i] || '');
      addRow({
        title: row.title,
        description: row.description,
        estimate: row.estimate,
        remaining: row.remaining || row.estimate,
        financialCategory: row.financialCategory,
        labels: row.labels,
      });
      importedCount++;
    });
    // Mark these rows as CSV-imported for analytics
    state.csvImportedCount = (state.csvImportedCount || 0) + importedCount;
  };
  reader.readAsText(file);
  e.target.value = '';
}

function markRowCreated(row, issueKey) {
  const el = document.getElementById(`row-${row.id}`);
  if (!el) return;
  el.classList.add('row-created');
  const main = el.querySelector('.task-row-main');
  const badge = document.createElement('a');
  badge.className = 'created-badge';
  badge.href = `${window.location.origin}/browse/${issueKey}`;
  badge.target = '_blank';
  badge.textContent = `✓ ${issueKey}`;
  main.appendChild(badge);
  // Disable inputs
  el.querySelectorAll('input, button').forEach(i => { i.disabled = true; i.style.pointerEvents = 'none'; });
}

function markRowError(row, msg) {
  const el = document.getElementById(`row-${row.id}`);
  if (!el) return;
  el.classList.add('row-error');
  const main = el.querySelector('.task-row-main');
  const badge = document.createElement('span');
  badge.className = 'error-badge';
  badge.textContent = `✗ Failed`;
  badge.title = msg;
  main.appendChild(badge);
}

// ── Analytics Tracking ──────────────────────────────────────────────────────
function trackAnalytics(tasksCreated, sprintAssigned, csvImported) {
  const csvCount = state.csvImportedCount || csvImported;
  chrome.storage.local.get('jtp-analytics', (result) => {
    const analytics = result['jtp-analytics'] || { totalTasks: 0, sessions: 0, sprintAssigned: 0, csvImported: 0, history: [] };
    analytics.totalTasks += tasksCreated;
    analytics.sessions += 1;
    analytics.sprintAssigned = (analytics.sprintAssigned || 0) + sprintAssigned;
    analytics.csvImported = (analytics.csvImported || 0) + csvCount;
    analytics.history.push({
      date: new Date().toISOString().split('T')[0],
      count: tasksCreated,
      project: state.projectKey,
      method: csvCount > 0 ? 'csv' : 'bulk',
    });
    // Keep last 100 entries
    if (analytics.history.length > 100) analytics.history = analytics.history.slice(-100);
    chrome.storage.local.set({ 'jtp-analytics': analytics });
    state.csvImportedCount = 0;
  });
}

function esc(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

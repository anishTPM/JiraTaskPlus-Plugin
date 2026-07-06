import ORG_CONFIG from '../org-config.js';

document.getElementById('cfg-base-url').textContent = ORG_CONFIG.JIRA_BASE_URL;
document.getElementById('cfg-link-type').textContent = ORG_CONFIG.ISSUE_LINK_TYPE;

const fieldsEl = document.getElementById('cfg-fields');
Object.entries(ORG_CONFIG.CUSTOM_FIELDS).forEach(([key, value]) => {
  fieldsEl.innerHTML += `
    <div class="font-medium text-base-content/60">${key}</div>
    <div class="font-mono text-xs">${value}</div>
  `;
});

document.getElementById('cfg-fc-options').innerHTML = ORG_CONFIG.FINANCIAL_CATEGORY_OPTIONS
  .map(o => `<span class="badge badge-outline badge-sm mr-1">${o}</span>`)
  .join('');

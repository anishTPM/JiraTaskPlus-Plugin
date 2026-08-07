// ============================================================
// ORG CONFIG — Tenerity specific settings
// This file is bundled and NOT modifiable by end users.
// Open source users: modify this file for your own org.
// ============================================================

// To find custom field IDs for your environment:
// Navigate to: https://YOUR-DOMAIN.atlassian.net/rest/api/3/field
// Search for the field name (e.g. "Financial Category") to find its ID

const ENVIRONMENTS = {
  production: {
    JIRA_BASE_URL: 'https://anish3d.atlassian.net',
    CONFLUENCE_BASE_URL: 'https://anish3d.atlassian.net/wiki/rest/api/content',
    CONFLUENCE_PAGE_ID: '425985',
    CONFLUENCE_SPACE_KEY: 'TPM',
    CUSTOM_FIELDS: {
      FINANCIAL_CATEGORY: 'customfield_10195',
      STORY_POINTS: 'customfield_10058',
      SPRINT: 'customfield_10020',
    },
  },
};

// Shared config (same across environments)
const SHARED = {
  STORY_POINTS_PER_HOUR: 1,
  ISSUE_LINK_TYPE: 'Parent - Child Issue Link',
  ISSUE_TYPES: {
    TASK: 'Task',
    BUG: 'Bug',
    STORY: 'Story',
    EPIC: 'Epic',
  }
};

function detectEnvironment() {
  const currentUrl = window.location.origin;
  for (const [name, config] of Object.entries(ENVIRONMENTS)) {
    if (currentUrl.startsWith(config.JIRA_BASE_URL)) return name;
  }
  return 'production';
}

const env = detectEnvironment();
const envConfig = ENVIRONMENTS[env];

const ORG_CONFIG = {
  ...SHARED,
  ...envConfig,
  _ENV: env,
};

export default ORG_CONFIG;

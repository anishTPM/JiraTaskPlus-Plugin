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
    JIRA_BASE_URL: 'https://teneritycloud.atlassian.net',
    CUSTOM_FIELDS: {
      FINANCIAL_CATEGORY: 'customfield_10195',
      STORY_POINTS: 'customfield_10058',
      TARGET_START: 'customfield_10022',
      TARGET_END: 'customfield_10023',
      EPIC_LINK: 'customfield_10014',
      EPIC_LINK_ALT: 'customfield_10000',
      PARENT_LINK: 'parent',
      PARENT_LINK_ALT: 'customfield_16400',
      SPRINT: 'customfield_10020',
    },
  },
  staging: {
    JIRA_BASE_URL: 'https://tenerity-staging.atlassian.net',
    CUSTOM_FIELDS: {
      FINANCIAL_CATEGORY: 'customfield_10141',
      STORY_POINTS: 'customfield_10107', // not on Task screen — update when correct field found
      TARGET_START: 'customfield_10022',
      TARGET_END: 'customfield_10023',
      EPIC_LINK: 'customfield_10014',
      EPIC_LINK_ALT: 'customfield_10000',
      PARENT_LINK: 'parent',
      PARENT_LINK_ALT: 'customfield_16400',
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
    PROGRAM: 'Program',
  },
  FINANCIAL_CATEGORY_OPTIONS: [
    'Capitalised',
    'Expensed',
    'Non-Capitalised',
    'Oversight-OpEx',
  ],
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

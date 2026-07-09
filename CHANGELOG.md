# Changelog

## [1.4.0] - 2025-07-10

### Added
- **Outlook Calendar Integration** (Microsoft Edge only) — fetches today's events using MSAL tokens from Outlook's localStorage
- **Meeting reminder footer bar** — automatically appears when a meeting starts within 15 minutes; shows title, countdown, and dismiss button
- **Link & Start from meeting** — inline Jira task picker in the footer bar lets you link a calendar event to a task and start the timer in one click; meeting title pre-filled as log description
- **Cross-tab timer sync** — `chrome.storage.onChanged` listener keeps all open tabs in sync instantly; starting/stopping in one tab reflects everywhere without refresh
- **Calendar settings page** — Admin Panel → Calendar tab with Edge-only gate, feature toggle, test connection, and debug tools
- **Calendar relay content script** — `calendar-relay.js` bridges injected scripts to service worker on Outlook domains

### Changed
- Calendar feature disabled with informational banner on non-Edge browsers
- Timer state now persists and restores correctly across page refreshes and new tabs

### Added
- Floating time tracker widget (Shadow DOM, all pages, feature-flagged)
- Tempo Cloud worklog integration (api.tempo.io/4)
- Full-width bottom bar with live timer, task details, and epic badge
- Collapsible bar (« / ») with auto-expand on stop
- Draggable bubble icon with position memory
- Background API proxy for CORS-free Jira/Tempo calls
- Tracker settings in Admin Panel (token, JQL filter, toggle)
- Configurable JQL filter for task list (max 10)

## [1.2.0] - 2025-01-XX

### Added
- Admin panel with sidebar navigation (Org Configs, Analytics, Tracker)
- Analytics dashboard with task count, time saved, bulk sessions
- Confluence auto-sync (upserts user row by email)
- Per-session analytics tracking (bulk, CSV, sprint assignments)

### Changed
- Renamed Settings page to Org Configs
- Disabled Import Ops Tasks button (feature under rework)

## [1.1.0] - 2024-12-XX

### Changed
- Environment auto-detection based on current page URL matching against `JIRA_BASE_URL` in org-config
- No longer requires manual environment switching in source code

## [1.0.0] - 2024-12-XX

### Added
- Bulk task creation from Story and Epic pages
- Auto-fill Epic Link, Program, Sprint from parent context
- Per-row sprint selection (active/future sprints)
- CSV import with sample template download
- Board preference memory per project
- Financial Category and Assignee copy from previous row
- Settings page with Tempo integration
- Code obfuscation for production builds

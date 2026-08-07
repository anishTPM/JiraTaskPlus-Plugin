# Changelog

## [2.0.0] - 2026-08-07

### Added
- Cleaned up bulk creation context model — removed Program issue type and Program/Epic linking fields from the modal flow
- Kept Epic and Story context detection for task creation only

### Changed
- Removed Ops Tasks import feature and its disabled UI from the modal
- Removed `TARGET_START`, `TARGET_END`, `EPIC_LINK_ALT`, and `PARENT_LINK_ALT` custom field references from config and creation payloads
- Simplified `org-config.js` and `org-config-template.js` to only include active custom fields
- Updated feature documentation and build artifacts to reflect v2.0.0 scope

### Fixed
- Modal no longer references removed custom fields when building task payloads or detecting context

## [1.5.0] - 2025-07-10

### Added
- **Unified Footer Rail** — single persistent footer bar replaces floating bubble + separate timer bar + meeting bar; always visible at 44px, expands contextually
- **Search-first task picker** — inline search input filters tasks instantly by key or summary; no scrolling through long lists
- **Recent tasks** — last 5 tasks you logged time against appear first (with 🕑 indicator), loaded instantly from storage before API responds
- **Smart task display** — shows recent + top results (8 chips) by default; type to filter all 30 cached tasks client-side
- **Meeting Link → Task Row** — clicking Link on a meeting chip opens the task row; selecting a task starts timer with meeting title pre-filled
- **Calendar event filters** — Settings → Calendar: skip all-day events toggle + keyword blocklist (OOO, Holiday, etc.)
- **Next event always visible** — meeting chip shows next upcoming event in compact mode even during active timer
- **Mini pill** — minimize the rail to a small pill in bottom-right corner; click to restore

### Changed
- **Modular architecture (SOLID)** — tracker widget split into 6 modules: `rail-styles.js`, `rail-dom.js`, `task-service.js`, `timer-controller.js`, `meeting-controller.js`, `log-controller.js`
- **Task chips redesign** — no green play button; entire chip is clickable with hover effect; epic name shown in brackets on third line
- **API fetch capped at 30** — fetched once per session, cached in memory; prevents excessive API calls for large JQL filters
- **Task row inline** — tasks render as horizontal scrollable chips inside the footer (no popup/drawer sliding from anywhere)
- **Log textarea** — hidden scrollbars for cleaner appearance
- **Removed separate meeting picker dropdown** — Link button reuses the task row directly

### Fixed
- Calendar events not showing on initial load (race condition: polling now starts before timer state check)
- Meeting chip not visible when no meeting within 15min (now shows next future event passively)

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

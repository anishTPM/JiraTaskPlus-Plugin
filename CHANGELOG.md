# Changelog

## [1.3.0] - 2025-01-XX

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

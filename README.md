# Jira Task Plus

A Chrome/Edge extension for bulk creating Jira tasks and tracking time with Tempo — no extra login required.

## Features

- **Bulk Task Creation** — Create multiple tasks at once from any Story or Epic page
- **Auto-context** — Automatically fills Epic Link and Sprint from parent issue
- **Smart Defaults** — Copies Financial Category and Assignee from previous row
- **Sprint Selection** — Per-row sprint picker with active 🟢 and future 🔵 sprints
- **CSV Import** — Import tasks from CSV with downloadable sample template
- **Board Memory** — Remembers selected board per project
- **Multi-environment** — Auto-detects environment based on Jira instance URL
- **Admin Panel** — Sidebar-based settings with Org Configs, Analytics, Tracker, and Calendar pages
- **Analytics Dashboard** — Track tasks created, time saved, and sync stats to Confluence
- **⏱️ Unified Footer Rail** — Persistent footer bar on all pages with search-first task picker and Tempo integration
- **Search & Recent Tasks** — Instant client-side search + last 5 used tasks shown first
- **Automatic Subtasks** — Open subtasks for parent issues are fetched and displayed automatically in the task picker
- **Tempo Worklog** — Stop timer, edit time & description, log directly to Tempo
- **Calendar Events** — Page retained for future work; controls are temporarily disabled in v2.2.0
- **Cross-tab Sync** — Timer state syncs instantly across all open tabs

## Time Tracker

A unified footer rail that lives on every browser page:

1. **Idle** — 44px footer bar with ⏱️ JTP brand anchor. Click to open task picker.
2. **Task Picker** — Inline search input + horizontal task chips. Recent tasks (last 5) appear first instantly. Type to filter by key or summary.
3. **Active Timer** — Footer expands to show live timer, task key, summary, epic badge, and stop button.
4. **Log Time** — On stop, inline form appears in the footer to edit time, add description, and log to Tempo.
5. **Mini Pill** — Minimize the rail to a compact pill; click to restore.
6. **Cross-tab** — Starting or stopping in any tab instantly updates all other open tabs.
7. **Meeting Link** — Click Link on a meeting chip to open task picker; selected task starts timer with meeting title pre-filled.

## Calendar Events

Calendar Events is temporarily disabled in v2.2.0 while the Microsoft integration is reviewed. The settings page remains visible, but its enable checkbox and all Calendar Events controls are disabled. Calendar polling and meeting reminders do not run.

Planned behavior when re-enabled:

1. Polls every minute for meetings starting within **15 minutes**
2. Shows meeting title, countdown, and ▶ **Link & Start** button
3. Clicking **Link & Start** opens an inline Jira task picker — select a task to start the timer with the meeting title pre-filled as the log description
4. **× Dismiss** hides the reminder for that specific meeting

### Calendar Setup

No setup is required in v2.2.0 because Calendar Events is temporarily disabled. OAuth configuration is retained in the source for future development only.

## Installation

### Prerequisites

- **Node.js 18+** and npm (only needed for building from source)
- A **Jira Cloud** instance (`.atlassian.net`) you are logged into
- (Optional) A **Tempo** API token for time tracking

### Option A — From Release (Recommended)

1. Download the latest `.zip` from the `releases/` folder.
2. Unzip it to a local folder (e.g. `~/jira-task-plus-build`).
3. Open the extensions page for your browser:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
4. Enable **Developer mode** (toggle in the top-right corner).
5. Click **Load unpacked** and select the unzipped `build/` folder.
6. Open any Jira issue page — the **Bulk Add** button now appears in the issue header.

> No build step is required for release installs. The zipped artifact already contains the bundled, obfuscated extension.

### Option B — From Source

```bash
# 1. Clone the repository
git clone https://github.com/anishTPM/JiraTaskPlus-Plugin.git
cd jira-task-plus

# 2. Install dependencies
npm install

# 3. Configure your organization (see Configuration below)
cp src/org-config-template.js src/org-config.js
# then edit src/org-config.js with your Jira/Confluence details

# 4. Build the extension (outputs to build/ and releases/)
npm run build

# 5. Load unpacked — select the generated build/ folder (see Option A, steps 3–5)
```

For development with automatic rebuilds (no obfuscation):

```bash
npm run watch
```

### Configuration

`src/org-config.js` is **gitignored** and must be created locally — it is never committed. Copy the template and edit it:

```bash
cp src/org-config-template.js src/org-config.js
```

Then edit `src/org-config.js` to match your Jira instance:

1. Set `JIRA_BASE_URL` for each environment (production / staging).
2. Update `CUSTOM_FIELDS` with your instance's field IDs (only the active fields are required).
3. Set `CONFLUENCE_BASE_URL`, `CONFLUENCE_PAGE_ID`, `CONFLUENCE_SPACE_KEY` if you want analytics sync.
4. Adjust shared issue-type and Outlook page settings if needed. Calendar OAuth values can remain as placeholders while the feature is disabled.

The extension auto-detects which environment to use based on the current page URL.

> **Important:** Never commit `src/org-config.js` — it may contain tenant-specific URLs and IDs. Use `src/org-config-template.js` as the shared reference.

### Post-install Setup

- **Tempo timer:** Right-click the extension icon → **Options** → Tracker tab → paste your Tempo API token and save. Reload any open tab afterward.
- **Calendar Events:** No setup is required in v2.2.0; all controls and runtime polling are disabled.
- **Analytics:** Open Options → Analytics to view stats; opening it also syncs a row to the configured Confluence page.

### Troubleshooting

- **Button missing on a Jira page:** Confirm you are on an issue page (`/browse/KEY`) and that the extension is enabled; reload the tab.
- **Build fails:** Delete `node_modules/` and `build/`, then re-run `npm install` and `npm run build`.
- **Tempo "No token" error:** Re-enter the Tempo token in Options → Tracker and reload the tab.
- **Calendar Events unavailable:** This is expected in v2.2.0 because the integration is temporarily disabled.


## Project Structure

```
├── src/
│   ├── api/jira.js          # Jira REST API client
│   ├── assets/              # Icons and compiled CSS
│   ├── calendar/            # Microsoft OAuth + Graph calendar integration
│   │   └── calendar-background.js  # PKCE authentication, refresh, event fetch
│   ├── modal/               # Bulk task creation modal UI
│   ├── settings/            # Admin panel (Org Configs, Analytics, Tracker, Calendar)
│   ├── tracker/             # Time tracker (feature-flagged)
│   │   ├── tracker-widget.js       # Orchestrator (entry point)
│   │   ├── tracker-background.js   # Timer + API proxy in service worker
│   │   └── widget/                 # Modular SOLID architecture
│   │       ├── rail-styles.js      # CSS (Single Responsibility)
│   │       ├── rail-dom.js         # DOM template
│   │       ├── task-service.js     # Jira API + recent tasks
│   │       ├── timer-controller.js # Timer state machine
│   │       ├── meeting-controller.js # Calendar polling + filtering
│   │       └── log-controller.js   # Worklog form + Tempo submit
│   ├── background.js        # Service worker
│   ├── content.js           # Content script (injected into Jira pages)
│   ├── org-config.js        # Organization & environment config (gitignored)
│   ├── org-config-template.js # Template for org config
│   └── styles.css           # Tailwind CSS source
├── scripts/build.js         # Build script (bundle, obfuscate, zip)
├── manifest.json            # Chrome Extension Manifest V3
├── rollup.config.js         # Rollup bundler config
├── features.html            # Single-page feature showcase
├── installation.html        # Installation instructions
└── package.json
```

## Build

```bash
npm run build
```

This will:
1. Compile Tailwind CSS
2. Bundle with Rollup
3. Obfuscate sensitive JS files
4. Copy static assets
5. Create a release zip in `releases/`

## Development

```bash
npm run watch
```

Watches for file changes and rebuilds automatically (without obfuscation).

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Read Jira page content |
| `storage` | Save settings, timer state, and board preferences |
| `tabs` | Open settings page |
| `contextMenus` | Right-click menu options |
| `alarms` | Background timer keepalive |
| `*://*.atlassian.net/*` | Run on Jira Cloud instances |
| `https://api.tempo.io/*` | Log worklogs to Tempo Cloud |
| `<all_urls>` | Floating tracker widget on all pages |

## Tech Stack

- Chrome Extension Manifest V3
- Tailwind CSS + DaisyUI
- Rollup (bundler)
- JavaScript Obfuscator (production builds)
- Shadow DOM (tracker widget isolation)
- Tempo Cloud API v4

## License

MIT License — see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

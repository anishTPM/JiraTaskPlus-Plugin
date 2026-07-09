# Jira Task Plus

A Chrome/Edge extension for bulk creating Jira tasks and tracking time with Tempo — no extra login required.

## Features

- **Bulk Task Creation** — Create multiple tasks at once from any Story or Epic page
- **Auto-context** — Automatically fills Epic Link, Program, Sprint from parent issue
- **Smart Defaults** — Copies Financial Category and Assignee from previous row
- **Sprint Selection** — Per-row sprint picker with active 🟢 and future 🔵 sprints
- **CSV Import** — Import tasks from CSV with downloadable sample template
- **Board Memory** — Remembers selected board per project
- **Multi-environment** — Auto-detects environment based on Jira instance URL
- **Admin Panel** — Sidebar-based settings with Org Configs, Analytics, Tracker, and Calendar pages
- **Analytics Dashboard** — Track tasks created, time saved, and sync stats to Confluence
- **⏱️ Floating Time Tracker** — Persistent draggable widget on all pages with Tempo Cloud integration
- **Tempo Worklog** — Play/Stop timer, edit time & description, log directly to Tempo
- **📅 Calendar Integration** — Outlook calendar meeting reminders in footer bar with one-click timer start (Edge only)
- **Cross-tab Sync** — Timer state syncs instantly across all open tabs

## Time Tracker

A floating bubble widget that lives on every browser page:

1. **Idle** — Draggable ⏱️ icon (position remembered). Click to open task list.
2. **Task List** — Shows up to 10 tasks from your configurable JQL filter with epic info.
3. **Active Timer** — Full-width bottom bar with live timer, task details, epic badge, and stop button.
4. **Collapsible** — `«` button collapses bar to a compact pill; `»` expands it back.
5. **Log Time** — On stop, inline form appears in the bar to edit time, add description, and log to Tempo.
6. **Cross-tab** — Starting or stopping in any tab instantly updates all other open tabs.

## Calendar Integration (Edge only)

A footer meeting reminder bar that appears automatically:

1. Polls every minute for meetings starting within **15 minutes**
2. Shows meeting title, countdown, and ▶ **Link & Start** button
3. Clicking **Link & Start** opens an inline Jira task picker — select a task to start the timer with the meeting title pre-filled as the log description
4. **× Dismiss** hides the reminder for that specific meeting

### Calendar Setup

1. Open Admin Panel → Calendar tab (Microsoft Edge only)
2. Enable the calendar toggle
3. Save → reload any tab
4. Make sure you are logged into Outlook in Edge

> **Note:** Calendar integration requires Microsoft Edge. Chrome encrypts authentication tokens in a way that makes them inaccessible to extensions.

## Installation

### From Release (Recommended)

1. Download the latest `.zip` from the `releases/` folder
2. Unzip to a local folder
3. Open `chrome://extensions` (or `edge://extensions`)
4. Enable **Developer mode**
5. Click **Load unpacked** and select the unzipped folder

### From Source

```bash
git clone https://github.com/YOUR-USERNAME/jira-task-plus.git
cd jira-task-plus
npm install
npm run build
```

Then load the `build/` folder as an unpacked extension.

## Configuration

Edit `src/org-config.js` to configure for your Jira instance:

1. Set your `JIRA_BASE_URL` for each environment
2. Update `CUSTOM_FIELDS` with your instance's field IDs
3. Set `CONFLUENCE_BASE_URL`, `CONFLUENCE_PAGE_ID`, `CONFLUENCE_SPACE_KEY` for analytics sync
4. Adjust `SHARED` settings (issue types, financial categories, etc.)

The extension auto-detects which environment to use based on the current page URL.

## Project Structure

```
├── src/
│   ├── api/jira.js          # Jira REST API client
│   ├── assets/              # Icons and compiled CSS
│   ├── modal/               # Bulk task creation modal UI
│   ├── popup/               # Extension popup
│   ├── settings/            # Admin panel (Org Configs, Analytics, Tracker)
│   ├── tracker/             # Floating time tracker (feature-flagged)
│   │   ├── tracker-widget.js    # Shadow DOM widget (all pages)
│   │   ├── tracker-background.js # Timer + API proxy in service worker
│   │   └── tempo-api.js         # Tempo Cloud API client
│   ├── background.js        # Service worker
│   ├── content.js           # Content script (injected into Jira pages)
│   ├── org-config.js        # Organization & environment config
│   └── styles.css           # Tailwind CSS source
├── scripts/build.js         # Build script (bundle, obfuscate, zip)
├── manifest.json            # Chrome Extension Manifest V3
├── rollup.config.js         # Rollup bundler config
├── features.html            # Single-page feature showcase
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

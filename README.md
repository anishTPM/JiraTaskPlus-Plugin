# Jira Task Plus

A Chrome/Edge extension for bulk creating Jira tasks directly from Epic and Story pages — no extra login required.

## Features

- **Bulk Task Creation** — Create multiple tasks at once from any Story or Epic page
- **Auto-context** — Automatically fills Epic Link, Program, Sprint from parent issue
- **Smart Defaults** — Copies Financial Category and Assignee from previous row
- **Sprint Selection** — Per-row sprint picker with active 🟢 and future 🔵 sprints
- **CSV Import** — Import tasks from CSV with downloadable sample template
- **Board Memory** — Remembers selected board per project
- **Multi-environment** — Auto-detects environment based on Jira instance URL

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
   - Find field IDs at: `https://YOUR-DOMAIN.atlassian.net/rest/api/3/field`
3. Adjust `SHARED` settings (issue types, financial categories, etc.)

The extension auto-detects which environment to use based on the current page URL.

## Project Structure

```
├── src/
│   ├── api/jira.js          # Jira REST API client
│   ├── assets/              # Icons and compiled CSS
│   ├── modal/               # Bulk task creation modal UI
│   ├── popup/               # Extension popup
│   ├── settings/            # Options/settings page
│   ├── background.js        # Service worker
│   ├── content.js           # Content script (injected into Jira pages)
│   ├── org-config.js        # Organization & environment config
│   └── styles.css           # Tailwind CSS source
├── scripts/build.js         # Build script (bundle, obfuscate, zip)
├── manifest.json            # Chrome Extension Manifest V3
├── rollup.config.js         # Rollup bundler config
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
| `storage` | Save settings and board preferences |
| `tabs` | Open settings page |
| `contextMenus` | Right-click menu options |
| `*://*.atlassian.net/*` | Run on Jira Cloud instances |

## Tech Stack

- Chrome Extension Manifest V3
- Tailwind CSS + DaisyUI
- Rollup (bundler)
- JavaScript Obfuscator (production builds)

## License

MIT License — see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

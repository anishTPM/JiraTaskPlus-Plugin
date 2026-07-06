Business case: Chrome plugin to create Jira tasks in Bulk from Jira Page so that there will not be any login needed. Use Jira APIs to complete these.


## ➕ Bulk Task Creator
### Available on Epic and Story pages. Click **"➕ Add Tasks"** in the toolbar.
- Create multiple Tasks at once linked to the Story
- Auto-fills Epic Link, Program, Sprint from Story context
- Blocks creation if Epic or Program is not linked
- Default assignee = current logged-in user
- Copies Financial Category and Assignee from previous row
- All fields mandatory: Title, Description, Estimate, Remaining, Financial Category, Assignee
- Sets Story Points = Original Estimate (hidden, auto-calculated)
- Links Task to Story via "Is a Child of" relationship
- **Board dropdown** in modal header — select any project board
- **Per-row Sprint dropdown** — active 🟢 and future 🔵 sprints loaded from selected board
- Optionally adds Tasks to selected sprint per row
- **CSV Import** — import tasks from CSV file, download sample template
- **Board preference** — selected board remembered per project

### User Flow : Create multiple Tasks from a Epic / Story in seconds
- Open any Story page and click "➕ Add Tasks" in the toolbar
- Modal loads with Story, Epic, Program, and Sprint context auto-filled
- Fill in Task details — Title, Description, Estimate, Financial Category, Assignee
- Select a Board to load sprints. Board is remembered for next time
- Optionally click ⬇️ Sample CSV to download a template, fill it, then 📥 Import CSV
- Click "+ Add Task" to add more rows. Fields copy from previous row
- Click "Create All" — Tasks created, linked to Story, Epic set, added to Sprint


### Settings

Right-click the extension icon → **Options**:

| Section | Description |
|---------|-------------|
| Tempo Settings | Tempo API token, weekly hours target, reminder messages |
| 🔗 Integrations | Org-configured pages (locked) or custom Confluence URL |

---

### Permissions

- `activeTab` — Read Jira page content
- `storage` — Save settings and analytics
- `*://*.atlassian.net/*` — Run on Jira Cloud
- `*://*/jira/*` — Run on Jira Server/Data Center


### Security Notes
⚠️ **Keep source code private**
- Only share the built/obfuscated version
- Don't commit `build/` or `releases/` to public repos
- Source code stays in private repository

✅ **What colleagues get**
- Obfuscated, minified code
- Difficult to reverse engineer
- Protected intellectual property

### Runtime & Platform
- Chrome Extension Manifest V3
- tailwindcss with daisyUI 

### Build & Bundling
- Node.js — runtime for build scripts
- Rollup — ES module bundler (rollup ^4.28.0)
- @rollup/plugin-node-resolve (^15.3.0) — resolves node_modules imports
- @rollup/plugin-terser (^0.4.4) — minification
- javascript-obfuscator (^4.1.0) — code obfuscation for options/analytics pages
- Custom build script (scripts/build.js) — orchestrates bundling, obfuscation, file copying

### Packaging
- archiver (^6.0.1) — creates .zip release packages
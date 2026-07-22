// Single Responsibility: All widget CSS lives here.
// Unified footer rail — tasks render inline as horizontal chips, no popup/drawer.

export const RAIL_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }

  /* ── Theme variables ─────────────────────────────────────────────────── */
  .rail, .mini-pill, .log-toast {
    --bg1:#0f172a; --bg2:#1e293b; --border:#334155; --text:#f1f5f9; --text2:#94a3b8;
    --text3:#e2e8f0; --muted:#64748b; --chip-bg:#1e293b; --chip-bg2:#162032;
    --input-bg:#0f172a; --input-text:#f1f5f9; --placeholder:#475569;
    --scrollbar:#475569;
  }
  .rail.light, .mini-pill.light, .log-toast.light {
    --bg1:#f1f5f9; --bg2:#ffffff; --border:#cbd5e1; --text:#0f172a; --text2:#475569;
    --text3:#1e293b; --muted:#64748b; --chip-bg:#ffffff; --chip-bg2:#eff6ff;
    --input-bg:#ffffff; --input-text:#0f172a; --placeholder:#94a3b8;
    --scrollbar:#94a3b8;
  }

  /* Light mode hardcoded color overrides */
  .rail.light .rail-timer .task-key { color:#4338ca; }
  .rail.light .rail-timer .time-estimate { color:#3730a3; background:rgba(99,102,241,0.1); }
  .rail.light .rail-timer .epic-badge { color:#4338ca; }
  .rail.light .rail-timer .active-desc { color:var(--text3); }
  .rail.light .rail-timer .active-desc.has-desc { color:#0369a1; }
  .rail.light .rail-timer .active-desc:focus { color:#0f172a; }
  .rail.light .task-chip .chip-key { color:#4338ca; }
  .rail.light .task-chip:hover .chip-key { color:#3730a3; }
  .rail.light .bar-log .log-issue { color:#4338ca; }
  .rail.light .bar-log .log-status.success { color:#15803d; }
  .rail.light .bar-log .log-status.error { color:#dc2626; }
  .rail.light .meeting-chip .chip-badge { color:#3730a3; background:rgba(99,102,241,0.12); }
  .rail.light .meeting-chip .chip-title { color:#1e293b; }
  .rail.light .rail-hide { background:rgba(99,102,241,0.08); border-color:#cbd5e1; color:#475569; }
  .rail.light .rail-hide:hover { background:rgba(99,102,241,0.15); border-color:#6366f1; color:#4338ca; }

  /* ── Unified Footer Rail ─────────────────────────────────────────────── */
  .rail { position:fixed; bottom:0; left:0; right:0; pointer-events:auto; background:linear-gradient(135deg,var(--bg1) 0%,var(--bg2) 100%); border-top:1px solid var(--border); box-shadow:0 -2px 20px rgba(0,0,0,0.3); z-index:2147483647; display:flex; flex-direction:column; animation:railUp 0.25s ease; }
  .rail.hidden { display:none; }
  @keyframes railUp { from{transform:translateY(100%)} to{transform:translateY(0)} }

  /* Main row (brand + timer/idle + meeting + hide) */
  .rail-main { display:flex; align-items:center; padding:0 20px; height:44px; flex-shrink:0; }

  /* Rail brand (left anchor) */
  .rail-brand { display:flex; align-items:center; gap:8px; cursor:pointer; padding:6px 14px 6px 6px; border-right:1px solid var(--border); margin-right:14px; flex-shrink:0; border-radius:6px; transition:background 0.15s; }
  .rail-brand:hover { background:rgba(99,102,241,0.1); }
  .rail-brand.active { background:rgba(99,102,241,0.15); }
  .rail-brand .brand-icon { font-size:18px; }
  .rail-brand .brand-label { font-size:12px; font-weight:700; color:var(--text2); letter-spacing:0.3px; }
  .rail-brand:hover .brand-label, .rail-brand.active .brand-label { color:var(--text3); }

  /* Idle hint */
  .rail-idle { display:flex; align-items:center; gap:8px; flex:1; }
  .rail-idle .idle-text { font-size:12px; color:var(--muted); }

  /* Active timer zone */
  .rail-timer { display:none; align-items:center; gap:14px; flex:1; }
  .rail-timer.visible { display:flex; }
  .rail-timer .pulse-dot { width:10px; height:10px; border-radius:50%; background:#ef4444; animation:pulse 1.5s infinite; flex-shrink:0; }
  @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 7px rgba(239,68,68,0)} }
  .rail-timer .timer-text { font-family:'SF Mono','Fira Code',monospace; font-size:18px; font-weight:700; color:var(--text); letter-spacing:0.5px; min-width:82px; }
  .rail-timer .divider { width:1px; height:24px; background:var(--border); flex-shrink:0; }
  .rail-timer .task-key { font-size:11px; font-weight:700; color:#818cf8; flex-shrink:0; }
  .rail-timer .task-summary { font-size:13px; color:var(--text3); font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:350px; }
  .rail-timer .time-estimate { font-size:11px; color:#a5b4fc; font-weight:600; background:rgba(99,102,241,0.12); padding:2px 8px; border-radius:6px; white-space:nowrap; flex-shrink:0; }
  .rail-timer .epic-badge { font-size:10px; color:#a5b4fc; font-weight:500; flex-shrink:0; }
  .rail-timer .active-desc { font-size:11px; color:var(--muted); font-style:italic; background:transparent; border:none; border-bottom:1px dashed var(--border); outline:none; padding:2px 4px; width:180px; min-width:80px; max-width:220px; flex-shrink:1; transition:border-color 0.15s, color 0.15s; font-family:inherit; }
  .rail-timer .active-desc::placeholder { color:var(--muted); font-style:italic; }
  .rail-timer .active-desc:focus { border-bottom-color:#6366f1; color:var(--text); font-style:normal; }
  .rail-timer .active-desc.has-desc { color:var(--text3); font-style:normal; border-bottom-color:transparent; }
  .rail-timer .active-desc.has-desc:focus { border-bottom-color:#6366f1; }
  .stop-btn { background:#ef4444; color:#fff; border:none; border-radius:8px; padding:7px 16px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.15s; flex-shrink:0; margin-left:auto; }
  .stop-btn:hover { background:#dc2626; transform:scale(1.03); }

  /* Meeting chip (right zone — shown in idle AND timer states) */
  .meeting-chip { display:none; align-items:center; gap:10px; margin-left:auto; padding-left:14px; border-left:1px solid var(--border); flex-shrink:0; }
  .meeting-chip.visible { display:flex; }
  .meeting-chip.compact .chip-link, .meeting-chip.compact .chip-dismiss { display:none; }
  .meeting-chip .chip-badge { font-size:10px; font-weight:700; color:#a5b4fc; white-space:nowrap; background:rgba(99,102,241,0.15); padding:2px 7px; border-radius:6px; }
  .meeting-chip .chip-title { font-size:12px; color:#e0e7ff; font-weight:600; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .meeting-chip .chip-link { background:#6366f1; color:#fff; border:none; border-radius:6px; padding:5px 10px; font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap; transition:all 0.15s; }
  .meeting-chip .chip-link:hover { background:#4f46e5; transform:scale(1.03); }
  .meeting-chip .chip-dismiss { background:none; border:none; color:var(--muted); font-size:16px; cursor:pointer; padding:2px 5px; line-height:1; }
  .meeting-chip .chip-dismiss:hover { color:var(--text3); }

  /* Rail hide/collapse button */
  .rail-hide { display:flex; align-items:center; gap:5px; background:rgba(71,85,105,0.15); border:1px solid var(--border); border-radius:8px; color:var(--muted); font-size:11px; font-weight:600; cursor:pointer; padding:5px 10px; margin-left:10px; flex-shrink:0; transition:all 0.15s; letter-spacing:0.2px; }
  .rail-hide:hover { background:rgba(99,102,241,0.12); border-color:#6366f1; color:#a5b4fc; }
  .rail-hide .rail-hide-icon { font-size:14px; line-height:1; }
  .rail-hide .rail-hide-label { font-size:10px; }

  /* Theme toggle button */
  .rail-theme { background:none; border:none; color:var(--muted); font-size:14px; cursor:pointer; padding:4px 6px; flex-shrink:0; transition:color 0.15s; line-height:1; }
  .rail-theme:hover { color:var(--text); }

  /* ── Task Row (inline horizontal scroll inside rail) ────────────────────── */
  .task-row { display:none; border-top:1px solid var(--border); padding:8px 20px; overflow:hidden; }
  .task-row.visible { display:block; }
  .task-search { width:100%; border:1px solid var(--border); border-radius:8px; padding:7px 12px; font-size:13px; outline:none; background:var(--input-bg); color:var(--input-text); margin-bottom:8px; transition:border-color 0.15s; }
  .task-search:focus { border-color:#6366f1; }
  .task-search::placeholder { color:var(--placeholder); }
  .task-row-list { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; scrollbar-width:thin; scrollbar-color:var(--scrollbar) transparent; }
  .task-row-list::-webkit-scrollbar { height:4px; }
  .task-row-list::-webkit-scrollbar-track { background:transparent; }
  .task-row-list::-webkit-scrollbar-thumb { background:var(--scrollbar); border-radius:4px; }
  .task-chip { display:flex; align-items:center; gap:8px; background:var(--chip-bg); border:1px solid var(--border); border-radius:10px; padding:8px 12px; cursor:default; flex-shrink:0; min-width:180px; max-width:280px; transition:border-color 0.15s, background 0.15s; }
  .task-chip .chip-info { flex:1; overflow:hidden; }
  .task-chip .chip-key { font-size:10px; font-weight:700; color:#818cf8; display:flex; align-items:center; gap:6px; }
  .task-chip .chip-status { font-size:9px; font-weight:600; color:var(--text2); background:var(--border); padding:1px 6px; border-radius:4px; }
  .task-chip .chip-summary { font-size:12px; color:var(--text3); font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
  .task-chip .chip-epic { font-size:9px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
  .task-chip.recent { border-color:var(--border); background:var(--chip-bg2); }
  .task-chip.recent .chip-key::before { content:'\u{1F551} '; font-size:8px; }
  .task-chip:hover { border-color:#6366f1; background:var(--bg1); cursor:pointer; }
  .task-chip:hover .chip-key { color:#a5b4fc; }
  .task-chip:hover .chip-summary { color:var(--text); }
  .task-row-msg { font-size:12px; color:var(--muted); padding:4px 0; }

  /* Log form row */
  .bar-log { display:none; align-items:center; width:100%; padding:10px 20px; gap:12px; border-top:1px solid var(--border); }
  .bar-log.visible { display:flex; }
  .bar-log .log-issue { font-size:12px; color:#818cf8; font-weight:700; flex-shrink:0; }
  .bar-log input, .bar-log textarea { border:1px solid var(--border); border-radius:8px; padding:8px 12px; font-size:13px; outline:none; background:var(--input-bg); color:var(--input-text); transition:border-color 0.15s; }
  .bar-log input:focus, .bar-log textarea:focus { border-color:#6366f1; }
  .bar-log input { width:90px; }
  .bar-log textarea { flex:1; resize:none; height:34px; min-width:180px; overflow:hidden; }
  .bar-log .btn-discard { background:transparent; border:1px solid var(--muted); border-radius:8px; padding:7px 14px; font-size:12px; font-weight:600; cursor:pointer; color:var(--text2); transition:all 0.15s; }
  .bar-log .btn-discard:hover { border-color:var(--text2); color:var(--text3); }
  .bar-log .btn-log { background:linear-gradient(135deg,#6366f1,#3b82f6); color:#fff; border:none; border-radius:8px; padding:7px 18px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.15s; box-shadow:0 2px 8px rgba(99,102,241,0.25); }
  .bar-log .btn-log:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(99,102,241,0.35); }
  .bar-log .btn-log:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
  .bar-log .log-status { font-size:11px; font-weight:500; min-width:60px; text-align:center; }
  .bar-log .log-status.success { color:#4ade80; }
  .bar-log .log-status.error { color:#f87171; }


  /* ── Mini pill (when rail hidden) ──────────────────────────────────────── */
  .mini-pill { position:fixed; bottom:14px; right:14px; pointer-events:auto; background:linear-gradient(135deg,var(--bg2),var(--bg1)); border:1px solid var(--border); border-radius:16px; padding:8px 14px; cursor:pointer; box-shadow:0 4px 20px rgba(0,0,0,0.35); display:none; align-items:center; gap:8px; transition:transform 0.15s, box-shadow 0.15s; z-index:2147483647; }
  .mini-pill.visible { display:flex; }
  .mini-pill:hover { transform:scale(1.05); box-shadow:0 6px 24px rgba(99,102,241,0.3); border-color:#6366f1; }
  .mini-pill .mp-expand { font-size:9px; font-weight:700; color:var(--muted); letter-spacing:0.3px; text-transform:uppercase; }
  .mini-pill:hover .mp-expand { color:#a5b4fc; }
  .mini-pill .mp-icon { font-size:16px; line-height:1; }
  .mini-pill .mp-timer { font-family:'SF Mono','Fira Code',monospace; font-size:12px; font-weight:700; color:var(--text); }
  .mini-pill .mp-week { font-size:10px; color:var(--text2); white-space:nowrap; }
  .mini-pill .mp-divider { width:1px; height:14px; background:var(--muted); flex-shrink:0; }

  /* ── Pill Design: compact ── */
  .mini-pill.pill-compact { padding:5px 8px; border-radius:20px; gap:5px; bottom:10px; right:10px; box-shadow:0 2px 10px rgba(0,0,0,0.25); }
  .mini-pill.pill-compact .mp-icon { font-size:12px; }
  .mini-pill.pill-compact .mp-timer { font-size:10px; }
  .mini-pill.pill-compact .mp-week { font-size:8px; }
  .mini-pill.pill-compact .mp-divider { height:10px; }

  /* ── Pill Design: expanded ── */
  .mini-pill.pill-expanded { padding:12px 22px; border-radius:14px; gap:12px; box-shadow:0 6px 28px rgba(0,0,0,0.45); border-color:#475569; }
  .mini-pill.pill-expanded .mp-icon { font-size:22px; }
  .mini-pill.pill-expanded .mp-timer { font-size:16px; letter-spacing:0.5px; }
  .mini-pill.pill-expanded .mp-week { font-size:12px; color:#a5b4fc; font-weight:600; }
  .mini-pill.pill-expanded .mp-divider { height:20px; background:#475569; }

  /* ── Pill Design: rounded ── */
  .mini-pill.pill-rounded { border-radius:50px; padding:10px 20px; gap:10px; background:linear-gradient(135deg,#312e81,#1e1b4b); border:2px solid #6366f1; box-shadow:0 4px 24px rgba(99,102,241,0.35); }
  .mini-pill.pill-rounded .mp-icon { font-size:16px; }
  .mini-pill.pill-rounded .mp-timer { font-size:13px; color:#e0e7ff; }
  .mini-pill.pill-rounded .mp-week { font-size:10px; color:#c7d2fe; }
  .mini-pill.pill-rounded .mp-divider { height:14px; background:#6366f1; }
  .mini-pill.pill-rounded:hover { box-shadow:0 6px 30px rgba(99,102,241,0.5); }

  /* ── Pill Design: glass ── */
  .mini-pill.pill-glass { background:rgba(15,23,42,0.6); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid rgba(99,102,241,0.4); border-radius:18px; padding:9px 16px; gap:9px; box-shadow:0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05); }
  .mini-pill.pill-glass .mp-icon { font-size:16px; }
  .mini-pill.pill-glass .mp-timer { font-size:12px; color:#e0e7ff; }
  .mini-pill.pill-glass .mp-week { font-size:10px; color:#a5b4fc; }
  .mini-pill.pill-glass .mp-divider { height:14px; background:rgba(99,102,241,0.4); }
  .mini-pill.pill-glass:hover { background:rgba(15,23,42,0.8); border-color:rgba(99,102,241,0.6); }

  /* ── Success Toast ───────────────────────────────────────────────────────── */
  .log-toast { position:fixed; bottom:60px; right:14px; pointer-events:none; background:linear-gradient(135deg,#065f46,#064e3b); border:1px solid #10b981; border-radius:12px; padding:10px 18px; display:none; align-items:center; gap:8px; z-index:2147483647; animation:toastIn 0.25s ease; box-shadow:0 4px 16px rgba(16,185,129,0.3); }
  .log-toast.visible { display:flex; }
  .log-toast .toast-icon { font-size:16px; }
  .log-toast .toast-text { font-size:12px; font-weight:600; color:#d1fae5; }
  @keyframes toastIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
`;


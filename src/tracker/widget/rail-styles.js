// Single Responsibility: All widget CSS lives here.
// Unified footer rail — tasks render inline as horizontal chips, no popup/drawer.

export const RAIL_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }

  /* ── Unified Footer Rail ─────────────────────────────────────────────── */
  .rail { position:fixed; bottom:0; left:0; right:0; pointer-events:auto; background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%); border-top:1px solid #334155; box-shadow:0 -2px 20px rgba(0,0,0,0.3); z-index:2147483647; display:flex; flex-direction:column; animation:railUp 0.25s ease; }
  .rail.hidden { display:none; }
  @keyframes railUp { from{transform:translateY(100%)} to{transform:translateY(0)} }

  /* Main row (brand + timer/idle + meeting + hide) */
  .rail-main { display:flex; align-items:center; padding:0 20px; height:44px; flex-shrink:0; }

  /* Rail brand (left anchor) */
  .rail-brand { display:flex; align-items:center; gap:8px; cursor:pointer; padding:6px 14px 6px 6px; border-right:1px solid #334155; margin-right:14px; flex-shrink:0; border-radius:6px; transition:background 0.15s; }
  .rail-brand:hover { background:rgba(99,102,241,0.1); }
  .rail-brand.active { background:rgba(99,102,241,0.15); }
  .rail-brand .brand-icon { font-size:18px; }
  .rail-brand .brand-label { font-size:12px; font-weight:700; color:#94a3b8; letter-spacing:0.3px; }
  .rail-brand:hover .brand-label, .rail-brand.active .brand-label { color:#e2e8f0; }

  /* Idle hint */
  .rail-idle { display:flex; align-items:center; gap:8px; flex:1; }
  .rail-idle .idle-text { font-size:12px; color:#64748b; }

  /* Active timer zone */
  .rail-timer { display:none; align-items:center; gap:14px; flex:1; }
  .rail-timer.visible { display:flex; }
  .rail-timer .pulse-dot { width:10px; height:10px; border-radius:50%; background:#ef4444; animation:pulse 1.5s infinite; flex-shrink:0; }
  @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 7px rgba(239,68,68,0)} }
  .rail-timer .timer-text { font-family:'SF Mono','Fira Code',monospace; font-size:18px; font-weight:700; color:#f1f5f9; letter-spacing:0.5px; min-width:82px; }
  .rail-timer .divider { width:1px; height:24px; background:#334155; flex-shrink:0; }
  .rail-timer .task-key { font-size:11px; font-weight:700; color:#818cf8; flex-shrink:0; }
  .rail-timer .task-summary { font-size:13px; color:#e2e8f0; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:350px; }
  .rail-timer .epic-badge { font-size:10px; color:#a5b4fc; font-weight:500; flex-shrink:0; }
  .stop-btn { background:#ef4444; color:#fff; border:none; border-radius:8px; padding:7px 16px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.15s; flex-shrink:0; margin-left:auto; }
  .stop-btn:hover { background:#dc2626; transform:scale(1.03); }

  /* Meeting chip (right zone — shown in idle AND timer states) */
  .meeting-chip { display:none; align-items:center; gap:10px; margin-left:auto; padding-left:14px; border-left:1px solid #334155; flex-shrink:0; }
  .meeting-chip.visible { display:flex; }
  .meeting-chip.compact .chip-link, .meeting-chip.compact .chip-dismiss { display:none; }
  .meeting-chip .chip-badge { font-size:10px; font-weight:700; color:#a5b4fc; white-space:nowrap; background:rgba(99,102,241,0.15); padding:2px 7px; border-radius:6px; }
  .meeting-chip .chip-title { font-size:12px; color:#e0e7ff; font-weight:600; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .meeting-chip .chip-link { background:#6366f1; color:#fff; border:none; border-radius:6px; padding:5px 10px; font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap; transition:all 0.15s; }
  .meeting-chip .chip-link:hover { background:#4f46e5; transform:scale(1.03); }
  .meeting-chip .chip-dismiss { background:none; border:none; color:#64748b; font-size:16px; cursor:pointer; padding:2px 5px; line-height:1; }
  .meeting-chip .chip-dismiss:hover { color:#e2e8f0; }

  /* Rail hide button */
  .rail-hide { background:none; border:none; color:#475569; font-size:16px; cursor:pointer; padding:4px 8px; margin-left:10px; flex-shrink:0; transition:color 0.15s; }
  .rail-hide:hover { color:#e2e8f0; }

  /* ── Task Row (inline horizontal scroll inside rail) ────────────────────── */
  .task-row { display:none; border-top:1px solid #334155; padding:8px 20px; overflow:hidden; }
  .task-row.visible { display:block; }
  .task-row-list { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; scrollbar-width:thin; scrollbar-color:#475569 transparent; }
  .task-row-list::-webkit-scrollbar { height:4px; }
  .task-row-list::-webkit-scrollbar-track { background:transparent; }
  .task-row-list::-webkit-scrollbar-thumb { background:#475569; border-radius:4px; }
  .task-chip { display:flex; align-items:center; gap:8px; background:#1e293b; border:1px solid #334155; border-radius:10px; padding:8px 12px; cursor:default; flex-shrink:0; min-width:180px; max-width:280px; transition:border-color 0.15s, background 0.15s; }
  .task-chip:hover { border-color:#6366f1; background:#1e293b; }
  .task-chip .chip-info { flex:1; overflow:hidden; }
  .task-chip .chip-key { font-size:10px; font-weight:700; color:#818cf8; }
  .task-chip .chip-summary { font-size:12px; color:#e2e8f0; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
  .task-chip .chip-epic { font-size:9px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
  .task-chip:hover { border-color:#6366f1; background:#0f172a; cursor:pointer; }
  .task-chip:hover .chip-key { color:#a5b4fc; }
  .task-chip:hover .chip-summary { color:#fff; }
  .task-row-msg { font-size:12px; color:#64748b; padding:4px 0; }

  /* Log form row */
  .bar-log { display:none; align-items:center; width:100%; padding:10px 20px; gap:12px; border-top:1px solid #334155; }
  .bar-log.visible { display:flex; }
  .bar-log .log-issue { font-size:12px; color:#818cf8; font-weight:700; flex-shrink:0; }
  .bar-log input, .bar-log textarea { border:1px solid #334155; border-radius:8px; padding:8px 12px; font-size:13px; outline:none; background:#0f172a; color:#f1f5f9; transition:border-color 0.15s; }
  .bar-log input:focus, .bar-log textarea:focus { border-color:#6366f1; }
  .bar-log input { width:90px; }
  .bar-log textarea { flex:1; resize:none; height:34px; min-width:180px; overflow:hidden; }
  .bar-log .btn-discard { background:transparent; border:1px solid #475569; border-radius:8px; padding:7px 14px; font-size:12px; font-weight:600; cursor:pointer; color:#94a3b8; transition:all 0.15s; }
  .bar-log .btn-discard:hover { border-color:#64748b; color:#e2e8f0; }
  .bar-log .btn-log { background:linear-gradient(135deg,#6366f1,#3b82f6); color:#fff; border:none; border-radius:8px; padding:7px 18px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.15s; box-shadow:0 2px 8px rgba(99,102,241,0.25); }
  .bar-log .btn-log:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(99,102,241,0.35); }
  .bar-log .btn-log:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
  .bar-log .log-status { font-size:11px; font-weight:500; min-width:60px; text-align:center; }
  .bar-log .log-status.success { color:#4ade80; }
  .bar-log .log-status.error { color:#f87171; }


  /* ── Mini pill (when rail hidden) ──────────────────────────────────────── */
  .mini-pill { position:fixed; bottom:14px; right:14px; pointer-events:auto; background:linear-gradient(135deg,#1e293b,#0f172a); border-radius:16px; padding:8px 14px; cursor:pointer; box-shadow:0 4px 20px rgba(0,0,0,0.35); display:none; align-items:center; gap:8px; transition:transform 0.15s; z-index:2147483647; }
  .mini-pill.visible { display:flex; }
  .mini-pill:hover { transform:scale(1.05); }
  .mini-pill .mp-icon { font-size:16px; }
  .mini-pill .mp-timer { font-family:'SF Mono','Fira Code',monospace; font-size:12px; font-weight:700; color:#f1f5f9; }
`;

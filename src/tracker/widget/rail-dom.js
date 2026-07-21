// Single Responsibility: DOM template for the unified rail widget.
// Tasks render inline as a horizontal scrollable row inside the footer.

export const RAIL_HTML = `
  <div class="rail" id="rail">
    <!-- Top row: brand + timer/idle + meeting chip -->
    <div class="rail-main" id="rail-main">
      <div class="rail-brand" id="rail-brand">
        <span class="brand-icon">\u23f1\ufe0f</span>
        <span class="brand-label">JTP</span>
      </div>

      <!-- Idle state -->
      <div class="rail-idle" id="rail-idle">
        <span class="idle-text">Click JTP to pick a task</span>
      </div>

      <!-- Active timer -->
      <div class="rail-timer" id="rail-timer">
        <span class="pulse-dot"></span>
        <span class="timer-text" id="timer-display">00:00:00</span>
        <span class="divider"></span>
        <span class="task-key" id="active-key"></span>
        <span class="task-summary" id="active-summary"></span>
        <span class="time-estimate" id="active-estimate" style="display:none"></span>
        <span class="epic-badge" id="active-epic" style="display:none">\u26a1 <span id="active-epic-text"></span></span>
        <button class="stop-btn" id="stop-btn">\u23f9 Stop</button>
      </div>

      <!-- Meeting chip (right) -->
      <div class="meeting-chip" id="meeting-chip">
        <span class="chip-badge" id="meeting-badge">\ud83d\udcc5 In 15m</span>
        <span class="chip-title" id="meeting-title"></span>
        <button class="chip-link" id="meeting-link-btn">\u25b6 Link</button>
        <button class="chip-dismiss" id="meeting-dismiss">\u00d7</button>
      </div>

      <!-- Hide rail -->
      <button class="rail-hide" id="rail-hide" title="Minimize">\u2304</button>
    </div>

    <!-- Task row (inline, search + chips) -->
    <div class="task-row" id="task-row">
      <input class="task-search" id="task-search" type="text" placeholder="\u{1F50D} Type key or summary to filter..." autocomplete="off" />
      <div class="task-row-list" id="task-list"></div>
    </div>

    <!-- Log form -->
    <div class="bar-log" id="bar-log">
      <span class="log-issue" id="log-issue-key"></span>
      <input type="text" id="log-time" placeholder="1h 30m" />
      <textarea id="log-desc" placeholder="What did you work on?"></textarea>
      <button class="btn-discard" id="btn-discard">Discard</button>
      <button class="btn-log" id="btn-log">\u2728 Log</button>
      <span class="log-status" id="log-status"></span>
    </div>
  </div>

  <!-- Mini pill (shown when rail hidden) -->
  <div class="mini-pill" id="mini-pill">
    <span class="mp-icon">\u23f1\ufe0f</span>
    <span class="mp-timer" id="mini-timer"></span>
    <span class="mp-divider"></span>
    <span class="mp-week" id="mini-week">0h</span>
  </div>

  <!-- Success toast -->
  <div class="log-toast" id="log-toast">
    <span class="toast-icon">\u2705</span>
    <span class="toast-text">Time logged successfully!</span>
  </div>

`;

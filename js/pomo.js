// ── Settings (loaded immediately so timer shows correct time) ──
let pFocusMin = Math.min(180, Math.max(1, parseInt(localStorage.getItem('pomo_focus')) || 25));
let pBreakMin = Math.min(60,  Math.max(1, parseInt(localStorage.getItem('pomo_break')) || 5));
let pS = pFocusMin * 60, pT = pFocusMin * 60, pB = false, pR = false, pI = null;
let pLastStartedAt = null;

function pSaveSettings() {
  localStorage.setItem('pomo_focus', pFocusMin);
  localStorage.setItem('pomo_break', pBreakMin);
}

// ── Daily goal ─────────────────────────────────────────────────
function pGetGoal()    { return parseInt(localStorage.getItem('pomo_goal')) || 0; }
function pSetGoal(n)   { localStorage.setItem('pomo_goal', n || 0); pRenderGoal(); }

function pGetDoneToday() {
  if (localStorage.getItem('pomo_goal_date') !== today()) {
    localStorage.setItem('pomo_goal_date', today());
    localStorage.setItem('pomo_done_today', '0');
    return 0;
  }
  return parseInt(localStorage.getItem('pomo_done_today')) || 0;
}

function pIncDone() {
  pGetDoneToday();
  const n = (parseInt(localStorage.getItem('pomo_done_today')) || 0) + 1;
  localStorage.setItem('pomo_done_today', String(n));
  localStorage.setItem('pomo_goal_date', today());
  return n;
}

function pRenderGoal() {
  const el = $('p-goal-display'); if (!el) return;
  const goal = pGetGoal(), done = pGetDoneToday();
  if (!goal) { el.style.display = 'none'; return; }
  el.style.display = '';
  const dots = Array.from({length: Math.min(goal, 20)}, (_, i) =>
    `<div style="width:8px;height:8px;border-radius:50%;background:${i < done ? 'var(--acc)' : 'var(--bg4)'}"></div>`).join('');
  el.innerHTML = done >= goal
    ? `<div style="font-size:12px;font-weight:600;color:var(--acc);margin-bottom:5px">✓ Goal reached — ${done} session${done > 1 ? 's' : ''} done</div><div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">${dots}</div>`
    : `<div style="font-size:12px;color:var(--tx2);margin-bottom:5px">${done} of ${goal} sessions done</div><div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">${dots}</div>`;
}

// ── Title helper ───────────────────────────────────────────────
function getAppTitle() {
  const n = S?.profile?.name;
  return n ? n + "’s Dashboard" : 'Student Dashboard';
}

// ── Timer rendering ────────────────────────────────────────────
function pRen() {
  const mm = String(Math.floor(pS / 60)).padStart(2, '0');
  const ss = String(pS % 60).padStart(2, '0');
  $('p-time').textContent = mm + ':' + ss;
  $('p-bar').style.width = Math.round(pS / pT * 100) + '%';
  document.title = pR ? mm + ':' + ss + ' · ' + getAppTitle() : getAppTitle();
}

// ── Session complete ───────────────────────────────────────────
function pSessionComplete() {
  pR = false;
  $('p-start').innerHTML = '&#9654; Start';
  document.title = getAppTitle();
  if (Notification.permission === 'granted') {
    new Notification(pB ? 'Break over! Time to focus.' : 'Focus session complete! Take a break.', {icon: '🎸'});
  }
  if (!pB) {
    pIncDone();
    pRenderGoal();
    showPostSession();
    spawnConfetti();
  }
}

// ── Post-session card ──────────────────────────────────────────
let pPendingSession = null;

function showPostSession() {
  pPendingSession = {
    started_at: pLastStartedAt || new Date().toISOString(),
    duration_min: pFocusMin,
    break_duration_min: pBreakMin,
    task_id: null,
    course_id: null,
    notes: ''
  };
  const cSel = $('ps-course');
  if (cSel) cSel.innerHTML = '<option value="">No course</option>' +
    (S.courses || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const tSel = $('ps-task');
  if (tSel) tSel.innerHTML = '<option value="">No task</option>' +
    (S.tasks || []).filter(t => !t.done).map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  const ni = $('ps-notes'); if (ni) ni.value = '';
  const el = $('p-postsession'); if (el) el.style.display = '';
}

async function savePomoSession() {
  if (!pPendingSession) return;
  const cv = $('ps-course')?.value, tv = $('ps-task')?.value;
  pPendingSession.course_id = cv ? parseInt(cv) : null;
  pPendingSession.task_id   = tv ? parseInt(tv) : null;
  pPendingSession.notes     = $('ps-notes')?.value.trim() || '';
  const row = await dbInsert('pomo_sessions', pPendingSession);
  if (row && S.pomoSessions) S.pomoSessions.unshift(row);
  pPendingSession = null;
  const el = $('p-postsession'); if (el) el.style.display = 'none';
  renderPomoLog();
}

async function skipPomoSession() {
  if (!pPendingSession) return;
  const row = await dbInsert('pomo_sessions', pPendingSession);
  if (row && S.pomoSessions) S.pomoSessions.unshift(row);
  pPendingSession = null;
  const el = $('p-postsession'); if (el) el.style.display = 'none';
  renderPomoLog();
}

// ── Timer controls ─────────────────────────────────────────────
function pomoSS() {
  if (pR) {
    clearInterval(pI); pR = false;
    $('p-start').innerHTML = '&#9654; Start';
    document.title = getAppTitle();
  } else {
    pLastStartedAt = new Date().toISOString();
    pR = true;
    $('p-start').innerHTML = '&#9646;&#9646; Pause';
    pI = setInterval(function() {
      if (pS <= 0) { clearInterval(pI); pSessionComplete(); return; }
      pS--; pRen();
    }, 1000);
    if (Notification.permission === 'default') Notification.requestPermission();
  }
}

function pomoReset() {
  clearInterval(pI); pR = false; pS = pT;
  $('p-start').innerHTML = '&#9654; Start';
  document.title = getAppTitle();
  const pe = $('p-postsession'); if (pe) pe.style.display = 'none';
  pPendingSession = null;
  pRen();
}

function pomoMode() {
  pB = !pB; clearInterval(pI); pR = false;
  pT = pB ? pBreakMin * 60 : pFocusMin * 60; pS = pT;
  $('p-lbl').textContent = pB ? 'Break time' : 'Focus session';
  $('p-mode').textContent = pB ? 'Focus mode' : 'Break mode';
  $('p-start').innerHTML = '&#9654; Start';
  document.title = getAppTitle();
  const pe = $('p-postsession'); if (pe) pe.style.display = 'none';
  pPendingSession = null;
  pRen();
}

// ── Settings panel ─────────────────────────────────────────────
function togglePomoSettings() {
  const el = $('p-settings'), ar = $('p-settings-arrow');
  const open = el.style.display === 'none';
  el.style.display = open ? '' : 'none';
  if (ar) ar.textContent = open ? '▼' : '▶';
}

function setPreset(f, b) {
  pFocusMin = f; pBreakMin = b; pSaveSettings();
  const fi = $('p-focus-min'), bi = $('p-break-min');
  if (fi) fi.value = f; if (bi) bi.value = b;
  updatePresetHighlight();
  if (!pR) { pT = pB ? pBreakMin * 60 : pFocusMin * 60; pS = pT; pRen(); }
}

function resetPomoDefaults() { setPreset(25, 5); }

function updatePresetHighlight() {
  document.querySelectorAll('.preset-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.f) === pFocusMin && parseInt(b.dataset.b) === pBreakMin);
  });
}

function onPomoFocusInput(val) {
  const n = Math.min(180, Math.max(1, parseInt(val) || 1));
  pFocusMin = n; pSaveSettings(); updatePresetHighlight();
  if (!pR && !pB) { pT = n * 60; pS = pT; pRen(); }
}

function onPomoBreakInput(val) {
  const n = Math.min(60, Math.max(1, parseInt(val) || 1));
  pBreakMin = n; pSaveSettings(); updatePresetHighlight();
  if (!pR && pB) { pT = n * 60; pS = pT; pRen(); }
}

function onPomoGoalInput(val) {
  pSetGoal(Math.max(0, parseInt(val) || 0));
}

// ── Pomo tabs ──────────────────────────────────────────────────
function pomoTab(tab) {
  $('pt-timer').style.display = tab === 'timer' ? '' : 'none';
  $('pt-log').style.display   = tab === 'log'   ? '' : 'none';
  document.querySelectorAll('.mtab[data-ptab]').forEach(b => b.classList.toggle('active', b.dataset.ptab === tab));
  if (tab === 'log') renderPomoLog();
}

// ── Session log ────────────────────────────────────────────────
let pomoLogLoaded = false;
let pomoLogCourseFilter = '';

async function renderPomoLog() {
  if (!pomoLogLoaded) {
    if (!S.pomoSessions) S.pomoSessions = await dbGet('pomo_sessions', {order: 'started_at', asc: false});
    pomoLogLoaded = true;
  }
  const el = $('p-log-list'); if (!el) return;

  // Populate course filter
  const sel = $('pl-course-filter');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">All courses</option>' +
      (S.courses || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    sel.value = cur;
  }

  let sessions = (S.pomoSessions || []).filter(s => !pomoLogCourseFilter || String(s.course_id) === pomoLogCourseFilter);

  if (!sessions.length) {
    el.innerHTML = '<div class="empty-state" style="padding:12px 0"><div class="es">No sessions logged yet. Complete a focus session to start your log.</div></div>';
    return;
  }

  // Group by date
  const groups = {};
  sessions.forEach(s => {
    const d = s.started_at?.slice(0, 10) || today();
    if (!groups[d]) groups[d] = [];
    groups[d].push(s);
  });

  el.innerHTML = Object.entries(groups).map(([date, sess]) => {
    const totalMin = sess.reduce((a, s) => a + (s.duration_min || 0), 0);
    const rows = sess.map(s => {
      const course = s.course_id ? (S.courses || []).find(c => c.id === s.course_id)?.name : null;
      const task   = s.task_id   ? (S.tasks   || []).find(t => t.id === s.task_id)?.name   : null;
      const label  = course || task;
      const time   = s.started_at ? new Date(s.started_at).toLocaleTimeString('en-CA', {hour:'2-digit', minute:'2-digit'}) : '';
      return `<div class="trow" style="font-size:12px;gap:8px">
        <span style="color:var(--tx3);flex-shrink:0;width:44px">${time}</span>
        <span style="font-weight:500;flex-shrink:0">${s.duration_min || 0} min</span>
        ${label ? `<span class="chip">${esc(label)}</span>` : '<span></span>'}
        <span style="flex:1;color:var(--tx2);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.notes || '')}</span>
      </div>`;
    }).join('');

    return `<div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin-bottom:6px;display:flex;justify-content:space-between">
        <span>${fmt(date)}</span>
        <span>${sess.length} session${sess.length > 1 ? 's' : ''} · ${totalMin} min</span>
      </div>${rows}</div>`;
  }).join('');
}

// ── Init (called from onSignIn) ────────────────────────────────
function initPomo() {
  pFocusMin = Math.min(180, Math.max(1, parseInt(localStorage.getItem('pomo_focus')) || 25));
  pBreakMin = Math.min(60,  Math.max(1, parseInt(localStorage.getItem('pomo_break')) || 5));
  if (!pR) { pT = pB ? pBreakMin * 60 : pFocusMin * 60; pS = pT; }

  const fi = $('p-focus-min'), bi = $('p-break-min');
  if (fi) fi.value = pFocusMin; if (bi) bi.value = pBreakMin;
  const gi = $('p-goal-input'); if (gi) gi.value = pGetGoal() || '';

  updatePresetHighlight();
  pRenderGoal();
  pRen();
  document.title = getAppTitle();
}

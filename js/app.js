// ── Helpers ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const addD = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const fmt = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month:'short', day:'numeric' }) : '';
const dfn = d => Math.round((new Date(d + 'T12:00:00') - new Date(new Date().toDateString())) / 86400000);
const getLast = n => Array.from({ length:n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n-1-i)); return d.toISOString().slice(0, 10); });

// ── Modals ────────────────────────────────────────────────────
function openM(id) { $(id).classList.add('open'); }
function closeM(id) { $(id).classList.remove('open'); }
document.querySelectorAll('.mbg').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

// ── Theme ─────────────────────────────────────────────────────
function toggleTheme() {
  const h = document.documentElement, dark = h.getAttribute('data-theme') === 'dark';
  const next = dark ? 'light' : 'dark';
  h.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  $('theme-btn').textContent = dark ? '🌙 Dark mode' : '☀️ Light mode';
  setTimeout(drawViz, 60);
}

// ── Tabs ──────────────────────────────────────────────────────
const TABS = ['home', 'tasks', 'academics', 'money', 'habits'];
function goTab(t) {
  TABS.forEach((n, i) => {
    document.querySelectorAll('.sbn')[i].classList.toggle('active', n === t);
    $('sec-' + n).classList.toggle('active', n === t);
  });
  renderAll();
}

// ── Keyboard shortcuts ────────────────────────────────────────
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { document.querySelectorAll('.mbg.open').forEach(m => m.classList.remove('open')); return; }
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openM('m-task'); setTimeout(() => $('t-name').focus(), 50); }
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); openHabitModal(); }
    if (e.key === '/') { e.preventDefault(); goTab('tasks'); setTimeout(() => $('task-search').focus(), 50); }
    if (e.key === '1') goTab('home');
    if (e.key === '2') goTab('tasks');
    if (e.key === '3') goTab('academics');
    if (e.key === '4') goTab('money');
    if (e.key === '5') goTab('habits');
  });
}

// ── Quick add ─────────────────────────────────────────────────
function initQA() {
  $('qa-input').addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    const name = $('qa-input').value.trim(); if (!name) return;
    const row = await dbInsert('tasks', { name, priority:'Med', tag:'personal', due_date:today(), done:false });
    if (row) { S.tasks.unshift(row); $('qa-input').value = ''; renderTasks(); renderHome(); }
  });
}

// ── Profile ───────────────────────────────────────────────────
const PE = ['🎸','🎵','🎹','🎤','🏃','💪','🧠','📚','💻','🎯','🌙','⚡','🔥','🌿','🎨','🐉','🦊','🌊','🚀','✨','🎮','🏀','⚽','🎲','🥋'];
let pEm = '';
function openProfile() {
  pEm = S.profile.avatar || '🎸';
  $('p-name').value = S.profile.name || '';
  $('p-emojis').innerHTML = PE.map(e => `<span class="ep${e === pEm ? ' on' : ''}" onclick="pickPE('${e}',this)">${e}</span>`).join('');
  openM('m-profile');
}
function pickPE(e, el) { pEm = e; $('p-emojis').querySelectorAll('.ep').forEach(x => x.classList.remove('on')); el.classList.add('on'); }
async function saveProfile() {
  const name = $('p-name').value.trim(); if (!name) return;
  S.profile = { name, avatar: pEm };
  await db.from('profile').upsert({ user_id: S.userId, name, avatar: pEm }, { onConflict: 'user_id' });
  applyProfile(); closeM('m-profile');
}
function applyProfile() { $('sb-nm').textContent = S.profile.name || 'Jazz'; $('sb-av').textContent = S.profile.avatar || '🎸'; }

// ── Home ──────────────────────────────────────────────────────
function renderHome() {
  const t = today();
  const due = S.tasks.filter(tk => !tk.done && tk.due_date && tk.due_date >= t && tk.due_date <= addD(t, 7)).length;
  const inc = S.transactions.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const sp = Math.abs(S.transactions.filter(x => x.amount < 0).reduce((a, x) => a + x.amount, 0));
  const grades = S.courses.map(c => caEffGrade(c.id, S.assignments.filter(a => a.course_id === c.id))).filter(g => g != null);
  const avg = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;

  $('hm-due').textContent = due;
  $('hm-inc').textContent = '$' + inc.toFixed(0);
  $('hm-rem').textContent = '$' + (inc - sp).toFixed(0);
  $('hm-avg').textContent = avg != null ? avg.toFixed(1) + '%' : '—';

  const tb = $('task-badge'); const open = S.tasks.filter(t => !t.done).length;
  tb.textContent = open; tb.style.display = open ? 'inline' : 'none';

  // Deadlines
  const dl = [];
  S.tasks.filter(tk => !tk.done && tk.due_date).forEach(tk => { const n = dfn(tk.due_date); if (n >= -1 && n <= 14) dl.push({ name: tk.name, date: tk.due_date, tag: tk.tag }); });
  S.assignments.filter(a => !isAssignLogicallyDone(a) && a.due_date).forEach(a => { const n = dfn(a.due_date); if (n >= -1 && n <= 14) dl.push({ name: a.name, date: a.due_date, tag: 'academics', cid: a.course_id, isTest: typeof getAssignType === 'function' && getAssignType(a) === 'test' }); });
  dl.sort((a, b) => a.date.localeCompare(b.date));
  $('hm-dl').innerHTML = dl.length ? dl.slice(0, 6).map(d => {
    const n = dfn(d.date), dc = n <= 0 ? 'dr' : n <= 3 ? 'da' : 'dg';
    const cDot = d.cid && typeof getCourseColor === 'function' ? `<div style="width:7px;height:7px;border-radius:50%;background:${getCourseColor(d.cid)};flex-shrink:0"></div>` : '';
    const testLabel = d.isTest ? `<span style="font-size:9px;font-weight:700;background:var(--bg3);color:var(--tx2);border-radius:3px;padding:1px 5px;flex-shrink:0;letter-spacing:.3px">TEST</span>` : '';
    return `<div class="row"><div class="dot ${dc}"></div>${cDot}${testLabel}<span style="flex:1">${esc(d.name)}</span><span class="chip">${esc(d.tag)}</span><span style="font-size:11px;color:var(--tx2)">${n === 0 ? 'Today' : fmt(d.date)}</span></div>`;
  }).join('') : '<div class="empty-state"><div class="ei">🗓️</div><div class="et">All clear</div><div class="es">No deadlines in the next 2 weeks</div></div>';

  // Today tasks
  const tt = S.tasks.filter(tk => tk.due_date === t);
  $('hm-tasks').innerHTML = tt.length ? tt.map(tk => `
    <div class="row">
      <div class="ck${tk.done ? ' on' : ''}" onclick="toggleTask(${tk.id});renderHome()"></div>
      <span class="${tk.done ? 'strike' : ''}" style="flex:1">${esc(tk.name)}</span>
      <span class="badge ${tk.priority === 'High' ? 'ph' : tk.priority === 'Med' ? 'pm' : 'pl'}">${tk.priority}</span>
    </div>`).join('') : '<div class="empty-state" style="padding:12px 0"><div class="es">No tasks due today</div></div>';

  // Habits
  $('hm-habits').innerHTML = S.habits.length ? S.habits.map(h => {
    const done = S.habitLogs.some(l => l.habit_id === h.id && l.log_date === t);
    return `<div class="row"><div class="ck${done ? ' on' : ''}" onclick="toggleHabit(${h.id});renderHome()"></div><span style="flex:1">${h.emoji} ${esc(h.name)}</span><span style="font-size:11px;color:var(--tx2)">🔥 ${h.streak || 0}</span></div>`;
  }).join('') : '<div class="empty-state" style="padding:12px 0"><div class="es">Add habits in the Habits tab</div></div>';

  // Viz
  const viz = $('hm-viz');
  if (S.habits.length) { viz.style.display = 'block'; setTimeout(() => { drawLineChart('hm-line', 100); buildHeatmap($('hm-heatmap'), getOverallLog(), S.habits.length); }, 60); }
  else viz.style.display = 'none';
}

// ── Confetti ──────────────────────────────────────────────────
function spawnConfetti() {
  const wrap = $('confetti-wrap'); wrap.innerHTML = '';
  const colors = ['#6c63ff','#4caf7d','#e8a838','#e05c5c','#4a90d9','#a09df7'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div'); el.className = 'cp';
    el.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${1+Math.random()*2}s;animation-delay:${Math.random()*.5}s;width:${6+Math.random()*6}px;height:${6+Math.random()*6}px;border-radius:${Math.random()>.5?'50%':'2px'}`;
    wrap.appendChild(el);
  }
  setTimeout(() => wrap.innerHTML = '', 3000);
}

// ── Render all ────────────────────────────────────────────────
function renderAll() { renderHome(); renderTasks(); renderAcademics(); renderMoney(); renderHabits(); }

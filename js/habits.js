const HE = ['🎸','🎵','📚','💪','🧘','🏃','💧','🥗','😴','✍️','🎯','🧠','🌿','☀️','🎨','🎮','📖','🏋️','🚴','🎹','🥋','🧹','💊','🪴','🎤'];
let hEm = '🎯';

function openHabitModal() {
  hEm = '🎯';
  $('h-name').value = '';
  $('h-emojis').innerHTML = HE.map(e => `<span class="ep${e === hEm ? ' on' : ''}" onclick="pickHE('${e}',this)">${e}</span>`).join('');
  openM('m-habit');
}

function pickHE(e, el) {
  hEm = e;
  $('h-emojis').querySelectorAll('.ep').forEach(x => x.classList.remove('on'));
  el.classList.add('on');
}

async function saveHabit() {
  const name = $('h-name').value.trim(); if (!name) return;
  const row = await dbInsert('habits', { name, emoji: hEm, streak: 0 });
  if (row) { S.habits.push(row); closeM('m-habit'); renderHabits(); renderHome(); }
}

async function toggleHabit(id) {
  const h = S.habits.find(h => h.id === id); if (!h) return;
  const t = today();
  const existing = S.habitLogs.find(l => l.habit_id === id && l.log_date === t);

  if (existing) {
    await dbDelete('habit_logs', existing.id);
    S.habitLogs = S.habitLogs.filter(l => l.id !== existing.id);
  } else {
    const row = await dbInsert('habit_logs', { habit_id: id, log_date: t });
    if (row) S.habitLogs.push(row);
  }

  // Recalc streak
  let streak = 0, d = new Date();
  const hasToday = S.habitLogs.some(l => l.habit_id === id && l.log_date === d.toISOString().slice(0, 10));
  if (!hasToday) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    const k = d.toISOString().slice(0, 10);
    if (S.habitLogs.some(l => l.habit_id === id && l.log_date === k)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  h.streak = streak;
  await dbUpdate('habits', id, { streak });

  // Confetti if all done
  if (S.habits.length > 0 && S.habits.every(h => S.habitLogs.some(l => l.habit_id === h.id && l.log_date === t))) spawnConfetti();

  renderHabits(); renderHome();
}

async function deleteHabit(id) {
  await dbDelete('habits', id);
  S.habits = S.habits.filter(h => h.id !== id);
  S.habitLogs = S.habitLogs.filter(l => l.habit_id !== id);
  renderHabits(); renderHome();
}

function renderHabits() {
  const t = today(), grid = $('habit-grid'), empty = $('habit-empty'), viz = $('habit-viz'), lbl = $('h-lbl');
  if (!grid) return;
  if (!S.habits.length) { grid.innerHTML = ''; empty.style.display = 'block'; viz.style.display = 'none'; if (lbl) lbl.textContent = 'Track your daily habits.'; return; }
  empty.style.display = 'none'; viz.style.display = 'block';
  const doneCount = S.habits.filter(h => S.habitLogs.some(l => l.habit_id === h.id && l.log_date === t)).length;
  if (lbl) lbl.textContent = `${doneCount} / ${S.habits.length} done today`;
  const last7 = getLast(7);
  grid.innerHTML = S.habits.map(h => {
    const isDone = S.habitLogs.some(l => l.habit_id === h.id && l.log_date === t);
    const hot = (h.streak || 0) >= 3;
    return `<div class="hcard${isDone ? ' done' : ''}" onclick="toggleHabit(${h.id})">
      <button class="xb hdel" onclick="event.stopPropagation();deleteHabit(${h.id})">✕</button>
      <div class="hemoji">${h.emoji}</div>
      <div class="hname">${esc(h.name)}</div>
      <div class="hstreak${hot ? ' hot' : ''}">🔥 ${h.streak || 0} day streak</div>
      <div class="wdots">${last7.map(d => `<div class="wd${S.habitLogs.some(l => l.habit_id === h.id && l.log_date === d) ? ' on' : ''}"></div>`).join('')}</div>
      <div class="hchk">${isDone ? '✓' : ''}</div>
    </div>`;
  }).join('');
  setTimeout(drawViz, 60);
}

// ── Visualizations ────────────────────────────────────────────
function getOverallLog() {
  const log = {};
  getLast(90).forEach(d => {
    const cnt = S.habits.filter(h => S.habitLogs.some(l => l.habit_id === h.id && l.log_date === d)).length;
    if (cnt > 0) log[d] = cnt;
  });
  return log;
}

function drawLineChart(cid, H) {
  const canvas = $(cid); if (!canvas || !S.habits.length) return;
  const W = canvas.parentElement.offsetWidth || 340; H = H || 120;
  canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d'); ctx.scale(devicePixelRatio, devicePixelRatio); ctx.clearRect(0, 0, W, H);
  const days = getLast(30);
  const rates = days.map(d => {
    const done = S.habits.filter(h => S.habitLogs.some(l => l.habit_id === h.id && l.log_date === d)).length;
    return S.habits.length ? done / S.habits.length : 0;
  });
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const tc = dark ? '#8080a0' : '#72728a', gc = dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)';
  const pad = { t:6, r:6, b:20, l:26 }, cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  [0, .5, 1].forEach(v => {
    const y = pad.t + ch * (1 - v);
    ctx.strokeStyle = gc; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
    ctx.fillStyle = tc; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'right'; ctx.fillText(Math.round(v * 100) + '%', pad.l - 3, y + 3);
  });
  days.forEach((d, i) => {
    if (i % 5 === 0) { const x = pad.l + i * (cw / (days.length - 1)); ctx.fillStyle = tc; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month:'short', day:'numeric' }), x, H - 3); }
  });
  const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch); g.addColorStop(0, 'rgba(108,99,255,.28)'); g.addColorStop(1, 'rgba(108,99,255,0)');
  ctx.beginPath(); rates.forEach((r, i) => { const x = pad.l + i * (cw / (rates.length - 1)), y = pad.t + ch * (1 - r); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.lineTo(pad.l + cw, pad.t + ch); ctx.lineTo(pad.l, pad.t + ch); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.strokeStyle = '#6c63ff'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  rates.forEach((r, i) => { const x = pad.l + i * (cw / (rates.length - 1)), y = pad.t + ch * (1 - r); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); ctx.stroke();
  rates.forEach((r, i) => { const x = pad.l + i * (cw / (rates.length - 1)), y = pad.t + ch * (1 - r); ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#6c63ff'; ctx.fill(); ctx.strokeStyle = dark ? '#18181f' : '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); });
}

function drawBarChart() {
  const canvas = $('viz-bar'); if (!canvas || !S.habits.length) return;
  const W = canvas.parentElement.offsetWidth || 340, H = 120;
  canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d'); ctx.scale(devicePixelRatio, devicePixelRatio); ctx.clearRect(0, 0, W, H);
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const tc = dark ? '#8080a0' : '#72728a', gc = dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)';
  const counts = S.habits.map(h => S.habitLogs.filter(l => l.habit_id === h.id).length);
  const maxC = Math.max(...counts, 1);
  const pad = { t:8, r:6, b:26, l:24 }, cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const bw = Math.min(28, (cw / S.habits.length) * .55), gap = cw / S.habits.length;
  const cols = ['#6c63ff','#4a90d9','#3da870','#d4890a','#d95050','#a09df7'];
  [0, .5, 1].forEach(v => { const y = pad.t + ch * (1 - v); ctx.strokeStyle = gc; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke(); ctx.fillStyle = tc; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'right'; ctx.fillText(Math.round(v * maxC), pad.l - 3, y + 3); });
  S.habits.forEach((h, i) => {
    const x = pad.l + gap * i + (gap - bw) / 2, bh = (counts[i] / maxC) * ch, y = pad.t + ch - bh;
    ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); const rr = 3;
    ctx.moveTo(x + rr, y); ctx.lineTo(x + bw - rr, y); ctx.quadraticCurveTo(x + bw, y, x + bw, y + rr); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x, y + bh); ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = tc; ctx.font = '11px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(h.emoji, x + bw / 2, H - 6);
    if (counts[i]) ctx.fillText(counts[i], x + bw / 2, y - 3);
  });
}

function buildHeatmap(container, logObj, maxVal) {
  if (!container) return;
  const now = new Date(), start = new Date(now); start.setDate(start.getDate() - 89); start.setDate(start.getDate() - start.getDay());
  const weeks = [], d = new Date(start);
  while (d <= now) { const week = []; for (let i = 0; i < 7; i++) { week.push(new Date(d)); d.setDate(d.getDate() + 1); } weeks.push(week); }
  const ml = weeks.map(w => w[0].getDate() <= 7 ? w[0].toLocaleDateString('en-CA', { month:'short' }) : '');
  const mv = maxVal || Math.max(...Object.values(logObj).map(v => typeof v === 'number' ? v : 1), 1);
  let h = `<div class="hm-wrap"><div class="hm-outer"><div class="hm-labels">`;
  ['S','M','T','W','T','F','S'].forEach(l => h += `<div class="hm-lbl">${l}</div>`);
  h += `</div><div><div class="hm-months">`;
  ml.forEach(l => h += `<div style="width:14px;text-align:center">${l}</div>`);
  h += `</div><div class="hm-cols">`;
  weeks.forEach(week => {
    h += `<div class="hm-col">`;
    week.forEach(day => {
      const k = day.toISOString().slice(0, 10), fut = day > now; let lvl = 0;
      if (!fut && logObj[k]) { const v = typeof logObj[k] === 'number' ? logObj[k] / mv : 1; lvl = v >= .75 ? 4 : v >= .5 ? 3 : v >= .25 ? 2 : 1; }
      h += `<div class="hm-cell${lvl ? ' l' + lvl : ''}" title="${day.toLocaleDateString('en-CA', { month:'short', day:'numeric' })}"></div>`;
    });
    h += `</div>`;
  });
  h += `</div></div></div></div>`;
  container.innerHTML = h;
}

function drawViz() {
  if (!S.habits.length) return;
  drawLineChart('viz-line', 120);
  drawBarChart();
  buildHeatmap($('viz-heatmap'), getOverallLog(), S.habits.length);
}

// ── Per-course calculator state ────────────────────────────────
const CA_PRE = 'ca_';

function caLoad(cid) {
  try { return JSON.parse(localStorage.getItem(CA_PRE + cid)) || { mode: 'weighted', target: 80, asgn: {} }; }
  catch { return { mode: 'weighted', target: 80, asgn: {} }; }
}
function caSave(cid, data) { try { localStorage.setItem(CA_PRE + cid, JSON.stringify(data)); } catch {} }

function caSetMode(cid, mode) {
  const d = caLoad(cid); d.mode = mode; caSave(cid, d); renderAcademics();
}

function caSetTarget(cid, val) {
  const d = caLoad(cid); d.target = parseFloat(val) || 0; caSave(cid, d); caRefresh(cid);
}

function caSetScore(cid, aid, val) {
  const d = caLoad(cid);
  if (!d.asgn[aid]) d.asgn[aid] = {};
  const n = parseFloat(val);
  if (isNaN(n)) delete d.asgn[aid].score; else d.asgn[aid].score = n;
  caSave(cid, d); caRefresh(cid);
}

function caSetMax(cid, aid, val) {
  const d = caLoad(cid);
  if (!d.asgn[aid]) d.asgn[aid] = {};
  const n = parseFloat(val);
  d.asgn[aid].max = isNaN(n) ? 100 : n;
  caSave(cid, d); caRefresh(cid);
}

function caScoreBlur(cid) {
  const assigns = S.assignments.filter(a => a.course_id === cid);
  const g = caEffGrade(cid, assigns);
  if (g != null) { ghAppend(cid, g); renderAcaMeta(); }
}

function caCalc(cid, assigns) {
  const data = caLoad(cid), asgn = data.asgn || {}, target = data.target ?? 80;
  const completed = assigns.filter(a => a.status === 'done').map(a => ({
    score: asgn[a.id]?.score,
    max: asgn[a.id]?.max ?? 100,
    weight: parseFloat(a.weight) || 0
  }));
  const remaining = assigns.filter(a => a.status !== 'done').map(a => ({
    id: a.id,
    max: asgn[a.id]?.max ?? 100,
    weight: parseFloat(a.weight) || 0
  }));
  return data.mode === 'points'
    ? gcCalcP({ completed, remaining, target })
    : gcCalcW({ completed, remaining, target });
}

function caEffGrade(cid, assigns) {
  const data = caLoad(cid), asgn = data.asgn || {};
  const hasDoneWithScore = assigns.some(a => a.status === 'done' && asgn[a.id]?.score != null);
  if (!hasDoneWithScore) return S.courses.find(c => c.id === cid)?.grade ?? null;
  return caCalc(cid, assigns).currentGrade;
}

function caRefresh(cid) {
  const assigns = S.assignments.filter(a => a.course_id === cid);
  const data = caLoad(cid);
  const res = caCalc(cid, assigns);

  const proj = document.getElementById(`ca-proj-${cid}`);
  if (proj) proj.innerHTML = caProjInner(res, data, assigns);

  const isW = data.mode === 'weighted';
  const totalW = assigns.reduce((s, a) => s + (parseFloat(a.weight) || 0), 0);
  const warn = document.getElementById(`ca-warn-${cid}`);
  if (warn) {
    const show = isW && assigns.length > 0 && Math.abs(totalW - 100) > 0.5;
    warn.style.display = show ? '' : 'none';
    if (show) warn.textContent = `⚠ Weights total ${totalW.toFixed(1)}% — should add up to 100%.`;
  }

  const per = res.per || [];
  assigns.filter(a => a.status !== 'done').forEach(a => {
    const el = document.getElementById(`ca-need-${a.id}`);
    if (!el) return;
    const entry = per.find(p => p.id === a.id);
    if (!entry || entry.neededPct == null) { el.textContent = ''; return; }
    if (res.status === 'guaranteed') { el.textContent = '✓'; el.style.color = 'var(--green)'; }
    else if (res.status === 'impossible') { el.textContent = '✗'; el.style.color = 'var(--red)'; }
    else { el.textContent = `→ ${entry.neededPct.toFixed(0)}%`; el.style.color = 'var(--tx2)'; }
  });
}

function caProjInner(res, data, assigns) {
  if (assigns.length === 0) return '<div style="font-size:12px;color:var(--tx3);padding:6px 0">Add assignments to see grade projections.</div>';
  const pct = v => v != null ? v.toFixed(1) + '%' : '—';
  const { status, best, worst, reqPct } = res;
  const hasDoneData = res.mode === 'weighted' ? (res.cW || 0) > 0 : (res.cMax || 0) > 0;
  const cur = hasDoneData ? pct(res.currentGrade) : '—';
  const reqVal = status === 'guaranteed' ? '✓' : status === 'impossible' ? '> 100%' : pct(reqPct);
  const reqColor = status === 'impossible' ? 'var(--red)' : status === 'guaranteed' ? 'var(--green)' : '';
  const worstBad = (worst ?? 0) < (data.target ?? 80);
  const banner = status === 'guaranteed'
    ? `<div style="background:var(--fgreen);color:var(--green);border-radius:var(--r);padding:6px 10px;font-size:12px;margin-top:6px;font-weight:500">✓ Target already guaranteed</div>`
    : status === 'impossible'
    ? `<div style="background:var(--fred);color:var(--red);border-radius:var(--r);padding:6px 10px;font-size:12px;margin-top:6px;font-weight:500">✗ Target not reachable</div>`
    : '';
  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 4px">
    <div style="text-align:center"><div style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:3px">Current</div><div style="font-size:17px;font-weight:700">${cur}</div></div>
    <div style="text-align:center"><div style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:3px">Need avg</div><div style="font-size:17px;font-weight:700${reqColor ? ';color:' + reqColor : ''}">${reqVal}</div></div>
    <div style="text-align:center"><div style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:3px">Best</div><div style="font-size:17px;font-weight:700;color:var(--green)">${pct(best)}</div></div>
    <div style="text-align:center"><div style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:3px">Worst</div><div style="font-size:17px;font-weight:700${worstBad ? ';color:var(--red)' : ''}">${pct(worst)}</div></div>
  </div>${banner}`;
}

// ── Course CRUD ────────────────────────────────────────────────
async function saveCourse() {
  const name = $('c-name').value.trim(); if (!name) return;
  const g = parseFloat($('c-grade').value);
  const row = await dbInsert('courses', { name, grade: isNaN(g) ? null : g, notes: '' });
  if (row) { S.courses.push(row); closeM('m-course'); $('c-name').value = ''; $('c-grade').value = ''; renderAcademics(); }
}

async function deleteCourse(id) {
  await dbDelete('courses', id);
  S.courses = S.courses.filter(c => c.id !== id);
  S.assignments = S.assignments.filter(a => a.course_id !== id);
  renderAcademics(); renderHome();
}

async function updateGrade(id, v) {
  const c = S.courses.find(c => c.id === id); if (!c) return;
  c.grade = v === '' ? null : parseFloat(v);
  await dbUpdate('courses', id, { grade: c.grade });
  renderAcaMeta();
}

async function updateNotes(id, v) {
  const c = S.courses.find(c => c.id === id); if (!c) return;
  c.notes = v;
  await dbUpdate('courses', id, { notes: v });
}

// ── Assignment CRUD ────────────────────────────────────────────
function openAssign(cid) {
  $('a-name').value = ''; $('a-date').value = ''; $('a-status').value = 'todo'; $('a-weight').value = ''; $('a-cid').value = cid;
  openM('m-assign');
}

async function saveAssign() {
  const name = $('a-name').value.trim(); if (!name) return;
  const cid = parseInt($('a-cid').value);
  const wv = $('a-weight').value;
  const weight = wv !== '' ? parseFloat(wv) : null;
  const row = await dbInsert('assignments', { course_id: cid, name, due_date: $('a-date').value || null, status: $('a-status').value, weight });
  if (row) { S.assignments.push(row); closeM('m-assign'); renderAcademics(); }
}

async function updateAssignWeight(aid, v) {
  const a = S.assignments.find(a => a.id === aid); if (!a) return;
  a.weight = v === '' ? null : parseFloat(v);
  await dbUpdate('assignments', aid, { weight: a.weight });
  caRefresh(a.course_id);
}

async function cycleStatus(aid) {
  const a = S.assignments.find(a => a.id === aid); if (!a) return;
  const order = ['todo', 'ip', 'done'];
  a.status = order[(order.indexOf(a.status) + 1) % 3];
  await dbUpdate('assignments', aid, { status: a.status });
  renderAcademics(); renderHome();
}

async function delAssign(aid) {
  await dbDelete('assignments', aid);
  S.assignments = S.assignments.filter(a => a.id !== aid);
  renderAcademics();
}

// ── Meta header ────────────────────────────────────────────────
function renderAcaMeta() {
  const grades = S.courses.map(c => caEffGrade(c.id, S.assignments.filter(a => a.course_id === c.id))).filter(g => g != null);
  const avg = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
  $('ac-avg').textContent = avg != null ? avg.toFixed(1) + '%' : '—';
  $('ac-bar').style.width = (avg ?? 0) + '%';
  const sp = $('ac-spark'); if (sp) sp.innerHTML = ghGpaSpark();
  const all = S.assignments, done = all.filter(a => a.status === 'done').length;
  $('ac-done').textContent = `${done} / ${all.length}`;
  const weighted = all.filter(a => a.weight != null);
  if (weighted.length) {
    const totalWeight = weighted.reduce((s, a) => s + a.weight, 0);
    const doneWeight = weighted.filter(a => a.status === 'done').reduce((s, a) => s + a.weight, 0);
    $('ac-sub').textContent = totalWeight > 0 ? Math.round(doneWeight / totalWeight * 100) + '% by weight' : '';
  } else {
    $('ac-sub').textContent = all.length ? Math.round(done / all.length * 100) + '% complete' : '';
  }
}

// ── Main render ────────────────────────────────────────────────
function renderAcademics() {
  renderAcaMeta();
  const sl = s => s === 'done' ? 'Done' : s === 'ip' ? 'In progress' : 'To do';
  const sc = s => s === 'done' ? 'sd' : s === 'ip' ? 'si' : 'st2';
  const thS = 'padding:4px 5px;font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;white-space:nowrap';

  const coursesHtml = S.courses.map(c => {
    const assigns = S.assignments.filter(a => a.course_id === c.id);
    const data = caLoad(c.id);
    const isW = data.mode === 'weighted';
    const res = caCalc(c.id, assigns);
    const asgn = data.asgn || {};
    const totalW = assigns.reduce((s, a) => s + (parseFloat(a.weight) || 0), 0);
    const showWarn = isW && assigns.length > 0 && Math.abs(totalW - 100) > 0.5;
    const per = res.per || [];

    const rows = assigns.map(a => {
      const isDone = a.status === 'done';
      const score = asgn[a.id]?.score;
      const max = asgn[a.id]?.max ?? 100;
      const pEntry = per.find(p => p.id === a.id);

      let needText = '', needColor = 'var(--tx2)';
      if (!isDone && pEntry && pEntry.neededPct != null) {
        if (res.status === 'guaranteed') { needText = '✓'; needColor = 'var(--green)'; }
        else if (res.status === 'impossible') { needText = '✗'; needColor = 'var(--red)'; }
        else { needText = `→ ${pEntry.neededPct.toFixed(0)}%`; }
      }

      const scoreCell = isDone
        ? `<input type="number" min="0" value="${score ?? ''}" placeholder="—"
            style="width:52px;text-align:center;font-size:12px;padding:3px 5px"
            oninput="caSetScore(${c.id},${a.id},this.value)"
            onblur="caScoreBlur(${c.id})"/>`
        : `<span id="ca-need-${a.id}" style="font-size:11px;color:${needColor};white-space:nowrap;font-weight:500">${needText}</span>`;

      return `<tr style="border-bottom:0.5px solid var(--bd)">
        <td style="padding:5px 5px;font-size:13px">${esc(a.name)}</td>
        <td style="padding:5px 5px;text-align:center">${scoreCell}</td>
        <td style="padding:5px 5px;text-align:center">
          <input type="number" min="1" value="${max}"
            style="width:52px;text-align:center;font-size:12px;padding:3px 5px"
            oninput="caSetMax(${c.id},${a.id},this.value)"/>
        </td>
        <td style="padding:5px 5px;text-align:center">
          <input type="number" min="0" max="100" value="${a.weight ?? ''}" placeholder="—"
            style="width:46px;text-align:center;font-size:12px;padding:3px 5px"
            oninput="updateAssignWeight(${a.id},this.value)"/>
        </td>
        <td style="padding:5px 5px;text-align:center">
          <span class="badge ${sc(a.status)}" style="cursor:pointer;white-space:nowrap"
            onclick="cycleStatus(${a.id})" title="Click to cycle">${sl(a.status)}</span>
        </td>
        <td style="padding:5px 5px;font-size:11px;color:var(--tx2);white-space:nowrap">${fmt(a.due_date)}</td>
        <td style="padding:5px 5px;text-align:right"><button class="xb" onclick="delAssign(${a.id})">✕</button></td>
      </tr>`;
    }).join('');

    return `<div class="cc">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;min-width:0">
          <span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</span>
          <span style="display:inline-flex;align-items:center;gap:2px;flex-shrink:0" id="gh-sp-${c.id}">${ghInlineSpark(c.id)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">
          <span style="font-size:10px;color:var(--tx2)">Manual</span>
          <input type="number" min="0" max="100" value="${c.grade ?? ''}" placeholder="—"
            style="width:52px;text-align:center;font-weight:600;font-size:13px"
            oninput="updateGrade(${c.id},this.value)"
            onblur="ghAppend(${c.id},this.value)"/>
          <span style="font-size:11px;color:var(--tx2)">%</span>
          <button class="xb" onclick="deleteCourse(${c.id})">✕</button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
        <div style="display:flex;border:0.5px solid var(--bds);border-radius:var(--r);overflow:hidden;flex-shrink:0">
          <button onclick="caSetMode(${c.id},'weighted')" style="border:none;border-radius:0;padding:4px 10px;font-size:11px;font-weight:500;${isW ? 'background:var(--acc);color:#fff' : ''}">Weighted %</button>
          <button onclick="caSetMode(${c.id},'points')" style="border:none;border-radius:0;border-left:0.5px solid var(--bds);padding:4px 10px;font-size:11px;font-weight:500;${!isW ? 'background:var(--acc);color:#fff' : ''}">Total Points</button>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--tx2);white-space:nowrap">Target</span>
          <input type="number" min="0" max="100" value="${data.target ?? 80}"
            style="width:52px;text-align:center;font-size:13px;font-weight:600;padding:3px 6px"
            oninput="caSetTarget(${c.id},this.value)"/>
          <span style="font-size:11px;color:var(--tx2)">%</span>
        </div>
      </div>

      <div id="ca-proj-${c.id}">${caProjInner(res, data, assigns)}</div>

      <div id="ca-warn-${c.id}" style="background:var(--famber);color:var(--amber);border-radius:var(--r);padding:6px 10px;font-size:12px;margin:8px 0;${showWarn ? '' : 'display:none'}">
        ⚠ Weights total ${totalW.toFixed(1)}% — should add up to 100%.
      </div>

      ${assigns.length > 0 ? `<div style="overflow-x:auto;margin-top:10px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:0.5px solid var(--bd)">
            <th style="${thS};text-align:left">Assignment</th>
            <th style="${thS};text-align:center">Score</th>
            <th style="${thS};text-align:center">Max</th>
            <th style="${thS};text-align:center">Wt %</th>
            <th style="${thS};text-align:center">Status</th>
            <th style="${thS};text-align:center">Due</th>
            <th style="width:24px"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : ''}

      <button style="margin-top:10px;font-size:12px;padding:5px 10px" onclick="openAssign(${c.id})">+ Add assignment</button>

      ${ghHistoryHtml(c)}

      <textarea class="notes" placeholder="Notes…" oninput="updateNotes(${c.id},this.value)">${esc(c.notes || '')}</textarea>
    </div>`;
  }).join('') || '<div class="empty-state card"><div class="ei">📚</div><div class="et">No courses yet</div><div class="es">Add your first course to get started</div></div>';

  $('course-list').innerHTML = coursesHtml;
}

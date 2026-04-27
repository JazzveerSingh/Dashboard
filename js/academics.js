// ── Course colour palette ──────────────────────────────────────
const PALETTE = ['#6c63ff','#e05c5c','#3da870','#e8a838','#4a90d9','#a855f7','#14b8a6','#f97316','#ec4899','#84cc16','#0ea5e9','#f43f5e'];
const COL_PRE = 'col_';
let acPickedColor = null;

function getCourseColor(cid) {
  return localStorage.getItem(COL_PRE + cid) || PALETTE[Math.max(0, S.courses.findIndex(c => c.id === cid)) % PALETTE.length];
}
function setCourseColor(cid, color) { localStorage.setItem(COL_PRE + cid, color); }
function nextColor() {
  const used = new Set(S.courses.map(c => getCourseColor(c.id)));
  return PALETTE.find(c => !used.has(c)) || PALETTE[S.courses.length % PALETTE.length];
}

// ── Course colour picker (inline toggle) ──────────────────────
const cpOpen = new Set();
document.addEventListener('click', e => {
  if (!e.target.closest('.cswrap')) {
    cpOpen.forEach(id => { const o = document.getElementById(`cp-${id}`); if (o) o.style.display = 'none'; });
    cpOpen.clear();
  }
});

function toggleCP(cid) {
  const el = document.getElementById(`cp-${cid}`); if (!el) return;
  if (cpOpen.has(cid)) { cpOpen.delete(cid); el.style.display = 'none'; return; }
  cpOpen.forEach(id => { const o = document.getElementById(`cp-${id}`); if (o) o.style.display = 'none'; });
  cpOpen.clear(); cpOpen.add(cid);
  const cur = getCourseColor(cid);
  el.innerHTML = PALETTE.map(col =>
    `<div class="cswrap" onclick="changeColor(${cid},'${col}')" title="${col}"
      style="width:20px;height:20px;border-radius:50%;background:${col};cursor:pointer;flex-shrink:0;border:2px solid ${cur===col?'var(--tx)':'transparent'};transition:border .1s"></div>`
  ).join('');
  el.style.display = 'flex';
}

function changeColor(cid, col) {
  setCourseColor(cid, col);
  cpOpen.delete(cid);
  const pickerEl = document.getElementById(`cp-${cid}`); if (pickerEl) pickerEl.style.display = 'none';
  const card = document.getElementById(`cc-${cid}`); if (card) card.style.borderLeft = `3px solid ${col}`;
  const swatch = document.getElementById(`cs-${cid}`); if (swatch) swatch.style.background = col;
  if (document.querySelector('#sec-home.active')) renderHome();
}

// ── Course modal colour picker ─────────────────────────────────
function openCourseModal() {
  acPickedColor = nextColor();
  $('c-name').value = ''; $('c-grade').value = '';
  const pal = $('c-palette'); if (!pal) { openM('m-course'); return; }
  pal.innerHTML = PALETTE.map(col =>
    `<div class="cswrap" onclick="acPickColor('${col}',this)" title="${col}"
      style="width:22px;height:22px;border-radius:50%;background:${col};cursor:pointer;flex-shrink:0;border:2px solid ${col===acPickedColor?'var(--tx)':'transparent'};transition:border .15s"></div>`
  ).join('') +
    `<input type="text" id="c-hexcolor" maxlength="7" placeholder="#rrggbb" value="${acPickedColor}"
      style="width:68px;font-size:12px;padding:3px 6px;margin-left:4px" oninput="acPickHex(this.value)"/>`;
  openM('m-course');
}

function acPickColor(col, el) {
  acPickedColor = col;
  el.parentElement.querySelectorAll('.cswrap').forEach(d => d.style.border = '2px solid transparent');
  el.style.border = '2px solid var(--tx)';
  const hex = $('c-hexcolor'); if (hex) hex.value = col;
}
function acPickHex(val) {
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    acPickedColor = val;
    const pal = $('c-palette'); if (pal) pal.querySelectorAll('.cswrap').forEach(d => d.style.border = '2px solid transparent');
  }
}

// ── Per-course calculator state ────────────────────────────────
const CA_PRE = 'ca_';
function caLoad(cid) {
  try {
    const d = JSON.parse(localStorage.getItem(CA_PRE + cid));
    return d ? { target: 80, asgn: {}, ...d } : { target: 80, asgn: {} };
  } catch { return { target: 80, asgn: {} }; }
}
function caSave(cid, data) { try { localStorage.setItem(CA_PRE + cid, JSON.stringify(data)); } catch {} }

function caSetTarget(cid, val) { const d = caLoad(cid); d.target = parseFloat(val) || 0; caSave(cid, d); caRefresh(cid); }

function caSetScore(cid, aid, val) {
  const d = caLoad(cid);
  if (!d.asgn[aid]) d.asgn[aid] = {};
  const n = parseFloat(val);
  if (isNaN(n)) delete d.asgn[aid].score; else d.asgn[aid].score = n;
  caSave(cid, d);
  const max = d.asgn[aid]?.max ?? 100;
  const warnEl = document.getElementById(`ca-sw-${aid}`);
  if (warnEl) warnEl.style.display = (!isNaN(n) && n > max) ? '' : 'none';
  caRefresh(cid);
}

function caSetMax(cid, aid, val) {
  const d = caLoad(cid);
  if (!d.asgn[aid]) d.asgn[aid] = {};
  const n = parseFloat(val); d.asgn[aid].max = isNaN(n) ? 100 : n;
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
    score: asgn[a.id]?.score, max: asgn[a.id]?.max ?? 100
  }));
  const remaining = assigns.filter(a => a.status !== 'done').map(a => ({
    id: a.id, max: asgn[a.id]?.max ?? 100
  }));
  return gcCalcP({ completed, remaining, target });
}

function caEffGrade(cid, assigns) {
  const data = caLoad(cid), asgn = data.asgn || {};
  const hasDoneWithScore = assigns.some(a => a.status === 'done' && asgn[a.id]?.score != null);
  if (!hasDoneWithScore) return S.courses.find(c => c.id === cid)?.grade ?? null;
  return caCalc(cid, assigns).currentGrade;
}

function caRefresh(cid) {
  const assigns = S.assignments.filter(a => a.course_id === cid);
  const data = caLoad(cid), asgn = data.asgn || {}, target = data.target ?? 80;
  const res = caCalc(cid, assigns);

  const proj = document.getElementById(`ca-proj-${cid}`);
  if (proj) proj.innerHTML = caProjInner(res, data, assigns);

  const per = res.per || [];
  assigns.filter(a => a.status !== 'done').forEach(a => {
    const el = document.getElementById(`ca-need-${a.id}`); if (!el) return;
    const entry = per.find(p => p.id === a.id);
    if (!entry || entry.neededPct == null) { el.textContent = ''; return; }
    if (res.status === 'guaranteed') { el.textContent = '✓'; el.style.color = 'var(--green)'; }
    else if (res.status === 'impossible') { el.textContent = '✗'; el.style.color = 'var(--red)'; }
    else { el.textContent = `→ ${entry.neededPct.toFixed(0)}%`; el.style.color = 'var(--tx2)'; }
  });

  assigns.filter(a => a.status === 'done').forEach(a => {
    const pctEl = document.getElementById(`ca-pct-${a.id}`); if (!pctEl) return;
    const score = asgn[a.id]?.score, max = asgn[a.id]?.max ?? 100;
    if (score != null && max > 0) {
      const pct = score / max * 100;
      const col = pct >= target ? 'var(--green)' : pct >= target * 0.75 ? 'var(--amber)' : 'var(--red)';
      pctEl.textContent = `${pct.toFixed(0)}%`; pctEl.style.color = col; pctEl.style.display = '';
    } else { pctEl.style.display = 'none'; }
  });
}

function caProjInner(res, data, assigns) {
  if (assigns.length === 0) return '<div style="font-size:12px;color:var(--tx3);padding:6px 0">Add assessments to see grade projections.</div>';
  const pct = v => v != null ? v.toFixed(1) + '%' : '—';
  const { status, best, worst, reqPct } = res;
  const hasDoneData = (res.cMax || 0) > 0;
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
    <div style="text-align:center"><div style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:3px">Need avg</div><div style="font-size:17px;font-weight:700${reqColor?';color:'+reqColor:''}">${reqVal}</div></div>
    <div style="text-align:center"><div style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:3px">Best</div><div style="font-size:17px;font-weight:700;color:var(--green)">${pct(best)}</div></div>
    <div style="text-align:center"><div style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:3px">Worst</div><div style="font-size:17px;font-weight:700${worstBad?';color:var(--red)':''}">${pct(worst)}</div></div>
  </div>${banner}`;
}

// ── Sort / Filter ──────────────────────────────────────────────
const SF_PRE = 'sf_';
function sfLoad(cid) {
  try { const d = JSON.parse(localStorage.getItem(SF_PRE + cid)); return d ? { sort:'status', statuses:[], unscoredOnly:false, ...d } : { sort:'status', statuses:[], unscoredOnly:false }; }
  catch { return { sort:'status', statuses:[], unscoredOnly:false }; }
}
function sfSave(cid, d) { try { localStorage.setItem(SF_PRE + cid, JSON.stringify(d)); } catch {} }
function sfSetSort(cid, s) { const d = sfLoad(cid); d.sort = s; sfSave(cid, d); renderAcademics(); }
function sfToggleStatus(cid, s) {
  const d = sfLoad(cid), i = d.statuses.indexOf(s);
  if (i >= 0) d.statuses.splice(i, 1); else d.statuses.push(s);
  sfSave(cid, d); renderAcademics();
}
function sfToggleUnscored(cid) { const d = sfLoad(cid); d.unscoredOnly = !d.unscoredOnly; sfSave(cid, d); renderAcademics(); }
function sfClear(cid) { sfSave(cid, { sort: sfLoad(cid).sort, statuses:[], unscoredOnly:false }); renderAcademics(); }

function sfApply(assigns, cid, asgn) {
  const d = sfLoad(cid);
  let r = [...assigns];
  if (d.statuses.length > 0) r = r.filter(a => d.statuses.includes(a.status));
  if (d.unscoredOnly) r = r.filter(a => a.status === 'done' && asgn[a.id]?.score == null);
  const so = { todo:0, ip:1, done:2 };
  switch (d.sort) {
    case 'due_asc':  r.sort((a,b) => (a.due_date||'9999') < (b.due_date||'9999') ? -1 : 1); break;
    case 'due_desc': r.sort((a,b) => (a.due_date||'') > (b.due_date||'') ? -1 : 1); break;
    case 'score_asc': r.sort((a,b) => {
      const pa = asgn[a.id]?.score != null ? asgn[a.id].score/(asgn[a.id]?.max||100) : Infinity;
      const pb = asgn[b.id]?.score != null ? asgn[b.id].score/(asgn[b.id]?.max||100) : Infinity;
      return pa - pb;
    }); break;
    case 'name': r.sort((a,b) => a.name.localeCompare(b.name)); break;
    default: r.sort((a,b) => (so[a.status]??3) - (so[b.status]??3));
  }
  return r;
}

function sfBarHtml(cid, assigns, asgn) {
  const d = sfLoad(cid);
  const vis = sfApply(assigns, cid, asgn).length;
  const hasFilters = d.statuses.length > 0 || d.unscoredOnly;
  const sortOpts = [['status','Status'],['due_asc','Due ↑'],['due_desc','Due ↓'],['score_asc','Score ↑'],['name','A–Z']];
  const sortSel = `<select onchange="sfSetSort(${cid},this.value)" style="font-size:11px;padding:2px 6px;height:24px;border-radius:var(--r)">${sortOpts.map(([v,l])=>`<option value="${v}"${d.sort===v?' selected':''}>${l}</option>`).join('')}</select>`;
  const sPills = ['todo','ip','done'].map(s => {
    const l = s==='done'?'Done':s==='ip'?'In progress':'To do', on = d.statuses.includes(s);
    return `<span class="sfpill${on?' on':''}" onclick="sfToggleStatus(${cid},'${s}')">${l}</span>`;
  }).join('');
  const uPill = `<span class="sfpill${d.unscoredOnly?' on':''}" onclick="sfToggleUnscored(${cid})">Unscored</span>`;
  const clear = hasFilters ? `<span class="sfpill" onclick="sfClear(${cid})" style="color:var(--red);border-color:var(--red)">✕ Clear</span>` : '';
  const count = hasFilters && vis !== assigns.length ? `<span style="font-size:11px;color:var(--tx2);margin-left:auto">${vis} of ${assigns.length}</span>` : '';
  return `<div class="sfbar"><span style="font-size:11px;color:var(--tx2)">Sort:</span>${sortSel}${sPills}${uPill}${clear}${count}</div>`;
}

// ── Notes debounce + status ────────────────────────────────────
const noteTimers = {}, notePending = {};

function debounceNotes(id, v) {
  notePending[id] = v;
  showNS(id, 'typing');
  clearTimeout(noteTimers[id]);
  noteTimers[id] = setTimeout(() => saveNotesNow(id), 450);
}

async function saveNotesNow(id) {
  const v = notePending[id]; if (v === undefined) return;
  const c = S.courses.find(c => c.id === id); if (!c) return;
  if (!navigator.onLine) { showNS(id, 'offline'); return; }
  showNS(id, 'saving');
  try {
    await dbUpdate('courses', id, { notes: v });
    c.notes = v;
    const t = new Date().toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit' });
    localStorage.setItem(`ns_${id}`, t);
    showNS(id, 'saved', t); delete notePending[id];
  } catch { showNS(id, 'error'); setTimeout(() => retryNotes(id), 2500); }
}

async function retryNotes(id) {
  const v = notePending[id]; if (v === undefined) return;
  if (!navigator.onLine) { showNS(id, 'offline'); return; }
  const c = S.courses.find(c => c.id === id); if (!c) return;
  showNS(id, 'retrying');
  try {
    await dbUpdate('courses', id, { notes: v });
    c.notes = v;
    const t = new Date().toLocaleTimeString('en-CA', { hour:'numeric', minute:'2-digit' });
    localStorage.setItem(`ns_${id}`, t);
    showNS(id, 'saved', t); delete notePending[id];
  } catch { showNS(id, 'fail'); }
}

function showNS(id, state, time) {
  const el = document.getElementById(`ns-${id}`); if (!el) return;
  const m = { typing:['','var(--tx3)'], saving:['Saving…','var(--tx3)'], saved:[`Saved at ${time}`,'var(--green)'], error:['Save failed. Retrying…','var(--amber)'], retrying:['Retrying…','var(--amber)'], fail:['Could not save. Check your connection.','var(--red)'], offline:['Offline — will save when reconnected.','var(--amber)'] };
  const [msg, col] = m[state] || ['','var(--tx3)'];
  el.textContent = msg; el.style.color = col;
  if (state === 'saved') setTimeout(() => { if (el.textContent.startsWith('Saved')) el.textContent = ''; }, 3000);
}

window.addEventListener('online', () => Object.keys(notePending).forEach(id => saveNotesNow(parseInt(id))));

// ── Course CRUD ────────────────────────────────────────────────
async function saveCourse() {
  const name = $('c-name').value.trim(); if (!name) return;
  const g = parseFloat($('c-grade').value);
  const row = await dbInsert('courses', { name, grade: isNaN(g) ? null : g, notes: '' });
  if (row) {
    setCourseColor(row.id, acPickedColor || nextColor());
    S.courses.push(row); closeM('m-course'); $('c-name').value = ''; $('c-grade').value = ''; renderAcademics();
  }
}

async function deleteCourse(id) {
  await dbDelete('courses', id);
  S.courses = S.courses.filter(c => c.id !== id);
  S.assignments = S.assignments.filter(a => a.course_id !== id);
  localStorage.removeItem(COL_PRE + id);
  renderAcademics(); renderHome();
}

async function updateGrade(id, v) {
  const c = S.courses.find(c => c.id === id); if (!c) return;
  c.grade = v === '' ? null : parseFloat(v);
  await dbUpdate('courses', id, { grade: c.grade }); renderAcaMeta();
}

function updateNotes(id, v) { debounceNotes(id, v); }

// ── Assignment CRUD ────────────────────────────────────────────
function openAssign(cid) {
  $('a-name').value = ''; $('a-date').value = ''; $('a-status').value = 'todo';
  $('a-score').value = ''; $('a-max').value = '';
  $('a-cid').value = cid; openM('m-assign');
}

async function saveAssign() {
  const name = $('a-name').value.trim(); if (!name) return;
  const cid = parseInt($('a-cid').value);
  const row = await dbInsert('assignments', { course_id: cid, name, due_date: $('a-date').value || null, status: $('a-status').value });
  if (row) {
    const sv = parseFloat($('a-score').value), mv = parseFloat($('a-max').value);
    if (!isNaN(sv) || !isNaN(mv)) {
      const d = caLoad(cid);
      if (!d.asgn[row.id]) d.asgn[row.id] = {};
      if (!isNaN(sv)) d.asgn[row.id].score = sv;
      d.asgn[row.id].max = !isNaN(mv) ? mv : 100;
      caSave(cid, d);
    }
    S.assignments.push(row); closeM('m-assign'); renderAcademics();
  }
}

async function cycleStatus(aid) {
  const a = S.assignments.find(a => a.id === aid); if (!a) return;
  const order = ['todo','ip','done'];
  a.status = order[(order.indexOf(a.status)+1)%3];
  await dbUpdate('assignments', aid, { status: a.status });
  renderAcademics(); renderHome();
}

async function delAssign(aid) {
  await dbDelete('assignments', aid);
  S.assignments = S.assignments.filter(a => a.id !== aid); renderAcademics();
}

// ── Meta header ────────────────────────────────────────────────
function renderAcaMeta() {
  const grades = S.courses.map(c => caEffGrade(c.id, S.assignments.filter(a => a.course_id === c.id))).filter(g => g != null);
  const avg = grades.length ? grades.reduce((a,b) => a+b, 0) / grades.length : null;
  $('ac-avg').textContent = avg != null ? avg.toFixed(1)+'%' : '—';
  $('ac-bar').style.width = (avg??0)+'%';
  const sp = $('ac-spark'); if (sp) sp.innerHTML = ghGpaSpark();
  const all = S.assignments, done = all.filter(a => a.status==='done').length;
  $('ac-done').textContent = `${done} / ${all.length}`;
  $('ac-sub').textContent = all.length ? Math.round(done/all.length*100)+'% complete' : '';
}

// ── Where marks are being lost ─────────────────────────────────
function lostMarksHtml(assigns, asgn, target) {
  const scored = assigns.filter(a => a.status==='done' && asgn[a.id]?.score != null);
  if (scored.length < 2) return '';
  const sorted = [...scored].sort((a,b) => {
    const pa = asgn[a.id].score/(asgn[a.id]?.max||100), pb = asgn[b.id].score/(asgn[b.id]?.max||100);
    return pa - pb;
  });
  const rows = sorted.map(a => {
    const score = asgn[a.id].score, max = asgn[a.id]?.max||100, pct = score/max*100;
    const col = pct>=target ? 'var(--green)' : pct>=target*0.75 ? 'var(--amber)' : 'var(--red)';
    const barW = Math.min(100, pct).toFixed(0);
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:0.5px solid var(--bd);font-size:12px">
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.name)}</span>
      <span style="font-weight:600;color:${col};white-space:nowrap">${score}/${max}</span>
      <span style="font-weight:700;color:${col};width:32px;text-align:right">${pct.toFixed(0)}%</span>
      <div style="width:50px;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;flex-shrink:0"><div style="height:100%;width:${barW}%;background:${col};border-radius:2px"></div></div>
    </div>`;
  }).join('');
  return `<details style="margin-top:8px"><summary style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;font-weight:600;cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:5px">Where marks are being lost <span style="color:var(--tx3)">(${scored.length} scored)</span></summary><div style="margin-top:6px">${rows}</div></details>`;
}

// ── Main render ────────────────────────────────────────────────
function renderAcademics() {
  renderAcaMeta();
  const sl = s => s==='done'?'Done':s==='ip'?'In progress':'To do';
  const sc = s => s==='done'?'sd':s==='ip'?'si':'st2';
  const thS = 'padding:4px 6px;font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;white-space:nowrap';

  const coursesHtml = S.courses.map(c => {
    const color = getCourseColor(c.id);
    const allAssigns = S.assignments.filter(a => a.course_id===c.id);
    const data = caLoad(c.id), asgn = data.asgn||{}, target = data.target??80;
    const res = caCalc(c.id, allAssigns), per = res.per||[];
    const visibleAssigns = sfApply(allAssigns, c.id, asgn);
    const sf = sfLoad(c.id), isFiltered = sf.statuses.length>0 || sf.unscoredOnly;

    const rows = visibleAssigns.map(a => {
      const isDone = a.status==='done';
      const score = asgn[a.id]?.score, max = asgn[a.id]?.max??100;
      const isOverdue = !isDone && a.due_date && a.due_date < today();

      let scoreCell;
      if (isDone) {
        const pct = score!=null && max>0 ? score/max*100 : null;
        const col = pct!=null ? (pct>=target?'var(--green)':pct>=target*0.75?'var(--amber)':'var(--red)') : '';
        const scoreOver = score!=null && score>max;
        scoreCell = `<div style="display:flex;align-items:center;gap:3px;flex-wrap:nowrap">
          <input type="number" min="0" value="${score??''}" placeholder="—"
            style="width:48px;text-align:center;font-size:12px;padding:3px 4px${scoreOver?';border-color:var(--red)':''}"
            oninput="caSetScore(${c.id},${a.id},this.value)" onblur="caScoreBlur(${c.id})"/>
          <span style="font-size:11px;color:var(--tx2)">/</span>
          <input type="number" min="1" value="${max}"
            style="width:44px;text-align:center;font-size:12px;padding:3px 4px"
            oninput="caSetMax(${c.id},${a.id},this.value)"/>
          <span id="ca-pct-${a.id}" style="font-size:10px;font-weight:700;color:${col};min-width:28px${pct==null?';display:none':''}">${pct!=null?pct.toFixed(0)+'%':''}</span>
          <span id="ca-sw-${a.id}" style="color:var(--amber);font-size:11px${score==null?'':';display:none'}" title="No score entered">⚠</span>
        </div>`;
      } else {
        const pEntry = per.find(p => p.id===a.id);
        let needText='', needColor='var(--tx2)';
        if (pEntry && pEntry.neededPct!=null) {
          if (res.status==='guaranteed') { needText='✓'; needColor='var(--green)'; }
          else if (res.status==='impossible') { needText='✗'; needColor='var(--red)'; }
          else needText=`→ ${pEntry.neededPct.toFixed(0)}%`;
        }
        scoreCell = `<span id="ca-need-${a.id}" style="font-size:11px;color:${needColor};white-space:nowrap;font-weight:500">${needText}</span>`;
      }

      return `<tr style="border-bottom:0.5px solid var(--bd)">
        <td style="padding:5px 6px;font-size:13px">
          <div style="display:flex;align-items:center;gap:5px">
            <div style="width:4px;height:4px;border-radius:50%;background:${color};flex-shrink:0"></div>
            <span${isOverdue?' style="color:var(--red)"':''}>${esc(a.name)}${isOverdue?' <span style="font-size:10px" title="Past due">⚠</span>':''}</span>
          </div>
        </td>
        <td style="padding:5px 6px">${scoreCell}</td>
        <td style="padding:5px 6px;text-align:center">
          <span class="badge ${sc(a.status)}" style="cursor:pointer;white-space:nowrap" onclick="cycleStatus(${a.id})" title="Click to cycle">${sl(a.status)}</span>
        </td>
        <td style="padding:5px 6px;font-size:11px;color:var(--tx2);white-space:nowrap">${fmt(a.due_date)}</td>
        <td style="padding:5px 6px;text-align:right"><button class="xb" onclick="delAssign(${a.id})">✕</button></td>
      </tr>`;
    }).join('');

    const emptyFilter = isFiltered && visibleAssigns.length===0
      ? `<tr><td colspan="5" style="text-align:center;padding:12px;font-size:12px;color:var(--tx3)">No assessments match the current filters.</td></tr>` : '';

    const savedAt = localStorage.getItem(`ns_${c.id}`);

    return `<div class="cc" id="cc-${c.id}" style="border-left:3px solid ${color}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;position:relative">
          <div class="cswrap" id="cs-${c.id}" onclick="toggleCP(${c.id})" title="Change colour"
            style="width:12px;height:12px;border-radius:50%;background:${color};cursor:pointer;flex-shrink:0;border:1.5px solid rgba(0,0,0,.15)"></div>
          <div class="cswrap" id="cp-${c.id}" style="display:none;position:absolute;top:18px;left:0;z-index:100;background:var(--bg2);border:0.5px solid var(--bds);border-radius:var(--r);padding:8px;box-shadow:0 4px 14px rgba(0,0,0,.15);gap:5px;flex-wrap:wrap;width:160px"></div>
          <span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</span>
          <span style="display:inline-flex;align-items:center;gap:2px;flex-shrink:0" id="gh-sp-${c.id}">${ghInlineSpark(c.id)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">
          <span style="font-size:10px;color:var(--tx2)">Manual</span>
          <input type="number" min="0" max="100" value="${c.grade??''}" placeholder="—"
            style="width:52px;text-align:center;font-weight:600;font-size:13px"
            oninput="updateGrade(${c.id},this.value)" onblur="ghAppend(${c.id},this.value)"/>
          <span style="font-size:11px;color:var(--tx2)">%</span>
          <button class="xb" onclick="deleteCourse(${c.id})">✕</button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <span style="font-size:11px;color:var(--tx2);white-space:nowrap">Target</span>
        <input type="number" min="0" max="100" value="${data.target??80}"
          style="width:52px;text-align:center;font-size:13px;font-weight:600;padding:3px 6px"
          oninput="caSetTarget(${c.id},this.value)"/>
        <span style="font-size:11px;color:var(--tx2)">%</span>
      </div>

      <div id="ca-proj-${c.id}">${caProjInner(res, data, allAssigns)}</div>

      ${lostMarksHtml(allAssigns, asgn, target)}

      ${allAssigns.length > 0 ? `
      ${sfBarHtml(c.id, allAssigns, asgn)}
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:0.5px solid var(--bd)">
            <th style="${thS};text-align:left">Assessment</th>
            <th style="${thS};text-align:center">Score / Max</th>
            <th style="${thS};text-align:center">Status</th>
            <th style="${thS};text-align:center">Due</th>
            <th style="width:24px"></th>
          </tr></thead>
          <tbody>${rows}${emptyFilter}</tbody>
        </table>
      </div>` : ''}

      <button style="margin-top:10px;font-size:12px;padding:5px 10px" onclick="openAssign(${c.id})">+ Add assessment</button>

      ${ghHistoryHtml(c)}

      <textarea class="notes" placeholder="Notes…" oninput="debounceNotes(${c.id},this.value)">${esc(c.notes||'')}</textarea>
      <div id="ns-${c.id}" class="note-status">${savedAt?`Last saved at ${savedAt}`:''}</div>
    </div>`;
  }).join('') || '<div class="empty-state card"><div class="ei">📚</div><div class="et">No courses yet</div><div class="es">Add your first course to get started</div></div>';

  $('course-list').innerHTML = coursesHtml;
}

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

// ── Hydrate localStorage from Supabase score data ─────────────
// Called once after loadAll() so the grade chart works on any device.
function caHydrateFromSupabase() {
  if (!window.S?.assignments?.length) return;
  const byCourse = {};
  S.assignments.forEach(a => {
    const hasData = a.score != null || (a.type && a.type !== 'assignment') ||
                    (a.max_score != null && a.max_score !== 100) ||
                    (a.weight != null && a.weight !== 1);
    if (!hasData) return;
    if (!byCourse[a.course_id]) byCourse[a.course_id] = {};
    const entry = {};
    if (a.score != null) entry.score = a.score;
    if (a.max_score != null && a.max_score !== 100) entry.max = a.max_score;
    if (a.weight != null && a.weight !== 1) entry.weight = a.weight;
    if (a.type && a.type !== 'assignment') entry.type = a.type;
    if (a.score_ts) entry.score_ts = a.score_ts;
    if (Object.keys(entry).length) byCourse[a.course_id][a.id] = entry;
  });
  Object.entries(byCourse).forEach(([cid, asgnMap]) => {
    const d = caLoad(Number(cid));
    let changed = false;
    Object.entries(asgnMap).forEach(([aid, vals]) => {
      const aidN = Number(aid);
      if (!d.asgn[aidN]) { d.asgn[aidN] = {}; changed = true; }
      Object.entries(vals).forEach(([k, v]) => {
        if (d.asgn[aidN][k] !== v) { d.asgn[aidN][k] = v; changed = true; }
      });
    });
    if (changed) caSave(Number(cid), d);
  });
}

// ── Push localStorage scores to Supabase for existing assignments ─
// Runs once on login. If Supabase has no score for an assignment but
// localStorage does, we write it now so the published site can see it.
async function caSyncLocalScoresToSupabase() {
  if (!window.S?.assignments?.length) return;
  const updates = [];
  S.assignments.forEach(a => {
    if (a.score != null) return; // Supabase already has this score
    const ls = caLoad(a.course_id).asgn?.[a.id] || caLoad(a.course_id).asgn?.[String(a.id)] || {};
    if (ls.score == null) return; // No localStorage score either — nothing to push
    const payload = {
      score:     ls.score,
      max_score: ls.max    ?? 100,
      weight:    ls.weight ?? 1,
      type:      ls.type   ?? 'assignment',
      score_ts:  ls.score_ts || null
    };
    updates.push(
      dbUpdate('assignments', a.id, payload).then(() => {
        // Reflect in memory so ghBuildAssignData can use it immediately
        Object.assign(a, payload);
      })
    );
  });
  if (updates.length) {
    await Promise.all(updates);
    console.log(`[ca] Synced ${updates.length} local score(s) to Supabase`);
  }
}

// ── Type helpers (accessible from app.js) ─────────────────────
function isDoneLogically(a, asgn) {
  return asgn[a.id]?.type === 'test' ? asgn[a.id]?.score != null : a.status === 'done';
}
function isAssignLogicallyDone(a) {
  const d = caLoad(a.course_id);
  return isDoneLogically(a, d.asgn || {});
}
function getAssignType(a) {
  return caLoad(a.course_id).asgn[a.id]?.type || 'assignment';
}

// ── Type toggle in modal ───────────────────────────────────────
let acAssignType = 'assignment';
let acEditId = null;
let acEditOrigAsgn = null;

function caEditOpen(aid) {
  const a = S.assignments.find(a => a.id === aid); if (!a) return;
  const d = caLoad(a.course_id);
  acEditOrigAsgn = JSON.parse(JSON.stringify(d.asgn || {}));
  acEditId = aid;
  renderAcademics();
}

function caEditCancel() {
  if (acEditId != null && acEditOrigAsgn != null) {
    const a = S.assignments.find(a => a.id === acEditId);
    if (a) { const d = caLoad(a.course_id); d.asgn = acEditOrigAsgn; caSave(a.course_id, d); }
  }
  acEditId = null; acEditOrigAsgn = null;
  renderAcademics();
}

async function caEditSave(aid) {
  const a = S.assignments.find(a => a.id === aid); if (!a) return;
  const cid = a.course_id;
  const nameVal = document.getElementById(`ce-name-${aid}`)?.value.trim();
  if (!nameVal) return;
  const dateVal = document.getElementById(`ce-date-${aid}`)?.value || null;
  const scoreVal = parseFloat(document.getElementById(`ce-score-${aid}`)?.value);
  const maxVal   = parseFloat(document.getElementById(`ce-max-${aid}`)?.value);
  const weightVal= parseFloat(document.getElementById(`ce-weight-${aid}`)?.value);
  const statusEl = document.getElementById(`ce-status-${aid}`);
  const typeVal  = document.getElementById(`ce-type-${aid}`)?.value;
  const newStatus = statusEl?.value || a.status;
  const d = caLoad(cid);
  if (!d.asgn[aid]) d.asgn[aid] = {};
  if (!isNaN(scoreVal)) { d.asgn[aid].score = scoreVal; if (!d.asgn[aid].score_ts) d.asgn[aid].score_ts = new Date().toISOString(); }
  else { delete d.asgn[aid].score; delete d.asgn[aid].score_ts; }
  d.asgn[aid].max = (!isNaN(maxVal) && maxVal > 0) ? maxVal : 100;
  if (!isNaN(weightVal) && weightVal > 0) d.asgn[aid].weight = weightVal; else delete d.asgn[aid].weight;
  if (typeVal) d.asgn[aid].type = typeVal;
  caSave(cid, d);
  const sbUpdate = {
    name: nameVal, due_date: dateVal, status: newStatus,
    score: d.asgn[aid].score ?? null,
    max_score: d.asgn[aid].max ?? 100,
    weight: d.asgn[aid].weight ?? 1,
    type: d.asgn[aid].type ?? 'assignment',
    score_ts: d.asgn[aid].score_ts ?? null
  };
  await dbUpdate('assignments', aid, sbUpdate);
  a.name = nameVal; a.due_date = dateVal; a.status = newStatus;
  Object.assign(a, { score: sbUpdate.score, max_score: sbUpdate.max_score, weight: sbUpdate.weight, type: sbUpdate.type, score_ts: sbUpdate.score_ts });
  acEditId = null; acEditOrigAsgn = null;
  renderAcademics(); renderHome();
  setTimeout(() => {
    const row = document.getElementById(`ca-row-${aid}`);
    if (row) { row.classList.add('ca-flash'); setTimeout(() => row.classList.remove('ca-flash'), 700); }
  }, 30);
}

function caEditWeightLive(aid, cid, val) {
  const wv = parseFloat(val);
  const d = caLoad(cid);
  if (!d.asgn[aid]) d.asgn[aid] = {};
  if (!isNaN(wv) && wv > 0) d.asgn[aid].weight = wv; else delete d.asgn[aid].weight;
  caSave(cid, d); caRefresh(cid);
  const total = S.assignments.filter(a2 => a2.course_id === cid)
    .reduce((s, a2) => s + (d.asgn[a2.id]?.weight ?? 1), 0);
  const warn = document.getElementById(`ce-wwarn-${aid}`);
  if (warn) warn.style.display = total > 100 ? '' : 'none';
}

function caEditTypeSwitch(aid, t) {
  const inp = document.getElementById(`ce-type-${aid}`); if (inp) inp.value = t;
  const aBtn = document.getElementById(`ce-t-asgn-${aid}`);
  const tBtn = document.getElementById(`ce-t-test-${aid}`);
  if (aBtn) aBtn.style.cssText = `border:none;border-radius:0;padding:3px 10px;font-size:11px;font-weight:500;${t==='assignment'?'background:var(--acc);color:#fff':''}`;
  if (tBtn) tBtn.style.cssText = `border:none;border-radius:0;border-left:0.5px solid var(--bds);padding:3px 10px;font-size:11px;font-weight:500;${t==='test'?'background:var(--acc);color:#fff':''}`;
}

function acSetType(t) {
  acAssignType = t;
  const isTest = t === 'test';
  $('at-asgn').style.cssText = `border:none;border-radius:0;padding:4px 12px;font-size:12px;font-weight:500;${!isTest?'background:var(--acc);color:#fff':''}`;
  $('at-test').style.cssText = `border:none;border-radius:0;border-left:0.5px solid var(--bds);padding:4px 12px;font-size:12px;font-weight:500;${isTest?'background:var(--acc);color:#fff':''}`;
  $('a-status-row').style.display = isTest ? 'none' : '';
}

function caSetTarget(cid, val) { const d = caLoad(cid); d.target = parseFloat(val) || 0; caSave(cid, d); caRefresh(cid); }

function caSetScore(cid, aid, val) {
  const d = caLoad(cid);
  if (!d.asgn[aid]) d.asgn[aid] = {};
  const n = parseFloat(val);
  if (isNaN(n)) { delete d.asgn[aid].score; delete d.asgn[aid].score_ts; }
  else { d.asgn[aid].score = n; if (!d.asgn[aid].score_ts) d.asgn[aid].score_ts = new Date().toISOString(); }
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

async function caScoreBlur(cid, aid) {
  renderAcaMeta();
  if (!aid) return;
  const d = caLoad(cid);
  const asgn = d.asgn[aid] || {};
  const update = asgn.score != null
    ? { score: asgn.score, score_ts: asgn.score_ts || null }
    : { score: null, score_ts: null };
  await dbUpdate('assignments', aid, update);
  const a = S.assignments.find(a => a.id === aid);
  if (a) { a.score = update.score; a.score_ts = update.score_ts; }
}

async function caMaxBlur(cid, aid) {
  const d = caLoad(cid);
  const max = d.asgn[aid]?.max ?? 100;
  await dbUpdate('assignments', aid, { max_score: max });
  const a = S.assignments.find(a => a.id === aid);
  if (a) a.max_score = max;
}

function caCalc(cid, assigns) {
  const data = caLoad(cid), asgn = data.asgn || {}, target = data.target ?? 80;
  const completed = assigns.filter(a => isDoneLogically(a, asgn)).map(a => {
    const w = asgn[a.id]?.weight ?? 1;
    return { score: asgn[a.id]?.score != null ? asgn[a.id].score * w : null, max: (asgn[a.id]?.max ?? 100) * w };
  });
  const remaining = assigns.filter(a => !isDoneLogically(a, asgn)).map(a => {
    const w = asgn[a.id]?.weight ?? 1;
    return { id: a.id, max: (asgn[a.id]?.max ?? 100) * w };
  });
  return gcCalcP({ completed, remaining, target });
}

function caEffGrade(cid, assigns) {
  const data = caLoad(cid), asgn = data.asgn || {};
  const hasDoneWithScore = assigns.some(a => isDoneLogically(a, asgn) && asgn[a.id]?.score != null);
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
  assigns.filter(a => !isDoneLogically(a, asgn)).forEach(a => {
    const el = document.getElementById(`ca-need-${a.id}`); if (!el) return;
    const entry = per.find(p => p.id === a.id);
    if (!entry || entry.neededPct == null) { el.textContent = ''; return; }
    if (res.status === 'guaranteed') { el.textContent = '✓'; el.style.color = 'var(--green)'; }
    else if (res.status === 'impossible') { el.textContent = '✗'; el.style.color = 'var(--red)'; }
    else { el.textContent = `→ ${entry.neededPct.toFixed(0)}%`; el.style.color = 'var(--tx2)'; }
  });

  assigns.forEach(a => {
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

function sfEffStatus(a, asgn) {
  return asgn[a.id]?.type === 'test' ? (asgn[a.id]?.score != null ? 'done' : 'todo') : a.status;
}

function sfApply(assigns, cid, asgn) {
  const d = sfLoad(cid);
  let r = [...assigns];
  if (d.statuses.length > 0) r = r.filter(a => d.statuses.includes(sfEffStatus(a, asgn)));
  if (d.unscoredOnly) r = r.filter(a => {
    if (asgn[a.id]?.type === 'test') return asgn[a.id]?.score == null;
    return a.status === 'done' && asgn[a.id]?.score == null;
  });
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
    default: r.sort((a,b) => (so[sfEffStatus(a,asgn)]??3) - (so[sfEffStatus(b,asgn)]??3));
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
  acSetType('assignment');
  $('a-name').value = ''; $('a-date').value = ''; $('a-status').value = 'todo';
  $('a-score').value = ''; $('a-max').value = ''; $('a-weight').value = '';
  $('a-cid').value = cid; openM('m-assign');
}

async function saveAssign() {
  const name = $('a-name').value.trim(); if (!name) return;
  const cid = parseInt($('a-cid').value);
  const status = acAssignType === 'test' ? 'todo' : $('a-status').value;
  const sv = parseFloat($('a-score').value), mv = parseFloat($('a-max').value), wv = parseFloat($('a-weight').value);
  const scoreTs = !isNaN(sv) ? new Date().toISOString() : null;
  const sbExtra = {
    type: acAssignType,
    score: !isNaN(sv) ? sv : null,
    max_score: !isNaN(mv) ? mv : 100,
    weight: (!isNaN(wv) && wv > 0) ? wv : 1,
    score_ts: scoreTs
  };
  const row = await dbInsert('assignments', { course_id: cid, name, due_date: $('a-date').value || null, status, ...sbExtra });
  if (row) {
    const d = caLoad(cid);
    if (!d.asgn[row.id]) d.asgn[row.id] = {};
    d.asgn[row.id].type = acAssignType;
    if (!isNaN(sv)) { d.asgn[row.id].score = sv; d.asgn[row.id].score_ts = scoreTs; }
    if (!isNaN(mv)) d.asgn[row.id].max = mv;
    if (!isNaN(wv) && wv > 0) d.asgn[row.id].weight = wv;
    caSave(cid, d);
    S.assignments.push({ ...row, ...sbExtra });
    closeM('m-assign'); renderAcademics();
  }
}

async function cycleStatus(aid) {
  const a = S.assignments.find(a => a.id === aid); if (!a) return;
  const d = caLoad(a.course_id);
  if (d.asgn[aid]?.type === 'test') return;
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
  const all = S.assignments, done = all.filter(a => isAssignLogicallyDone(a)).length;
  $('ac-done').textContent = `${done} / ${all.length}`;
  $('ac-sub').textContent = all.length ? Math.round(done/all.length*100)+'% complete' : '';
}

// ── Where marks are being lost ─────────────────────────────────
function lostMarksHtml(assigns, asgn, target) {
  const scored = assigns.filter(a => isDoneLogically(a, asgn) && asgn[a.id]?.score != null);
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
  const lbS = 'font-size:10px;color:var(--tx2);font-weight:600;text-transform:uppercase;letter-spacing:.4px';

  const coursesHtml = S.courses.map(c => {
    const color = getCourseColor(c.id);
    const allAssigns = S.assignments.filter(a => a.course_id===c.id);
    const data = caLoad(c.id), asgn = data.asgn||{}, target = data.target??80;
    const res = caCalc(c.id, allAssigns), per = res.per||[];
    const visibleAssigns = sfApply(allAssigns, c.id, asgn);
    const sf = sfLoad(c.id), isFiltered = sf.statuses.length>0 || sf.unscoredOnly;

    const rows = visibleAssigns.map(a => {
      const isTestType = asgn[a.id]?.type === 'test';
      const logicallyDone = isDoneLogically(a, asgn);
      const score = asgn[a.id]?.score, max = asgn[a.id]?.max??100, weight = asgn[a.id]?.weight??1;
      const isOverdue = !logicallyDone && a.due_date && a.due_date < today();
      const hasScore = score != null;

      // ── Edit row ──────────────────────────────────────────────
      if (acEditId === a.id) {
        const locked = hasScore;
        const dStyle = locked ? 'opacity:.5;pointer-events:none;' : '';
        const totalW = S.assignments.filter(a2 => a2.course_id === c.id)
          .reduce((s2, a2) => s2 + (asgn[a2.id]?.weight ?? 1), 0);
        return `<tr id="ca-row-${a.id}" style="border-bottom:0.5px solid var(--bd);background:var(--bg3)">
          <td colspan="5" style="padding:10px 8px">
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end">
              <div style="display:flex;flex-direction:column;gap:3px;flex:2;min-width:140px">
                <label style="${lbS}">Name</label>
                <input id="ce-name-${a.id}" value="${esc(a.name)}" style="font-size:13px;padding:4px 8px"/>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px">
                <label style="${lbS}">Score</label>
                <input id="ce-score-${a.id}" type="number" min="0" value="${score??''}" placeholder="—" style="width:56px;font-size:12px;padding:4px 6px;text-align:center"/>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px">
                <label style="${lbS}">Max</label>
                <input id="ce-max-${a.id}" type="number" min="1" value="${max}" style="width:52px;font-size:12px;padding:4px 6px;text-align:center"/>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px">
                <label style="${lbS}">Weight</label>
                <input id="ce-weight-${a.id}" type="number" min="0.1" step="0.1" value="${weight!==1?weight:''}" placeholder="1" style="width:52px;font-size:12px;padding:4px 6px;text-align:center" oninput="caEditWeightLive(${a.id},${c.id},this.value)"/>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px">
                <label style="${lbS}">Due</label>
                <input id="ce-date-${a.id}" type="date" value="${a.due_date??''}" style="font-size:12px;padding:4px 6px"/>
              </div>
              ${!isTestType ? `<div style="display:flex;flex-direction:column;gap:3px">
                <label style="${lbS}">Status</label>
                <select id="ce-status-${a.id}" style="font-size:12px;padding:4px 6px">
                  <option value="todo"${a.status==='todo'?' selected':''}>To do</option>
                  <option value="ip"${a.status==='ip'?' selected':''}>In progress</option>
                  <option value="done"${a.status==='done'?' selected':''}>Done</option>
                </select>
              </div>` : ''}
              <div style="display:flex;flex-direction:column;gap:3px">
                <label style="${lbS}">Type</label>
                <div style="display:flex;border:0.5px solid var(--bds);border-radius:var(--r);overflow:hidden;width:fit-content;${dStyle}">
                  <button id="ce-t-asgn-${a.id}" onclick="caEditTypeSwitch(${a.id},'assignment')"${locked?' disabled':''} style="border:none;border-radius:0;padding:3px 10px;font-size:11px;font-weight:500;${!isTestType?'background:var(--acc);color:#fff':''}">Assignment</button>
                  <button id="ce-t-test-${a.id}" onclick="caEditTypeSwitch(${a.id},'test')"${locked?' disabled':''} style="border:none;border-radius:0;border-left:0.5px solid var(--bds);padding:3px 10px;font-size:11px;font-weight:500;${isTestType?'background:var(--acc);color:#fff':''}">Test</button>
                </div>
                <input type="hidden" id="ce-type-${a.id}" value="${isTestType?'test':'assignment'}"/>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
              <span id="ce-wwarn-${a.id}" style="font-size:11px;color:var(--amber);display:${totalW>100?'':'none'}">⚠ Total weight exceeds 100</span>
              <div style="margin-left:auto;display:flex;gap:6px">
                <button onclick="caEditCancel()" style="font-size:12px;padding:4px 10px">Cancel</button>
                <button class="bp" onclick="caEditSave(${a.id})" style="font-size:12px;padding:4px 10px">Save</button>
              </div>
            </div>
          </td>
        </tr>`;
      }

      // ── Normal row ────────────────────────────────────────────
      let scoreCell;
      if (logicallyDone || isTestType) {
        const pct = score!=null && max>0 ? score/max*100 : null;
        const col = pct!=null ? (pct>=target?'var(--green)':pct>=target*0.75?'var(--amber)':'var(--red)') : '';
        const scoreOver = score!=null && score>max;
        scoreCell = `<div style="display:flex;align-items:center;gap:3px;flex-wrap:nowrap">
          <input type="number" min="0" value="${score??''}" placeholder="—"
            style="width:48px;text-align:center;font-size:12px;padding:3px 4px${scoreOver?';border-color:var(--red)':''}"
            oninput="caSetScore(${c.id},${a.id},this.value)" onblur="caScoreBlur(${c.id},${a.id})"/>
          <span style="font-size:11px;color:var(--tx2)">/</span>
          <input type="number" min="1" value="${max}"
            style="width:44px;text-align:center;font-size:12px;padding:3px 4px"
            oninput="caSetMax(${c.id},${a.id},this.value)" onblur="caMaxBlur(${c.id},${a.id})"/>
          <span id="ca-pct-${a.id}" style="font-size:10px;font-weight:700;color:${col};min-width:28px${pct==null?';display:none':''}">${pct!=null?pct.toFixed(0)+'%':''}</span>
          ${!isTestType ? `<span id="ca-sw-${a.id}" style="color:var(--amber);font-size:11px${score==null?'':';display:none'}" title="No score entered">⚠</span>` : ''}
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

      const statusCell = isTestType
        ? (score==null && a.due_date && a.due_date < today()
            ? `<span style="font-size:11px;color:var(--amber);white-space:nowrap">Score not yet entered</span>`
            : '')
        : `<span class="badge ${sc(a.status)}" style="cursor:pointer;white-space:nowrap" onclick="cycleStatus(${a.id})" title="Click to cycle">${sl(a.status)}</span>`;

      const typeChip = isTestType
        ? `<span style="font-size:9px;font-weight:700;color:var(--tx2);background:var(--bg3);border-radius:3px;padding:1px 5px;flex-shrink:0;letter-spacing:.3px">TEST</span>`
        : '';
      const weightChip = weight !== 1
        ? `<span style="font-size:9px;font-weight:600;color:var(--acc);background:var(--fpurple);border-radius:3px;padding:1px 5px;flex-shrink:0">×${weight}</span>`
        : '';

      return `<tr id="ca-row-${a.id}" style="border-bottom:0.5px solid var(--bd)">
        <td style="padding:5px 6px;font-size:13px">
          <div style="display:flex;align-items:center;gap:5px">
            <div style="width:4px;height:4px;border-radius:50%;background:${color};flex-shrink:0"></div>
            ${typeChip}${weightChip}<span${isOverdue?' style="color:var(--red)"':''}>${esc(a.name)}${isOverdue?' <span style="font-size:10px" title="Past due">⚠</span>':''}</span>
          </div>
        </td>
        <td style="padding:5px 6px">${scoreCell}</td>
        <td style="padding:5px 6px;text-align:center">${statusCell}</td>
        <td style="padding:5px 6px;font-size:11px;color:var(--tx2);white-space:nowrap">${fmt(a.due_date)}</td>
        <td style="padding:5px 4px;text-align:right;white-space:nowrap">
          <button class="xb" onclick="caEditOpen(${a.id})" title="Edit" style="margin-right:2px">✎</button>
          <button class="xb" onclick="delAssign(${a.id})">✕</button>
        </td>
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
          <span style="font-size:10px;color:var(--tx2)">Grade</span>
          <input type="number" min="0" max="100" value="${c.grade??''}" placeholder="—"
            style="width:52px;text-align:center;font-weight:600;font-size:13px"
            oninput="updateGrade(${c.id},this.value)"/>
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
            <th style="width:54px"></th>
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

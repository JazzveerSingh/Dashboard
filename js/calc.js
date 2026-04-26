// ── Grade Projection Calculator ───────────────────────────────
const GC_KEY = 'gc_state';
const gcEsc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

let GC = (() => {
  try {
    const d = JSON.parse(localStorage.getItem(GC_KEY));
    if (d?.courses?.length) { if (!d.activeId) d.activeId = d.courses[0].id; return d; }
  } catch {}
  const id = gcUid();
  return { courses: [gcMkCourse(id, 'Course 1')], activeId: id };
})();

function gcUid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function gcMkCourse(id, name) { return { id, name, mode: 'weighted', target: 80, completed: [], remaining: [] }; }
function gcMkRow() { return { id: gcUid(), name: '', score: '', max: 100, weight: '' }; }
function gcSave() { try { localStorage.setItem(GC_KEY, JSON.stringify(GC)); } catch {} }
function gcActive() { return GC.courses.find(c => c.id === GC.activeId) || GC.courses[0]; }

// ── Mutations ─────────────────────────────────────────────────
function gcSwitchCourse(id) { GC.activeId = id; gcSave(); renderCalc(); }

function gcAddCourse() {
  const id = gcUid();
  GC.courses.push(gcMkCourse(id, `Course ${GC.courses.length + 1}`));
  GC.activeId = id; gcSave(); renderCalc();
}

function gcRemoveCourse(id) {
  if (GC.courses.length <= 1) return;
  GC.courses = GC.courses.filter(c => c.id !== id);
  if (GC.activeId === id) GC.activeId = GC.courses[0].id;
  gcSave(); renderCalc();
}

function gcAddRow(type) { gcActive()[type].push(gcMkRow()); gcSave(); renderCalc(); }

function gcRemoveRow(type, id) {
  const c = gcActive();
  c[type] = c[type].filter(r => r.id !== id);
  gcSave(); renderCalc();
}

function gcInput(type, id, field, val) {
  const row = gcActive()[type].find(r => r.id === id);
  if (row) row[field] = val;
  gcSave(); gcRefreshResults();
}

function gcSetMode(mode) { gcActive().mode = mode; gcSave(); renderCalc(); }
function gcSetName(v) { gcActive().name = v; gcSave(); }
function gcSetTarget(v) { gcActive().target = parseFloat(v) || 0; gcSave(); gcRefreshResults(); }

// ── Calculation ───────────────────────────────────────────────
function gcCalc(c) { return c.mode === 'weighted' ? gcCalcW(c) : gcCalcP(c); }

function gcCalcW({ completed, remaining, target }) {
  let earned = 0, cW = 0;
  for (const a of completed) {
    const s = parseFloat(a.score), m = parseFloat(a.max), w = parseFloat(a.weight);
    if (!isNaN(s) && m > 0 && w > 0) earned += (s / m) * w;
    if (!isNaN(w) && w > 0) cW += w;
  }
  const rW = remaining.reduce((s, a) => s + (parseFloat(a.weight) || 0), 0);
  const best = earned + rW, worst = earned;
  let status, reqPct;
  if (rW === 0) {
    status = earned >= target ? 'guaranteed' : 'impossible'; reqPct = null;
  } else {
    reqPct = (target - earned) / rW * 100;
    status = reqPct <= 0 ? 'guaranteed' : reqPct > 100 ? 'impossible' : 'ok';
  }
  const per = remaining.map(a => {
    const m = parseFloat(a.max) || 0;
    return { ...a, neededPct: reqPct, neededScore: reqPct != null && m > 0 ? reqPct / 100 * m : null };
  });
  return { mode: 'weighted', currentGrade: earned, best, worst, status, reqPct, cW, rW, target, per };
}

function gcCalcP({ completed, remaining, target }) {
  let earned = 0, cMax = 0;
  for (const a of completed) {
    const s = parseFloat(a.score), m = parseFloat(a.max);
    if (!isNaN(s) && m > 0) { earned += s; cMax += m; }
  }
  const rMax = remaining.reduce((s, a) => s + (parseFloat(a.max) || 0), 0);
  const totalMax = cMax + rMax;
  const currentGrade = cMax > 0 ? earned / cMax * 100 : null;
  const best = totalMax > 0 ? (earned + rMax) / totalMax * 100 : null;
  const worst = totalMax > 0 ? earned / totalMax * 100 : null;
  let status, reqPct;
  if (rMax === 0) {
    status = (worst ?? 0) >= target ? 'guaranteed' : 'impossible'; reqPct = null;
  } else {
    reqPct = (target / 100 * totalMax - earned) / rMax * 100;
    status = reqPct <= 0 ? 'guaranteed' : reqPct > 100 ? 'impossible' : 'ok';
  }
  const per = remaining.map(a => {
    const m = parseFloat(a.max) || 0;
    return { ...a, neededPct: reqPct, neededScore: reqPct != null && m > 0 ? reqPct / 100 * m : null };
  });
  return { mode: 'points', currentGrade, best, worst, status, reqPct, totalMax, cMax, rMax, earned, target, per };
}

// ── Render ────────────────────────────────────────────────────
function renderCalc() {
  const sec = document.getElementById('sec-grades');
  if (!sec || !sec.classList.contains('active')) return;
  const c = gcActive(), res = gcCalc(c);
  sec.innerHTML = `
    <div class="hdr">
      <div class="hdr-l"><h1>Grade Calculator</h1><p>Project your final grade in real time.</p></div>
      <div style="display:flex;gap:8px">
        <button onclick="gcExport()" style="font-size:12px;padding:6px 12px">Export</button>
        <button class="bp" onclick="gcAddCourse()">+ Course</button>
      </div>
    </div>
    <div class="content">
      ${gcTabsHtml()}
      ${gcBodyHtml(c, res)}
    </div>`;
}

function gcTabsHtml() {
  const active = gcActive();
  return `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
    ${GC.courses.map(c => `
      <div style="display:flex;align-items:center">
        <span class="tpill${c.id === active.id ? ' on' : ''}" onclick="gcSwitchCourse('${c.id}')">${gcEsc(c.name)}</span>
        ${GC.courses.length > 1 ? `<button class="xb" onclick="gcRemoveCourse('${c.id}')" style="margin-left:1px">✕</button>` : ''}
      </div>`).join('')}
  </div>`;
}

function gcBodyHtml(c, res) {
  const isW = c.mode === 'weighted';
  const all = [...c.completed, ...c.remaining];
  const totalW = all.reduce((s, a) => s + (parseFloat(a.weight) || 0), 0);
  const showWarn = isW && all.length > 0 && Math.abs(totalW - 100) > 0.5;

  return `
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:160px">
        <label style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;font-weight:600;white-space:nowrap">Course</label>
        <input type="text" value="${gcEsc(c.name)}" placeholder="Course name" oninput="gcSetName(this.value)" style="flex:1;min-width:0"/>
      </div>
      <div style="display:flex;border:0.5px solid var(--bds);border-radius:var(--r);overflow:hidden;flex-shrink:0">
        <button onclick="gcSetMode('weighted')" style="border:none;border-radius:0;padding:5px 12px;font-size:12px;font-weight:500;${isW ? 'background:var(--acc);color:#fff' : ''}">Weighted %</button>
        <button onclick="gcSetMode('points')" style="border:none;border-radius:0;border-left:0.5px solid var(--bds);padding:5px 12px;font-size:12px;font-weight:500;${!isW ? 'background:var(--acc);color:#fff' : ''}">Total Points</button>
      </div>
    </div>
    <div id="gc-warn" style="background:var(--famber);color:var(--amber);border-radius:var(--r);padding:8px 12px;font-size:12px;margin-bottom:12px;${showWarn ? '' : 'display:none'}">
      ⚠ Weights total ${totalW.toFixed(1)}% — they should add up to 100%.
    </div>
    <div class="gc-tables">
      ${gcTableHtml(c, 'completed', isW)}
      ${gcTableHtml(c, 'remaining', isW)}
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <span style="font-size:11px;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Target Grade</span>
      <input type="number" min="0" max="100" value="${gcEsc(String(c.target))}" oninput="gcSetTarget(this.value)"
        style="width:68px;text-align:center;font-size:15px;font-weight:600"/>
      <span style="font-size:13px;color:var(--tx2)">%</span>
    </div>
    <div id="gc-results">${gcResultsHtml(res, c)}</div>`;
}

function gcTableHtml(c, type, isW) {
  const rows = c[type], isC = type === 'completed';
  const colCount = isC ? (isW ? 5 : 4) : (isW ? 4 : 3);
  const thStyle = 'padding:4px 5px;font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;white-space:nowrap';

  return `<div class="card" style="padding:12px 14px">
    <div class="st">${isC ? 'Completed' : 'Remaining'}</div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:0.5px solid var(--bd)">
          <th style="${thStyle};text-align:left">Name</th>
          ${isC ? `<th style="${thStyle};text-align:center">Score</th>` : ''}
          <th style="${thStyle};text-align:center">Max</th>
          ${isW ? `<th style="${thStyle};text-align:center">Wt %</th>` : ''}
          <th style="width:24px"></th>
        </tr></thead>
        <tbody>
          ${rows.map(r => gcRowHtml(type, r, isW, isC)).join('')}
          ${rows.length === 0 ? `<tr><td colspan="${colCount}" style="text-align:center;padding:14px;font-size:12px;color:var(--tx3)">No assessments yet</td></tr>` : ''}
        </tbody>
      </table>
    </div>
    <button onclick="gcAddRow('${type}')" style="margin-top:8px;font-size:12px;padding:4px 10px;width:100%">+ Add</button>
  </div>`;
}

function gcRowHtml(type, r, isW, isC) {
  const id = r.id;
  const ni = (field, val, w, ph = '') =>
    `<input type="${field === 'name' ? 'text' : 'number'}" value="${gcEsc(String(val))}" placeholder="${ph}" ` +
    `style="width:${w};font-size:12px;padding:3px 5px;text-align:${field === 'name' ? 'left' : 'center'}" ` +
    `oninput="gcInput('${type}','${id}','${field}',this.value)"/>`;

  return `<tr style="border-bottom:0.5px solid var(--bd)">
    <td style="padding:3px 4px">${ni('name', r.name, '88px', 'Name')}</td>
    ${isC ? `<td style="padding:3px 4px">${ni('score', r.score, '50px', '—')}</td>` : ''}
    <td style="padding:3px 4px">${ni('max', r.max, '50px')}</td>
    ${isW ? `<td style="padding:3px 4px">${ni('weight', r.weight, '46px', '—')}</td>` : ''}
    <td style="padding:3px 4px;text-align:right"><button class="xb" onclick="gcRemoveRow('${type}','${id}')">✕</button></td>
  </tr>`;
}

function gcResultsHtml(res, c) {
  if (c.completed.length === 0 && c.remaining.length === 0) {
    return `<div class="card" style="text-align:center;padding:28px 16px">
      <div style="font-size:28px;margin-bottom:8px">📊</div>
      <div style="font-weight:600;margin-bottom:4px">Add assessments to get started</div>
      <div style="font-size:12px;color:var(--tx2)">Enter completed work above, then add remaining assessments to see what scores you need.</div>
    </div>`;
  }

  const { mode, status, currentGrade, best, worst, reqPct, per, target } = res;
  const pct = v => v != null ? v.toFixed(1) + '%' : '—';

  const statusHtml = status === 'guaranteed'
    ? `<div style="background:var(--fgreen);color:var(--green);border-radius:var(--r);padding:10px 14px;font-size:13px;margin-bottom:12px;font-weight:500">✓ Target already guaranteed — you'll reach ${target}% even with zero on the rest.</div>`
    : status === 'impossible'
    ? `<div style="background:var(--fred);color:var(--red);border-radius:var(--r);padding:10px 14px;font-size:13px;margin-bottom:12px;font-weight:500">✗ Target not reachable — you'd need ${reqPct != null ? reqPct.toFixed(1) + '%' : 'over 100%'} on all remaining work.</div>`
    : '';

  const reqVal = status === 'guaranteed' ? 'Guaranteed' : status === 'impossible' ? '> 100%' : pct(reqPct);
  const reqColor = status === 'impossible' ? 'var(--red)' : status === 'guaranteed' ? 'var(--green)' : '';

  const summary = `<div class="gc-sum">
    <div class="mc"><div class="ml">Current</div><div class="mv">${pct(currentGrade)}</div></div>
    <div class="mc"><div class="ml">Required avg</div><div class="mv" style="${reqColor ? 'color:' + reqColor : ''}">${reqVal}</div></div>
    <div class="mc"><div class="ml">Best case</div><div class="mv" style="color:var(--green)">${pct(best)}</div></div>
    <div class="mc"><div class="ml">Worst case</div><div class="mv" style="${(worst ?? 0) < target ? 'color:var(--red)' : ''}">${pct(worst)}</div></div>
  </div>`;

  let breakdown = '';
  if (per.length > 0 && status !== 'guaranteed') {
    const th = t => `<th style="padding:5px 7px;font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;${t === 'Name' ? 'text-align:left' : 'text-align:center'}">${t}</th>`;
    breakdown = `<div class="card" style="padding:12px 14px">
      <div class="st">Scores Needed — Remaining Assessments</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="border-bottom:0.5px solid var(--bd)">
          ${th('Name')}${mode === 'weighted' ? th('Weight') : ''}${th('Max')}${th('Need (pts)')}${th('Need (%)')}
        </tr></thead>
        <tbody>
          ${per.map(a => {
            const imp = status === 'impossible';
            const name = a.name ? gcEsc(a.name) : `<span style="color:var(--tx3);font-style:italic">Unnamed</span>`;
            return `<tr style="border-bottom:0.5px solid var(--bd)">
              <td style="padding:6px 7px">${name}</td>
              ${mode === 'weighted' ? `<td style="padding:6px 7px;text-align:center;color:var(--tx2)">${a.weight || '—'}%</td>` : ''}
              <td style="padding:6px 7px;text-align:center;color:var(--tx2)">${a.max}</td>
              <td style="padding:6px 7px;text-align:center;font-weight:600;${imp ? 'color:var(--red)' : ''}">${a.neededScore != null ? a.neededScore.toFixed(1) : '—'}</td>
              <td style="padding:6px 7px;text-align:center;${imp ? 'color:var(--red)' : ''}">${a.neededPct != null ? a.neededPct.toFixed(1) + '%' : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  }

  return statusHtml + summary + breakdown;
}

function gcRefreshResults() {
  const c = gcActive(), res = gcCalc(c);
  const el = document.getElementById('gc-results');
  if (el) el.innerHTML = gcResultsHtml(res, c);

  const isW = c.mode === 'weighted';
  const all = [...c.completed, ...c.remaining];
  const totalW = all.reduce((s, a) => s + (parseFloat(a.weight) || 0), 0);
  const show = isW && all.length > 0 && Math.abs(totalW - 100) > 0.5;
  const warn = document.getElementById('gc-warn');
  if (warn) {
    warn.style.display = show ? '' : 'none';
    warn.textContent = `⚠ Weights total ${totalW.toFixed(1)}% — they should add up to 100%.`;
  }
}

function gcExport() {
  const c = gcActive(), res = gcCalc(c);
  const pct = v => v != null ? v.toFixed(1) + '%' : '—';
  let txt = `Grade Projection — ${c.name}\n`;
  txt += `Mode: ${c.mode === 'weighted' ? 'Weighted %' : 'Total Points'}  |  Target: ${c.target}%\n\n`;
  txt += `Current grade:  ${pct(res.currentGrade)}\n`;
  txt += `Required avg:   ${res.status === 'guaranteed' ? 'Guaranteed ✓' : res.status === 'impossible' ? 'Not reachable ✗' : pct(res.reqPct)}\n`;
  txt += `Best case:      ${pct(res.best)}\n`;
  txt += `Worst case:     ${pct(res.worst)}\n`;
  if (c.completed.length) {
    txt += `\nCompleted:\n`;
    c.completed.forEach(a => {
      txt += `  ${a.name || 'Unnamed'}: ${a.score}/${a.max}`;
      if (c.mode === 'weighted') txt += ` (weight: ${a.weight || '—'}%)`;
      txt += '\n';
    });
  }
  if (res.per.length) {
    txt += `\nRemaining — needed scores:\n`;
    res.per.forEach(a => {
      txt += `  ${a.name || 'Unnamed'}: ${a.neededScore?.toFixed(1) ?? '—'} / ${a.max} = ${a.neededPct?.toFixed(1) ?? '—'}%`;
      if (c.mode === 'weighted') txt += ` (weight: ${a.weight || '—'}%)`;
      txt += '\n';
    });
  }

  const doCopy = s => {
    if (navigator.clipboard) return navigator.clipboard.writeText(s);
    const ta = document.createElement('textarea'); ta.value = s;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    return Promise.resolve();
  };
  doCopy(txt).then(() => {
    const btn = document.querySelector('[onclick="gcExport()"]');
    if (btn) { const o = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = o, 1500); }
  });
}

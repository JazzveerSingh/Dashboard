// ── Grade History ─────────────────────────────────────────────
const GH_PRE = 'gh_';
const ghOpen = new Set(); // expanded course IDs

function ghKey(cid) { return GH_PRE + cid; }

function ghLoad(cid) {
  try { return JSON.parse(localStorage.getItem(ghKey(cid))) || []; }
  catch { return []; }
}

function ghSave(cid, entries) {
  try { localStorage.setItem(ghKey(cid), JSON.stringify(entries)); }
  catch {}
}

function ghSorted(cid) {
  return ghLoad(cid).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Trend ─────────────────────────────────────────────────────
function ghTrend(entries) {
  if (entries.length < 2) return 'flat';
  const s = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const diff = s[s.length - 1].grade - s[0].grade;
  return diff > 1 ? 'up' : diff < -1 ? 'down' : 'flat';
}

function ghColor(trend) {
  return trend === 'up' ? '#3da870' : trend === 'down' ? '#d95050' : '#8080a0';
}

function ghArrow(trend) {
  return trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
}

// ── Sparkline (small, non-interactive) ────────────────────────
function ghSparkline(entries, w, h) {
  const s = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (s.length < 2) return '';
  const gs = s.map(e => e.grade);
  const lo = Math.min(...gs), hi = Math.max(...gs), range = hi - lo || 1;
  const trend = ghTrend(s);
  const col = ghColor(trend);
  const pad = 2;
  const pts = s.map((e, i) => {
    const x = pad + (i / (s.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (e.grade - lo) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:inline-block;vertical-align:middle;flex-shrink:0">
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// ── Full chart (interactive via SVG title tooltips) ────────────
function ghChart(entries) {
  const s = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (s.length < 2) {
    return `<div style="text-align:center;padding:14px 0;font-size:12px;color:var(--tx3)">Add at least 2 entries to see a trend line.</div>`;
  }
  const gs = s.map(e => e.grade);
  const lo = Math.max(0, Math.min(...gs) - 5), hi = Math.min(100, Math.max(...gs) + 5), range = hi - lo || 1;
  const W = 400, H = 80, pl = 4, pr = 4, pt = 8, pb = 8;
  const iW = W - pl - pr, iH = H - pt - pb;
  const trend = ghTrend(s);
  const col = ghColor(trend);
  const fmtD = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

  const pts = s.map((e, i) => ({
    x: pl + (s.length > 1 ? i / (s.length - 1) : 0.5) * iW,
    y: pt + (1 - (e.grade - lo) / range) * iH,
    date: e.date, grade: e.grade
  }));

  const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = [
    `${pts[0].x.toFixed(1)},${(H - pb).toFixed(1)}`,
    ...pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${pts[pts.length - 1].x.toFixed(1)},${(H - pb).toFixed(1)}`
  ].join(' ');

  const dots = pts.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${col}" stroke="var(--bg2)" stroke-width="1.5">
      <title>${fmtD(p.date)}: ${p.grade}%</title>
    </circle>`
  ).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:80px;display:block;overflow:visible">
    <polygon points="${area}" fill="${col}" fill-opacity="0.09"/>
    <polyline points="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
  </svg>`;
}

// ── Mutations ─────────────────────────────────────────────────
function ghToggle(cid) {
  ghOpen.has(cid) ? ghOpen.delete(cid) : ghOpen.add(cid);
  renderAcademics();
}

function ghAppend(cid, val) {
  const g = parseFloat(val);
  if (isNaN(g) || g < 0 || g > 100) return;
  const entries = ghLoad(cid);
  const today = new Date().toISOString().slice(0, 10);
  const idx = entries.findIndex(e => e.date === today);
  if (idx >= 0) {
    if (entries[idx].grade === g) return; // no change
    entries[idx].grade = g;
  } else {
    entries.push({ date: today, grade: g });
  }
  ghSave(cid, entries);
  // Targeted DOM update — don't full re-render, avoid disrupting open inputs
  const sp = document.getElementById(`gh-sp-${cid}`);
  if (sp) sp.innerHTML = ghInlineSpark(cid);
  const meta = document.getElementById('ac-spark');
  if (meta) meta.innerHTML = ghGpaSpark();
}

function ghAddEntry(cid) {
  const dEl = document.getElementById(`gh-d-${cid}`);
  const gEl = document.getElementById(`gh-g-${cid}`);
  if (!dEl || !gEl) return;
  const date = dEl.value, g = parseFloat(gEl.value);
  if (!date || isNaN(g)) return;
  const entries = ghLoad(cid);
  const idx = entries.findIndex(e => e.date === date);
  if (idx >= 0) entries[idx].grade = g; else entries.push({ date, grade: g });
  ghSave(cid, entries);
  dEl.value = ''; gEl.value = '';
  renderAcademics();
}

function ghDeleteEntry(cid, date) {
  ghSave(cid, ghLoad(cid).filter(e => e.date !== date));
  renderAcademics();
}

// ── HTML helpers ──────────────────────────────────────────────
function ghInlineSpark(cid) {
  const entries = ghSorted(cid);
  if (entries.length < 2) return '';
  const trend = ghTrend(entries);
  return ghSparkline(entries, 54, 18) +
    `<span style="font-size:11px;color:${ghColor(trend)};margin-left:3px">${ghArrow(trend)}</span>`;
}

function ghHistoryHtml(c) {
  const entries = ghSorted(c.id);
  const isOpen = ghOpen.has(c.id);
  const fmtD = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  const today = new Date().toISOString().slice(0, 10);

  const toggle = `<div style="display:flex;align-items:center;gap:6px;margin-top:10px;cursor:pointer;user-select:none" onclick="ghToggle(${c.id})">
    <span style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Grade History</span>
    <span id="gh-sp-${c.id}" style="display:inline-flex;align-items:center">${ghInlineSpark(c.id)}</span>
    <span style="font-size:11px;color:var(--tx3);margin-left:auto">${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} ${isOpen ? '▲' : '▼'}</span>
  </div>`;

  if (!isOpen) return toggle;

  const chart = ghChart(entries);

  const list = entries.length ? entries.map(e =>
    `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--bd);font-size:12px">
      <span style="flex:1;color:var(--tx2)">${fmtD(e.date)}</span>
      <span style="font-weight:600">${e.grade}%</span>
      <button class="xb" onclick="ghDeleteEntry(${c.id},'${e.date}')">✕</button>
    </div>`
  ).join('') : `<div style="font-size:12px;color:var(--tx3);padding:8px 0">No entries yet.</div>`;

  const form = `<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center">
    <input type="date" id="gh-d-${c.id}" max="${today}" style="flex:1;min-width:120px;font-size:12px;padding:5px 8px"/>
    <input type="number" id="gh-g-${c.id}" min="0" max="100" placeholder="Grade %" style="width:80px;font-size:12px;padding:5px 8px;text-align:center"/>
    <button onclick="ghAddEntry(${c.id})" style="font-size:12px;padding:5px 10px">+ Log</button>
  </div>`;

  return `${toggle}<div style="margin-top:8px">${chart}</div>
    <div style="border-top:0.5px solid var(--bd);padding-top:6px;margin-top:6px">${list}</div>
    ${form}`;
}

// ── Overall GPA sparkline ─────────────────────────────────────
function ghGpaSpark() {
  if (!window.S || !S.courses || !S.courses.length) return '';
  const histMap = {};
  const allDates = new Set();
  S.courses.forEach(c => {
    histMap[c.id] = ghSorted(c.id);
    histMap[c.id].forEach(e => allDates.add(e.date));
  });
  if (allDates.size < 2) return '';

  const dates = [...allDates].sort();
  const series = [];
  dates.forEach(date => {
    const grades = S.courses.map(c => {
      const h = histMap[c.id].filter(e => e.date <= date);
      return h.length ? h[h.length - 1].grade : null;
    }).filter(g => g != null);
    if (grades.length) series.push({ date, grade: grades.reduce((a, b) => a + b, 0) / grades.length });
  });

  return series.length >= 2 ? ghSparkline(series, 60, 20) : '';
}

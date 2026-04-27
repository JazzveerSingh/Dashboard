// ── Grade History ─────────────────────────────────────────────
const GH_PRE = 'gh_';
const ghOpen = new Set();

function ghKey(cid) { return GH_PRE + cid; }
function ghLoad(cid) { try { return JSON.parse(localStorage.getItem(ghKey(cid))) || []; } catch { return []; } }
function ghSave(cid, entries) { try { localStorage.setItem(ghKey(cid), JSON.stringify(entries)); } catch {} }

function ghSorted(cid) {
  return ghLoad(cid).sort((a, b) => {
    const ta = a.ts || (a.date + 'T12:00:00'), tb = b.ts || (b.date + 'T12:00:00');
    return ta.localeCompare(tb);
  });
}

// ── Trend ─────────────────────────────────────────────────────
function ghTrend(entries) {
  if (entries.length < 2) return 'flat';
  const s = [...entries].sort((a, b) => (a.ts || a.date).localeCompare(b.ts || b.date));
  const diff = s[s.length - 1].grade - s[0].grade;
  return diff > 1 ? 'up' : diff < -1 ? 'down' : 'flat';
}
function ghColor(trend) { return trend === 'up' ? '#3da870' : trend === 'down' ? '#d95050' : '#8080a0'; }
function ghArrow(trend) { return trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'; }

// ── Time helpers ──────────────────────────────────────────────
function ghTs(e) { return new Date(e.ts || (e.date + 'T12:00:00')).getTime(); }

function ghXAxis(tMin, tMax, pl, iW, H, pb) {
  const rangeMs = tMax - tMin, dayMs = 86400000, rangeDays = rangeMs / dayMs;
  let ticks = [];
  const addTick = (t, label) => {
    if (tMax === tMin) return;
    const x = pl + ((t - tMin) / rangeMs) * iW;
    if (x >= pl - 2 && x <= pl + iW + 2) ticks.push({ x, label });
  };
  if (rangeDays < 14) {
    const d = new Date(tMin); d.setHours(0, 0, 0, 0);
    while (d.getTime() <= tMax + dayMs) {
      addTick(d.getTime(), d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }));
      d.setDate(d.getDate() + 1);
    }
  } else if (rangeDays < 60) {
    const d = new Date(tMin); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay());
    while (d.getTime() <= tMax + dayMs * 7) {
      addTick(d.getTime(), d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }));
      d.setDate(d.getDate() + 7);
    }
  } else {
    const d = new Date(tMin); d.setDate(1); d.setHours(0, 0, 0, 0);
    while (d.getTime() <= tMax + dayMs * 31) {
      addTick(d.getTime(), d.toLocaleDateString('en-CA', { month: 'short' }));
      d.setMonth(d.getMonth() + 1);
    }
  }
  if (ticks.length > 6) { const step = Math.ceil(ticks.length / 5); ticks = ticks.filter((_, i) => i % step === 0); }
  const ay = H - pb;
  return `<line x1="${pl}" y1="${ay}" x2="${pl + iW}" y2="${ay}" stroke="var(--bd)" stroke-width="0.5"/>` +
    ticks.map(t =>
      `<line x1="${t.x.toFixed(1)}" y1="${ay}" x2="${t.x.toFixed(1)}" y2="${ay + 3}" stroke="var(--tx3)" stroke-width="0.5"/>` +
      `<text x="${t.x.toFixed(1)}" y="${ay + 11}" text-anchor="middle" font-size="7" fill="var(--tx3)">${t.label}</text>`
    ).join('');
}

// ── Sparkline (small, time-proportional) ──────────────────────
function ghSparkline(entries, w, h) {
  const s = [...entries].sort((a, b) => (a.ts || a.date).localeCompare(b.ts || b.date));
  if (s.length < 2) return '';
  const gs = s.map(e => e.grade);
  const lo = Math.min(...gs), hi = Math.max(...gs), range = hi - lo || 1;
  const trend = ghTrend(s), col = ghColor(trend), pad = 2;
  const times = s.map(ghTs), tMin = Math.min(...times), tRange = Math.max(...times) - tMin || 1;
  const pts = s.map((e, i) => {
    const x = pad + ((times[i] - tMin) / tRange) * (w - pad * 2);
    const y = pad + (1 - (e.grade - lo) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:inline-block;vertical-align:middle;flex-shrink:0">
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// ── Full chart (time-proportional X, open circles for backfill) ─
function ghChart(entries) {
  const s = [...entries].sort((a, b) => (a.ts || a.date).localeCompare(b.ts || b.date));
  if (s.length < 2) return `<div style="text-align:center;padding:14px 0;font-size:12px;color:var(--tx3)">Add at least 2 entries to see a trend line.</div>`;

  const gs = s.map(e => e.grade);
  const lo = Math.max(0, Math.min(...gs) - 5), hi = Math.min(100, Math.max(...gs) + 5), range = hi - lo || 1;
  const W = 400, H = 100, pl = 26, pr = 4, pt = 8, pb = 20, iW = W - pl - pr, iH = H - pt - pb;
  const trend = ghTrend(s), col = ghColor(trend);

  const times = s.map(ghTs), tMin = Math.min(...times), tMax = Math.max(...times), tRange = tMax - tMin || 1;

  const pts = s.map((e, i) => ({
    x: pl + ((times[i] - tMin) / tRange) * iW,
    y: pt + (1 - (e.grade - lo) / range) * iH,
    entry: e
  }));

  const fmtTs = e => {
    const d = new Date(e.ts || (e.date + 'T12:00:00'));
    const ds = d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    const ts = e.ts ? ' at ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }) : '';
    return ds + ts;
  };

  const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = [
    `${pts[0].x.toFixed(1)},${H - pb}`,
    ...pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${pts[pts.length - 1].x.toFixed(1)},${H - pb}`
  ].join(' ');

  const dots = pts.map(p => {
    const e = p.entry;
    const editedLine = e.updated_at
      ? `&#10;Edited ${new Date(e.updated_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}` : '';
    const backfillLine = e.backfill ? '&#10;(backfilled)' : '';
    const title = `${fmtTs(e)}: ${e.grade.toFixed(1)}%${editedLine}${backfillLine}`;
    return e.backfill
      ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--bg2)" stroke="${col}" stroke-width="1.5"><title>${title}</title></circle>`
      : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${col}" stroke="var(--bg2)" stroke-width="1.5"><title>${title}</title></circle>`;
  }).join('');

  const yTicks = [lo, (lo + hi) / 2, hi];
  const yAxis = yTicks.map(v => {
    const y = pt + (1 - (v - lo) / range) * iH;
    return `<line x1="${pl}" y1="${y.toFixed(1)}" x2="${pl + iW}" y2="${y.toFixed(1)}" stroke="var(--bd)" stroke-width="0.5"/>` +
      `<text x="${pl - 3}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="var(--tx3)">${v.toFixed(0)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100px;display:block;overflow:visible">
    ${yAxis}
    <polygon points="${area}" fill="${col}" fill-opacity="0.09"/>
    <polyline points="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    ${ghXAxis(tMin, tMax, pl, iW, H, pb)}
  </svg>`;
}

// ── Mutations ─────────────────────────────────────────────────
function ghToggle(cid) {
  ghOpen.has(cid) ? ghOpen.delete(cid) : ghOpen.add(cid);
  renderAcademics();
}

function ghAppend(cid, val, opts = {}) {
  const g = parseFloat(val);
  if (isNaN(g) || g < 0 || g > 100) return;
  const entries = ghLoad(cid);
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const idx = entries.findIndex(e => e.date === todayStr);
  if (idx >= 0) {
    if (entries[idx].grade === g && !opts.updated) return;
    entries[idx].grade = g;
    entries[idx].updated_at = now;
    if (!entries[idx].ts) entries[idx].ts = now;
  } else {
    entries.push({ date: todayStr, grade: g, ts: now });
  }
  ghSave(cid, entries);
  const sp = document.getElementById(`gh-sp-${cid}`);
  if (sp) sp.innerHTML = ghInlineSpark(cid);
  const meta = document.getElementById('ac-spark');
  if (meta) meta.innerHTML = ghGpaSpark();
}

function ghAddEntry(cid) {
  const dEl = document.getElementById(`gh-d-${cid}`), gEl = document.getElementById(`gh-g-${cid}`);
  if (!dEl || !gEl) return;
  const date = dEl.value, g = parseFloat(gEl.value);
  if (!date || isNaN(g)) return;
  const entries = ghLoad(cid);
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const isBackfill = date < todayStr;
  const idx = entries.findIndex(e => e.date === date);
  if (idx >= 0) {
    entries[idx].grade = g;
    if (!entries[idx].ts) entries[idx].ts = now;
    if (isBackfill) entries[idx].backfill = true;
  } else {
    const entry = { date, grade: g, ts: now };
    if (isBackfill) entry.backfill = true;
    entries.push(entry);
  }
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
  const todayStr = new Date().toISOString().slice(0, 10);

  const toggle = `<div style="display:flex;align-items:center;gap:6px;margin-top:10px;cursor:pointer;user-select:none" onclick="ghToggle(${c.id})">
    <span style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Grade History</span>
    <span id="gh-sp-${c.id}" style="display:inline-flex;align-items:center">${ghInlineSpark(c.id)}</span>
    <span style="font-size:11px;color:var(--tx3);margin-left:auto">${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} ${isOpen ? '▲' : '▼'}</span>
  </div>`;

  if (!isOpen) return toggle;

  const list = entries.length ? entries.map(e => {
    const editedNote = e.updated_at
      ? `<span style="font-size:10px;color:var(--tx3)" title="Edited ${fmtD(e.updated_at.slice(0,10))}">✎</span>` : '';
    const backfillBadge = e.backfill
      ? `<span style="font-size:9px;color:var(--tx3);border:0.5px solid var(--bd);border-radius:3px;padding:0 3px">backfill</span>` : '';
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:0.5px solid var(--bd);font-size:12px">
      <span style="flex:1;color:var(--tx2)">${fmtD(e.date)}</span>
      ${backfillBadge}${editedNote}
      <span style="font-weight:600">${e.grade}%</span>
      <button class="xb" onclick="ghDeleteEntry(${c.id},'${e.date}')">✕</button>
    </div>`;
  }).join('') : `<div style="font-size:12px;color:var(--tx3);padding:8px 0">No entries yet.</div>`;

  const form = `<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center">
    <input type="date" id="gh-d-${c.id}" max="${todayStr}" style="flex:1;min-width:120px;font-size:12px;padding:5px 8px"/>
    <input type="number" id="gh-g-${c.id}" min="0" max="100" placeholder="Grade %" style="width:80px;font-size:12px;padding:5px 8px;text-align:center"/>
    <button onclick="ghAddEntry(${c.id})" style="font-size:12px;padding:5px 10px">+ Log</button>
  </div>`;

  return `${toggle}<div style="margin-top:8px">${ghChart(entries)}</div>
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

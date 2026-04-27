// ── Grade History ─────────────────────────────────────────────
const GH_PRE = 'gh_';
const ghOpen = new Set();
const ghToggles = new Map(); // cid -> { showScores: bool, showAvg: bool }

// ── Manual grade log (legacy support) ────────────────────────
function ghKey(cid) { return GH_PRE + cid; }
function ghLoad(cid) { try { return JSON.parse(localStorage.getItem(ghKey(cid))) || []; } catch { return []; } }
function ghSave(cid, entries) { try { localStorage.setItem(ghKey(cid), JSON.stringify(entries)); } catch {} }
function ghSorted(cid) {
  return ghLoad(cid).sort((a, b) => (a.ts || a.date).localeCompare(b.ts || b.date));
}

// ── Assignment-based data ─────────────────────────────────────
function ghBuildAssignData(cid) {
  const assigns = (window.S?.assignments || []).filter(a => a.course_id === cid);
  const asgn = (typeof caLoad === 'function') ? (caLoad(cid).asgn || {}) : {};
  const result = [];
  for (const a of assigns) {
    const d = asgn[a.id] || {};
    if (d.score == null) continue;
    const ts = a.created_at || d.score_ts || null;
    if (!ts) continue;
    result.push({
      id: a.id, name: a.name,
      score: d.score, max: d.max ?? 100, weight: d.weight ?? 1,
      pct: d.score / (d.max ?? 100) * 100,
      ts, loggedAt: a.created_at || d.score_ts,
      isTest: d.type === 'test'
    });
  }
  return result.sort((a, b) => a.ts.localeCompare(b.ts));
}

function ghBuildTrend(assignData) {
  let totalScore = 0, totalMax = 0;
  return assignData.map(a => {
    totalScore += a.score * a.weight;
    totalMax += a.max * a.weight;
    return { ts: a.ts, avg: totalMax > 0 ? totalScore / totalMax * 100 : null };
  });
}

// ── Toggle state ──────────────────────────────────────────────
function ghGetToggle(cid) {
  if (!ghToggles.has(cid)) ghToggles.set(cid, { showScores: true, showAvg: true });
  return ghToggles.get(cid);
}
function ghToggleLayer(cid, key) {
  const t = ghGetToggle(cid);
  const other = key === 'showScores' ? 'showAvg' : 'showScores';
  if (t[key] && !t[other]) return; // keep at least one on
  t[key] = !t[key];
  renderAcademics();
}

// ── Trend / colour helpers ────────────────────────────────────
function ghTrend(entries) {
  if (entries.length < 2) return 'flat';
  const s = [...entries].sort((a, b) => (a.ts || a.date).localeCompare(b.ts || b.date));
  const diff = s[s.length - 1].grade - s[0].grade;
  return diff > 1 ? 'up' : diff < -1 ? 'down' : 'flat';
}
function ghColor(trend) { return trend === 'up' ? '#3da870' : trend === 'down' ? '#d95050' : '#8080a0'; }
function ghArrow(trend) { return trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'; }
function ghTs(e) { return new Date(e.ts || (e.date + 'T12:00:00')).getTime(); }

const TREND_COL = '#8080a0';

// ── Time axis SVG ─────────────────────────────────────────────
function ghXAxis(tMin, tMax, pl, iW, H, pb) {
  if (tMax === tMin) return '';
  const rangeMs = tMax - tMin, dayMs = 86400000, rangeDays = rangeMs / dayMs;
  let ticks = [];
  const addTick = (t, label) => {
    const x = pl + ((t - tMin) / rangeMs) * iW;
    if (x >= pl - 2 && x <= pl + iW + 2) ticks.push({ x, label });
  };
  if (rangeDays < 14) {
    const d = new Date(tMin); d.setHours(0, 0, 0, 0);
    while (d.getTime() <= tMax + dayMs) { addTick(d.getTime(), d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })); d.setDate(d.getDate() + 1); }
  } else if (rangeDays < 60) {
    const d = new Date(tMin); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay());
    while (d.getTime() <= tMax + dayMs * 7) { addTick(d.getTime(), d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })); d.setDate(d.getDate() + 7); }
  } else {
    const d = new Date(tMin); d.setDate(1); d.setHours(0, 0, 0, 0);
    while (d.getTime() <= tMax + dayMs * 31) { addTick(d.getTime(), d.toLocaleDateString('en-CA', { month: 'short' })); d.setMonth(d.getMonth() + 1); }
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

function ghInlineSpark(cid) {
  // Prefer assignment trend data
  const assignData = ghBuildAssignData(cid);
  if (assignData.length >= 2) {
    const trend = ghBuildTrend(assignData);
    const te = trend.filter(t => t.avg != null).map(t => ({ grade: t.avg, ts: t.ts, date: t.ts.slice(0, 10) }));
    if (te.length >= 2) {
      const tr = ghTrend(te);
      return ghSparkline(te, 54, 18) + `<span style="font-size:11px;color:${ghColor(tr)};margin-left:3px">${ghArrow(tr)}</span>`;
    }
  }
  // Fall back to manual log
  const entries = ghSorted(cid);
  if (entries.length < 2) return '';
  const tr = ghTrend(entries);
  return ghSparkline(entries, 54, 18) + `<span style="font-size:11px;color:${ghColor(tr)};margin-left:3px">${ghArrow(tr)}</span>`;
}

// ── Dual-layer chart ──────────────────────────────────────────
function ghChartDual(cid, courseColor) {
  const assignData = ghBuildAssignData(cid);
  const trendData = ghBuildTrend(assignData);
  const toggle = ghGetToggle(cid);

  if (assignData.length === 0) return `<div style="text-align:center;padding:20px 0;font-size:12px;color:var(--tx3)">Score assignments to see the chart.</div>`;

  const allPcts = assignData.map(a => a.pct);
  const trendAvgs = trendData.filter(t => t.avg != null).map(t => t.avg);
  const allVals = [...allPcts, ...trendAvgs];
  const lo = Math.max(0, Math.min(...allVals) - 5), hi = Math.min(100, Math.max(...allVals) + 5), range = hi - lo || 1;

  const W = 400, H = 100, pl = 26, pr = 4, pt = 8, pb = 20, iW = W - pl - pr, iH = H - pt - pb;
  const times = assignData.map(a => new Date(a.ts).getTime());
  const tMin = Math.min(...times), tMax = Math.max(...times), tRange = tMax - tMin || 1;
  const toX = t => pl + ((new Date(t).getTime() - tMin) / tRange) * iW;
  const toY = v => pt + (1 - (v - lo) / range) * iH;

  // Y axis
  const yTicks = [lo, (lo + hi) / 2, hi];
  const yAxis = yTicks.map(v => {
    const y = toY(v);
    return `<line x1="${pl}" y1="${y.toFixed(1)}" x2="${pl + iW}" y2="${y.toFixed(1)}" stroke="var(--bd)" stroke-width="0.5"/>` +
      `<text x="${pl - 3}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="var(--tx3)">${v.toFixed(0)}</text>`;
  }).join('');

  // Trend line (drawn first so dots sit on top)
  let trendSvg = '';
  if (toggle.showAvg && trendData.length >= 2) {
    const pts = trendData.filter(t => t.avg != null)
      .map(t => `${toX(t.ts).toFixed(1)},${toY(t.avg).toFixed(1)}`).join(' ');
    trendSvg = `<polyline points="${pts}" fill="none" stroke="${TREND_COL}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Individual score points (circles = assignments, diamonds = tests)
  let dotsSvg = '';
  if (toggle.showScores) {
    dotsSvg = assignData.map(a => {
      const cx = toX(a.ts), cy = toY(a.pct);
      const logTs = new Date(a.loggedAt || a.ts).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
      const title = `${a.name}&#10;${a.score}/${a.max} · ${a.pct.toFixed(1)}%&#10;${logTs}`;
      if (a.isTest) {
        const r = 4.5;
        const dp = `${cx.toFixed(1)},${(cy - r).toFixed(1)} ${(cx + r).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${(cy + r).toFixed(1)} ${(cx - r).toFixed(1)},${cy.toFixed(1)}`;
        return `<polygon points="${dp}" fill="${courseColor}" stroke="var(--bg2)" stroke-width="1.5"><title>${title}</title></polygon>`;
      }
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" fill="${courseColor}" stroke="var(--bg2)" stroke-width="1.5"><title>${title}</title></circle>`;
    }).join('');
  }

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100px;display:block;overflow:visible">
    ${yAxis}${trendSvg}${dotsSvg}
    ${ghXAxis(tMin, tMax, pl, iW, H, pb)}
  </svg>`;
}

// ── Mutations ─────────────────────────────────────────────────
function ghToggle(cid) { ghOpen.has(cid) ? ghOpen.delete(cid) : ghOpen.add(cid); renderAcademics(); }

function ghAppend(cid, val, opts = {}) {
  const g = parseFloat(val);
  if (isNaN(g) || g < 0 || g > 100) return;
  const entries = ghLoad(cid);
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const idx = entries.findIndex(e => e.date === todayStr);
  if (idx >= 0) {
    if (entries[idx].grade === g && !opts.updated) return;
    entries[idx].grade = g; entries[idx].updated_at = now;
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
  const idx = entries.findIndex(e => e.date === date);
  const isBackfill = date < todayStr;
  if (idx >= 0) {
    entries[idx].grade = g;
    if (!entries[idx].ts) entries[idx].ts = now;
    if (isBackfill) entries[idx].backfill = true;
  } else {
    const e = { date, grade: g, ts: now }; if (isBackfill) e.backfill = true; entries.push(e);
  }
  ghSave(cid, entries); dEl.value = ''; gEl.value = '';
  renderAcademics();
}

function ghDeleteEntry(cid, date) {
  ghSave(cid, ghLoad(cid).filter(e => e.date !== date));
  renderAcademics();
}

// ── History HTML ──────────────────────────────────────────────
function ghHistoryHtml(c) {
  const cid = c.id, isOpen = ghOpen.has(cid);
  const courseColor = getCourseColor(cid);
  const assignData = ghBuildAssignData(cid);
  const manualEntries = ghSorted(cid);
  const toggle = ghGetToggle(cid);

  const toggle$header = `<div style="display:flex;align-items:center;gap:6px;margin-top:10px;cursor:pointer;user-select:none" onclick="ghToggle(${cid})">
    <span style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Grade History</span>
    <span id="gh-sp-${cid}" style="display:inline-flex;align-items:center">${ghInlineSpark(cid)}</span>
    <span style="font-size:11px;color:var(--tx3);margin-left:auto">${assignData.length} scored ${isOpen ? '▲' : '▼'}</span>
  </div>`;

  if (!isOpen) return toggle$header;

  // Layer toggle buttons
  const pill = (active, bg, label, icon) =>
    `<button onclick="ghToggleLayer(${cid},'${active === toggle.showScores ? 'showScores' : 'showAvg'}')" ` +
    `style="font-size:11px;padding:3px 10px;border-radius:100px;border:1px solid ${toggle[active === toggle.showScores ? 'showScores' : 'showAvg'] ? bg : 'var(--bd)'};` +
    `background:${toggle[active === toggle.showScores ? 'showScores' : 'showAvg'] ? bg : 'transparent'};` +
    `color:${toggle[active === toggle.showScores ? 'showScores' : 'showAvg'] ? '#fff' : 'var(--tx2)'};cursor:pointer;display:inline-flex;align-items:center;gap:5px">${icon} ${label}</button>`;

  const scBtn = `<button onclick="ghToggleLayer(${cid},'showScores')"
    style="font-size:11px;padding:3px 10px;border-radius:100px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;
    border:1px solid ${toggle.showScores ? courseColor : 'var(--bd)'};
    background:${toggle.showScores ? courseColor : 'transparent'};
    color:${toggle.showScores ? '#fff' : 'var(--tx2)'}">
    <svg width="9" height="9" style="flex-shrink:0"><circle cx="4.5" cy="4.5" r="4.5" fill="${toggle.showScores ? '#fff' : courseColor}"/></svg>Scores
  </button>`;
  const avBtn = `<button onclick="ghToggleLayer(${cid},'showAvg')"
    style="font-size:11px;padding:3px 10px;border-radius:100px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;
    border:1px solid ${toggle.showAvg ? TREND_COL : 'var(--bd)'};
    background:${toggle.showAvg ? TREND_COL : 'transparent'};
    color:${toggle.showAvg ? '#fff' : 'var(--tx2)'}">
    <svg width="14" height="3" style="flex-shrink:0"><line x1="0" y1="1.5" x2="14" y2="1.5" stroke="${toggle.showAvg ? '#fff' : TREND_COL}" stroke-width="2.5" stroke-linecap="round"/></svg>Average
  </button>`;
  const toggleBtns = `<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">${scBtn}${avBtn}</div>`;

  // Chart
  const chartHtml = assignData.length > 0
    ? toggleBtns + ghChartDual(cid, courseColor)
    : `<div style="text-align:center;padding:20px 0;font-size:12px;color:var(--tx3)">Score assignments to see the chart.</div>`;

  // Manual grade log (collapsible, collapsed by default if there are scored assignments)
  const fmtD = d => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  const todayStr = new Date().toISOString().slice(0, 10);
  const manualList = manualEntries.map(e => {
    const edited = e.updated_at ? `<span style="font-size:10px;color:var(--tx3)" title="Edited ${fmtD(e.updated_at.slice(0,10))}">✎</span>` : '';
    const bf = e.backfill ? `<span style="font-size:9px;color:var(--tx3);border:0.5px solid var(--bd);border-radius:3px;padding:0 3px">backfill</span>` : '';
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:0.5px solid var(--bd);font-size:12px">
      <span style="flex:1;color:var(--tx2)">${fmtD(e.date)}</span>${bf}${edited}
      <span style="font-weight:600">${e.grade}%</span>
      <button class="xb" onclick="ghDeleteEntry(${cid},'${e.date}')">✕</button>
    </div>`;
  }).join('');
  const form = `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center">
    <input type="date" id="gh-d-${cid}" max="${todayStr}" style="flex:1;min-width:120px;font-size:12px;padding:5px 8px"/>
    <input type="number" id="gh-g-${cid}" min="0" max="100" placeholder="Grade %" style="width:80px;font-size:12px;padding:5px 8px;text-align:center"/>
    <button onclick="ghAddEntry(${cid})" style="font-size:12px;padding:5px 10px">+ Log</button>
  </div>`;
  const manualSection = `<details style="margin-top:10px"${assignData.length === 0 ? ' open' : ''}>
    <summary style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;font-weight:600;cursor:pointer;list-style:none;display:flex;align-items:center;gap:5px">
      Manual grade log<span style="color:var(--tx3)">(${manualEntries.length})</span>
    </summary>
    <div style="margin-top:6px">${manualList || '<div style="font-size:12px;color:var(--tx3);padding:6px 0">No entries yet.</div>'}</div>${form}
  </details>`;

  return `${toggle$header}<div style="margin-top:8px">${chartHtml}</div>${manualSection}`;
}

// ── Overall GPA sparkline ─────────────────────────────────────
function ghGpaSpark() {
  if (!window.S || !S.courses?.length) return '';
  // Collect trend data per course, find the latest avg per course at each timestamp
  const allPts = [];
  S.courses.forEach(c => {
    const trend = ghBuildTrend(ghBuildAssignData(c.id));
    trend.forEach(t => { if (t.avg != null) allPts.push({ ts: t.ts, grade: t.avg, cid: c.id }); });
  });
  if (allPts.length >= 2) {
    const sorted = allPts.sort((a, b) => a.ts.localeCompare(b.ts));
    const latest = {};
    const series = sorted.map(pt => {
      latest[pt.cid] = pt.grade;
      const vals = Object.values(latest);
      return { ts: pt.ts, date: pt.ts.slice(0, 10), grade: vals.reduce((a, b) => a + b, 0) / vals.length };
    });
    if (series.length >= 2) return ghSparkline(series, 60, 20);
  }
  // Fall back to manual grade history
  const histMap = {}, allDates = new Set();
  S.courses.forEach(c => { histMap[c.id] = ghSorted(c.id); histMap[c.id].forEach(e => allDates.add(e.date)); });
  if (allDates.size < 2) return '';
  const manualSeries = [...allDates].sort().map(date => {
    const grades = S.courses.map(c => { const h = histMap[c.id].filter(e => e.date <= date); return h.length ? h[h.length-1].grade : null; }).filter(g => g != null);
    return grades.length ? { date, grade: grades.reduce((a, b) => a + b, 0) / grades.length } : null;
  }).filter(Boolean);
  return manualSeries.length >= 2 ? ghSparkline(manualSeries, 60, 20) : '';
}

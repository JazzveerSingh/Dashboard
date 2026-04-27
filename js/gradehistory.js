// ── Grade History ─────────────────────────────────────────────
const ghOpen = new Set();
const ghToggles = new Map(); // cid -> { showScores: bool, showAvg: bool }

// ── Assignment-based data ─────────────────────────────────────
function ghBuildAssignData(cid) {
  const assigns = (window.S?.assignments || []).filter(a => String(a.course_id) === String(cid));
  const lsData = (typeof caLoad === 'function') ? caLoad(cid).asgn || {} : {};

  console.log(`[GH] course ${cid}: ${assigns.length} assignments in S, ls keys: [${Object.keys(lsData).join(',')}]`);
  console.log('[GH] raw S.assignments for course:', assigns.map(a => ({ id: a.id, name: a.name, score: a.score, max_score: a.max_score, created_at: a.created_at })));

  const result = [];

  for (const a of assigns) {
    const ls = lsData[a.id] || lsData[String(a.id)] || {};
    const score = a.score ?? ls.score;
    const max = a.max_score ?? ls.max ?? 100;
    const weight = a.weight ?? ls.weight ?? 1;
    const score_ts = a.score_ts ?? ls.score_ts;
    const tsSource = a.created_at || score_ts;

    console.log(`[GH] id=${a.id} "${a.name}": sb_score=${a.score} ls_score=${ls.score} → resolved=${score} | ts="${tsSource}"`);

    if (score == null) {
      console.log(`  → DROPPED: no score`);
      continue;
    }
    if (!tsSource) {
      console.warn(`  → DROPPED: no timestamp`);
      continue;
    }
    const tsMs = new Date(tsSource).getTime();
    if (Number.isNaN(tsMs)) {
      console.warn(`  → DROPPED: invalid timestamp "${tsSource}"`);
      continue;
    }

    const scoreF = parseFloat(score);
    const maxF   = parseFloat(max) || 100;
    const weightF = parseFloat(weight) || 1;
    const pct = maxF > 0 ? scoreF / maxF * 100 : 0;
    const type = a.type ?? ls.type ?? 'assignment';

    console.log(`  → INCLUDED pct=${pct.toFixed(1)}% ts=${new Date(tsMs).toISOString()}`);

    result.push({
      id: a.id, name: a.name,
      score: scoreF, max: maxF, weight: weightF, pct,
      ts: tsSource, loggedAt: score_ts || tsSource,
      isTest: type === 'test'
    });
  }

  console.log(`[GH] course ${cid}: ${result.length}/${assigns.length} assignments plotted`);
  return result.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
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
  const assignData = ghBuildAssignData(cid);
  if (assignData.length >= 2) {
    const trend = ghBuildTrend(assignData);
    const te = trend.filter(t => t.avg != null).map(t => ({ grade: t.avg, ts: t.ts, date: t.ts.slice(0, 10) }));
    if (te.length >= 2) {
      const tr = ghTrend(te);
      return ghSparkline(te, 54, 18) + `<span style="font-size:11px;color:${ghColor(tr)};margin-left:3px">${ghArrow(tr)}</span>`;
    }
  }
  return '';
}

// ── Dual-layer chart ──────────────────────────────────────────
function ghChartDual(cid, courseColor) {
  const assignData = ghBuildAssignData(cid);
  const trendData = ghBuildTrend(assignData);
  const toggle = ghGetToggle(cid);
  console.debug('[GradeHistory] renderChart', cid, { assignData, trendData, toggle });

  if (assignData.length === 0) return `<div style="width:100%;height:100px;display:flex;align-items:center;justify-content:center;color:var(--tx3);font-size:12px;background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);">No scored assignments yet. Scores you log will appear here.</div>`;

  const W = 400, H = 100, pl = 28, pr = 4, pt = 10, pb = 20, iW = W - pl - pr, iH = H - pt - pb;
  const times = assignData.map(a => new Date(a.ts).getTime());
  const tMin = Math.min(...times), tMax = Math.max(...times);
  const tRange = Math.max(1, tMax - tMin);
  const toX = t => pl + ((new Date(t).getTime() - tMin) / tRange) * iW;
  const toY = v => pt + (1 - Math.max(0, Math.min(v, 100)) / 100) * iH;

  const yAxis = [0, 50, 100].map(v => {
    const y = toY(v);
    return `<line x1="${pl}" y1="${y.toFixed(1)}" x2="${pl + iW}" y2="${y.toFixed(1)}" stroke="var(--bd)" stroke-width="0.5"/>` +
      `<text x="${pl - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="var(--tx3)">${v}</text>`;
  }).join('');

  let trendSvg = '';
  const trendPts = trendData.filter(t => t.avg != null);
  if (toggle.showAvg && trendPts.length >= 2) {
    const pts = trendPts.map(t => `${toX(t.ts).toFixed(1)},${toY(t.avg).toFixed(1)}`).join(' ');
    trendSvg = `<polyline points="${pts}" fill="none" stroke="${TREND_COL}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

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

// ── History HTML ──────────────────────────────────────────────
function ghHistoryHtml(c) {
  const cid = c.id;
  const courseColor = getCourseColor(cid);
  const assignData = ghBuildAssignData(cid);
  const toggle = ghGetToggle(cid);
  const isOpen = ghOpen.has(cid);

  const toggle$header = `<div style="display:flex;align-items:center;gap:6px;margin-top:10px;cursor:pointer;user-select:none" onclick="ghToggle(${cid})">
    <span style="font-size:10px;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Grade History</span>
    <span id="gh-sp-${cid}" style="display:inline-flex;align-items:center">${ghInlineSpark(cid)}</span>
    <span style="font-size:11px;color:var(--tx3);margin-left:auto">${assignData.length} scored ${isOpen ? '▲' : '▼'}</span>
  </div>`;

  if (!isOpen) return toggle$header;

  const scBtn = `<button onclick="ghToggleLayer(${cid},'showScores')" style="font-size:11px;padding:3px 10px;border-radius:100px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;border:1px solid ${toggle.showScores ? courseColor : 'var(--bd)'};background:${toggle.showScores ? courseColor : 'transparent'};color:${toggle.showScores ? '#fff' : 'var(--tx2)'}"><svg width="9" height="9" style="flex-shrink:0"><circle cx="4.5" cy="4.5" r="4.5" fill="${toggle.showScores ? '#fff' : courseColor}"/></svg>Scores</button>`;
  const avBtn = `<button onclick="ghToggleLayer(${cid},'showAvg')" style="font-size:11px;padding:3px 10px;border-radius:100px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;border:1px solid ${toggle.showAvg ? TREND_COL : 'var(--bd)'};background:${toggle.showAvg ? TREND_COL : 'transparent'};color:${toggle.showAvg ? '#fff' : 'var(--tx2)'}"><svg width="14" height="3" style="flex-shrink:0"><line x1="0" y1="1.5" x2="14" y2="1.5" stroke="${toggle.showAvg ? '#fff' : TREND_COL}" stroke-width="2.5" stroke-linecap="round"/></svg>Average</button>`;
  const toggleBtns = `<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">${scBtn}${avBtn}</div>`;

  return `${toggle$header}<div style="margin-top:8px">${toggleBtns}${ghChartDual(cid, courseColor)}</div>`;
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
  return '';
}

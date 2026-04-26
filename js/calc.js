// ── Grade calculation (weighted % and total points) ───────────
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

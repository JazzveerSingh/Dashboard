// ── Custom Categories ──────────────────────────────────────────
const CAT_DEFAULTS = [
  {id:'food',          label:'Food',          color:'#e05c5c', is_income:false},
  {id:'transport',     label:'Transport',     color:'#4a90d9', is_income:false},
  {id:'gear & tech',   label:'Gear & Tech',   color:'#9b59b6', is_income:false},
  {id:'subscriptions', label:'Subscriptions', color:'#e8a838', is_income:false},
  {id:'other',         label:'Other',         color:'#888888', is_income:false},
  {id:'income',        label:'Income',        color:'#4caf7d', is_income:true},
];

function loadCats() {
  try { const d = JSON.parse(localStorage.getItem('user_cats')); return Array.isArray(d) && d.length ? d : null; }
  catch { return null; }
}
function getCats()      { return loadCats() || CAT_DEFAULTS; }
function saveCats(cats) { try { localStorage.setItem('user_cats', JSON.stringify(cats)); } catch {} }
function getCat(id)     { return getCats().find(c => c.id === id) || {id, label:id, color:'#888', is_income:false}; }
function initCats()     { if (!loadCats()) saveCats(CAT_DEFAULTS); }
function spendingCats() { return getCats().filter(c => !c.is_income); }

// ── Budget Limits ──────────────────────────────────────────────
function loadBudgets() {
  try { return JSON.parse(localStorage.getItem('cat_budgets')) || {}; }
  catch { return {}; }
}
function saveBudgets(b) { try { localStorage.setItem('cat_budgets', JSON.stringify(b)); } catch {} }
function getCatBudget(id) { const b = loadBudgets(); return b[id] || {monthly_limit:null, warning_threshold:80}; }
function setCatBudget(id, limit, threshold) {
  const b = loadBudgets(); b[id] = {monthly_limit:limit, warning_threshold:threshold}; saveBudgets(b);
}

// ── Budget Archive & Month Reset ───────────────────────────────
function loadBudgetArchive() {
  try { return JSON.parse(localStorage.getItem('budget_archive')) || {}; }
  catch { return {}; }
}
function saveBudgetArchive(a) { try { localStorage.setItem('budget_archive', JSON.stringify(a)); } catch {} }
function getLastResetMonth()  { return localStorage.getItem('budget_last_reset'); }
function setLastResetMonth(m) { localStorage.setItem('budget_last_reset', m); }

function addMonths(ym, n) {
  const d = new Date(ym + '-02');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 7);
}

function checkMonthReset() {
  const current = thisMonth();
  const last = getLastResetMonth();
  if (!last) { setLastResetMonth(current); return; }
  if (last >= current) return;

  const archive = loadBudgetArchive();
  let m = last;
  while (m < current) {
    if (!archive[m]) {
      const cats = {};
      S.transactions.forEach(t => {
        if (t.created_at?.slice(0, 7) === m && t.amount < 0)
          cats[t.category] = (cats[t.category] || 0) + Math.abs(t.amount);
      });
      archive[m] = cats;
    }
    m = addMonths(m, 1);
  }
  saveBudgetArchive(archive);
  setLastResetMonth(current);
  setTimeout(() => openM('m-month-reset'), 900);
}

// ── Savings Contributions ──────────────────────────────────────
function svLoadContribs(goalId) {
  try { return JSON.parse(localStorage.getItem('sv_contribs_' + goalId)) || []; }
  catch { return []; }
}
function svSaveContribs(goalId, contribs) {
  try { localStorage.setItem('sv_contribs_' + goalId, JSON.stringify(contribs)); } catch {}
}
function svCalcBalance(goalId) {
  return svLoadContribs(goalId).reduce((s, c) => s + c.amount, 0);
}

// ── Contribution Modal ─────────────────────────────────────────
let contribGoalId = null;

function openContrib(goalId) {
  contribGoalId = goalId;
  $('contrib-amt').value = '';
  $('contrib-note').value = '';
  $('contrib-type').value = 'deposit';
  openM('m-contrib');
}

function addContrib() {
  const rawAmt = parseFloat($('contrib-amt').value);
  if (isNaN(rawAmt) || rawAmt <= 0) return;
  const note = $('contrib-note').value.trim();
  const type = $('contrib-type').value;
  const amount = type === 'deposit' ? rawAmt : -rawAmt;
  const contribs = svLoadContribs(contribGoalId);
  contribs.push({id: Date.now().toString(), amount, date: today(), note});
  svSaveContribs(contribGoalId, contribs);
  const bal = svCalcBalance(contribGoalId);
  const sv = S.savings.find(s => s.id === contribGoalId);
  if (sv) { sv.current_amount = bal; dbUpdate('savings', contribGoalId, {current_amount: bal}); }
  closeM('m-contrib');
  renderMoney();
}

function delContrib(goalId, contribId) {
  const contribs = svLoadContribs(goalId).filter(c => c.id !== contribId);
  svSaveContribs(goalId, contribs);
  const bal = svCalcBalance(goalId);
  const sv = S.savings.find(s => s.id === goalId);
  if (sv) { sv.current_amount = bal; dbUpdate('savings', goalId, {current_amount: bal}); }
  renderMoney();
}

// ── Savings Goal Functions ─────────────────────────────────────
const expandedGoals = new Set();

function openSavingAdd() {
  $('saving-modal-title').textContent = 'Add savings goal';
  $('s-save-btn').textContent = 'Add goal';
  $('s-id').value = ''; $('s-name').value = ''; $('s-tgt').value = '';
  openM('m-saving');
}

function openSavingEdit(id) {
  const sv = S.savings.find(s => s.id === id); if (!sv) return;
  $('saving-modal-title').textContent = 'Edit savings goal';
  $('s-save-btn').textContent = 'Update';
  $('s-id').value = id; $('s-name').value = sv.name; $('s-tgt').value = sv.target_amount;
  openM('m-saving');
}

async function saveSaving() {
  const name = $('s-name').value.trim(), tgt = parseFloat($('s-tgt').value);
  if (!name || isNaN(tgt) || tgt <= 0) return;
  const eid = parseInt($('s-id').value);
  if (eid) {
    const sv = S.savings.find(s => s.id === eid);
    if (sv) { sv.name = name; sv.target_amount = tgt; await dbUpdate('savings', eid, {name, target_amount: tgt}); }
  } else {
    const row = await dbInsert('savings', {name, current_amount: 0, target_amount: tgt});
    if (row) { S.savings.push(row); svSaveContribs(row.id, []); }
  }
  closeM('m-saving'); renderMoney();
}

async function delSaving(id) {
  if (!confirm('Delete this savings goal and all contribution history?')) return;
  await dbDelete('savings', id);
  S.savings = S.savings.filter(s => s.id !== id);
  localStorage.removeItem('sv_contribs_' + id);
  expandedGoals.delete(id);
  renderMoney();
}

function toggleGoalDetail(id) {
  if (expandedGoals.has(id)) expandedGoals.delete(id); else expandedGoals.add(id);
  renderMoney();
}

// ── Category Manager ───────────────────────────────────────────
function openCatMgr() { renderCatMgr(); openM('m-catmgr'); }

function renderCatMgr() {
  const el = $('catmgr-list'); if (!el) return;
  el.innerHTML = getCats().map(c => `
    <div style="border-bottom:0.5px solid var(--bd);padding:10px 0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:${!c.is_income ? '7px' : '0'}">
        <div style="width:10px;height:10px;border-radius:50%;background:${c.color || '#888'};flex-shrink:0"></div>
        <input type="text" value="${esc(c.label)}" style="flex:1;font-size:13px;padding:4px 8px"
          onblur="renameCat('${c.id}',this.value)"/>
        ${c.id !== 'other' ? `<button class="xb" onclick="deleteCat('${c.id}')">✕</button>` : '<span style="width:22px;flex-shrink:0"></span>'}
      </div>
      ${!c.is_income ? `<div style="display:flex;align-items:center;gap:6px;padding-left:18px;flex-wrap:wrap">
        <span style="font-size:11px;color:var(--tx3)">Limit/mo $</span>
        <input type="number" min="0" placeholder="none" value="${getCatBudget(c.id).monthly_limit || ''}"
          style="width:68px;font-size:12px;padding:3px 6px" onblur="saveCatLimit('${c.id}',this.value)"/>
        <span style="font-size:11px;color:var(--tx3)">Warn at</span>
        <input type="number" min="1" max="100" value="${getCatBudget(c.id).warning_threshold}"
          style="width:44px;font-size:12px;padding:3px 6px" onblur="saveCatThreshold('${c.id}',this.value)"/>
        <span style="font-size:11px;color:var(--tx3)">%</span>
      </div>` : ''}
    </div>`).join('');
}

function renameCat(id, newLabel) {
  const label = newLabel.trim(); if (!label) return;
  const cats = getCats(), c = cats.find(c => c.id === id);
  if (!c || c.label === label) return;
  c.label = label; saveCats(cats);
  renderCatMgr(); populateTxnCatSel(); renderMoney();
}

async function deleteCat(id) {
  const cats = getCats();
  const c = cats.find(c => c.id === id); if (!c || id === 'other') return;
  const affected = S.transactions.filter(t => t.category === id);
  const msg = affected.length
    ? `Delete "${c.label}"? ${affected.length} transaction(s) will be reassigned to Other.`
    : `Delete "${c.label}"?`;
  if (!confirm(msg)) return;
  for (const t of affected) { t.category = 'other'; await dbUpdate('transactions', t.id, {category: 'other'}); }
  saveCats(cats.filter(c => c.id !== id));
  renderCatMgr(); populateTxnCatSel(); renderMoney();
}

function saveCatLimit(id, val) {
  const limit = val.trim() ? parseFloat(val) : null;
  const existing = getCatBudget(id);
  setCatBudget(id, (limit != null && !isNaN(limit) && limit > 0) ? limit : null, existing.warning_threshold);
  renderCatMgr(); renderMoney();
}

function saveCatThreshold(id, val) {
  const t = parseInt(val);
  const existing = getCatBudget(id);
  setCatBudget(id, existing.monthly_limit, isNaN(t) ? 80 : Math.min(100, Math.max(1, t)));
}

function addNewCat() {
  const inp = $('catmgr-new'); if (!inp) return;
  const label = inp.value.trim(); if (!label) return;
  const cats = getCats();
  if (cats.some(c => c.label.toLowerCase() === label.toLowerCase())) { inp.value = ''; return; }
  const palette = ['#e05c5c','#4a90d9','#9b59b6','#e8a838','#4caf7d','#f39c12','#1abc9c','#e74c3c','#16a085','#8e44ad'];
  const color = palette[cats.filter(c => !c.is_income).length % palette.length];
  const id = label.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'') + '-' + Date.now().toString().slice(-5);
  cats.push({id, label, color, is_income:false});
  saveCats(cats);
  inp.value = '';
  renderCatMgr(); populateTxnCatSel(); renderMoney();
}

// ── Transaction Category Select ────────────────────────────────
function populateTxnCatSel() {
  const sel = $('txn-cat'); if (!sel) return;
  sel.innerHTML = getCats().map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('');
}

// ── Transaction Functions ──────────────────────────────────────
async function addTxn() {
  const name = $('txn-nm').value.trim(), cat = $('txn-cat').value, amt = parseFloat($('txn-amt').value);
  if (!name || isNaN(amt)) return;
  const catObj = getCat(cat);
  const amount = catObj.is_income ? Math.abs(amt) : -Math.abs(amt);
  const row = await dbInsert('transactions', {name, category: cat, amount});
  if (row) { S.transactions.unshift(row); $('txn-nm').value = ''; $('txn-amt').value = ''; renderMoney(); renderHome(); }
}

async function delTxn(id) {
  await dbDelete('transactions', id);
  S.transactions = S.transactions.filter(t => t.id !== id);
  renderMoney(); renderHome();
}

// ── Money Sub-tabs ─────────────────────────────────────────────
let moneyTabActive = 'overview';
let trendsRange = 6;
let trendsCatFilter = '';

function moneyTab(tab) {
  moneyTabActive = tab;
  ['overview','trends'].forEach(t => {
    const el = $('mt-' + t); if (el) el.style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('.mtab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'trends') { populateTrendsCatSel(); renderTrends(); }
}

function setTrendsRange(n) {
  trendsRange = n;
  document.querySelectorAll('.mtab[data-range]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.range) === n));
  renderTrends();
}

// ── Spending Trends ────────────────────────────────────────────
function populateTrendsCatSel() {
  const sel = $('trends-cat'); if (!sel) return;
  sel.innerHTML = '<option value="">All categories</option>' +
    spendingCats().map(c => `<option value="${esc(c.id)}"${c.id === trendsCatFilter ? ' selected' : ''}>${esc(c.label)}</option>`).join('');
}

function buildTrendsData() {
  const archive = loadBudgetArchive();
  const current = thisMonth();
  const months = [];
  for (let i = trendsRange - 1; i >= 0; i--) months.push(addMonths(current, -i));

  const data = {};
  months.forEach(m => {
    if (m === current) {
      const cats = {};
      S.transactions.forEach(t => {
        if (t.created_at?.slice(0,7) === m && t.amount < 0)
          cats[t.category] = (cats[t.category] || 0) + Math.abs(t.amount);
      });
      data[m] = cats;
    } else {
      data[m] = archive[m] || {};
    }
  });
  return {months, data, current};
}

function renderTrends() {
  const {months, data, current} = buildTrendsData();
  const cats = trendsCatFilter
    ? getCats().filter(c => c.id === trendsCatFilter && !c.is_income)
    : spendingCats();

  // Summary: compare last 2 complete months
  const past = months.filter(m => m < current);
  let summary = '';
  if (past.length >= 2) {
    const prev = past[past.length - 2], last = past[past.length - 1];
    let bigDelta = 0, bigCat = null;
    spendingCats().forEach(c => {
      const delta = (data[last][c.id] || 0) - (data[prev][c.id] || 0);
      if (Math.abs(delta) > Math.abs(bigDelta)) { bigDelta = delta; bigCat = c; }
    });
    if (bigCat && Math.abs(bigDelta) > 0.5) {
      const mo = m => new Date(m + '-02').toLocaleDateString('en-CA', {month:'long'});
      summary = bigDelta > 0
        ? `${bigCat.label} is up $${bigDelta.toFixed(0)} from ${mo(prev)}`
        : `${bigCat.label} is down $${Math.abs(bigDelta).toFixed(0)} from ${mo(prev)}`;
    }
  }
  const sumEl = $('trends-summary');
  if (sumEl) sumEl.textContent = summary;

  const chartEl = $('trends-chart');
  if (chartEl) renderTrendsChart(chartEl, months, data, cats, current);
  renderMoMTable(months, data, current, cats);
}

function renderTrendsChart(container, months, data, cats, current) {
  const nM = months.length;
  const W = Math.max((container.offsetWidth || 520), nM * 60);
  const H = 180, pad = {l:38, r:8, t:10, b:28};
  const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;

  let maxVal = 10;
  months.forEach(m => cats.forEach(c => { maxVal = Math.max(maxVal, data[m][c.id] || 0); }));
  maxVal = Math.ceil(maxVal / 25) * 25;

  const groupW = plotW / nM;
  const barW = cats.length ? Math.min(16, Math.max(4, (groupW - 8) / cats.length)) : groupW - 8;
  const mo = m => new Date(m + '-02').toLocaleDateString('en-CA', {month:'short'});

  let bars = '', yAxis = '';
  months.forEach((m, mi) => {
    const gx = pad.l + mi * groupW;
    cats.forEach((c, ci) => {
      const val = data[m][c.id] || 0; if (!val) return;
      const bh = val / maxVal * plotH;
      const bx = gx + (groupW - cats.length * (barW + 1.5)) / 2 + ci * (barW + 1.5);
      const by = pad.t + plotH - bh;
      bars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${c.color}" opacity="${m === current ? 0.5 : 1}" rx="2"><title>${c.label}: $${val.toFixed(0)}</title></rect>`;
    });
    bars += `<text x="${(gx + groupW/2).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="10" fill="var(--tx3)">${mo(m)}${m === current ? '*' : ''}</text>`;
  });

  [0, 0.5, 1].forEach(p => {
    const y = (pad.t + plotH * (1 - p)).toFixed(1);
    yAxis += `<text x="${pad.l - 4}" y="${(parseFloat(y) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--tx3)">$${Math.round(maxVal * p)}</text>`;
    yAxis += `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="var(--bd)" stroke-width="0.5"${p > 0 ? ' stroke-dasharray="3,3"' : ''}/>`;
  });

  container.innerHTML = `<div style="overflow-x:auto"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">${yAxis}${bars}</svg></div>`;
}

function renderMoMTable(months, data, current, cats) {
  const el = $('mom-table'); if (!el) return;
  const past = months.filter(m => m < current);
  if (!past.length) { el.innerHTML = '<div class="empty-state" style="padding:12px 0"><div class="es">No history yet — check back next month.</div></div>'; return; }

  const last = past[past.length - 1];
  const prev = past.length >= 2 ? past[past.length - 2] : null;
  const mo = m => new Date(m + '-02').toLocaleDateString('en-CA', {month:'short', year:'2-digit'});
  const showEmpty = $('mom-show-empty')?.checked;

  const rows = cats.filter(c => showEmpty || (data[last][c.id] || 0) > 0 || (prev && (data[prev]?.[c.id] || 0) > 0));
  if (!rows.length) { el.innerHTML = '<div class="empty-state" style="padding:12px 0"><div class="es">No spending data. Toggle "Show empty" to see all.</div></div>'; return; }

  const prevTh = prev ? `<th style="text-align:right;padding:4px 8px;font-weight:500">${mo(prev)}</th>` : '';
  const changeTh = prev ? `<th style="text-align:right;padding:4px 8px;font-weight:500">Change</th>` : '';

  el.innerHTML = `<table style="width:100%;font-size:13px;border-collapse:collapse">
    <thead><tr style="color:var(--tx3);font-size:11px;text-transform:uppercase;letter-spacing:.3px;border-bottom:0.5px solid var(--bd)">
      <th style="text-align:left;padding:4px 0;font-weight:500">Category</th>
      ${prevTh}<th style="text-align:right;padding:4px 8px;font-weight:500">${mo(last)}</th>${changeTh}
    </tr></thead>
    <tbody>${rows.map(c => {
      const thisAmt = data[last][c.id] || 0;
      const prevAmt = prev ? (data[prev][c.id] || 0) : null;
      const delta = prevAmt != null ? thisAmt - prevAmt : null;
      const prevCell = prev ? `<td style="text-align:right;padding:5px 8px;color:var(--tx2)">${prevAmt != null ? '$' + prevAmt.toFixed(0) : '—'}</td>` : '';
      const deltaCell = prev ? `<td style="text-align:right;padding:5px 8px">${delta == null ? '' : `<span class="${delta > 0 ? 'exp' : delta < 0 ? 'inc' : ''}">${delta > 0 ? '↑' : delta < 0 ? '↓' : '—'} $${Math.abs(delta ?? 0).toFixed(0)}</span>`}</td>` : '';
      return `<tr style="border-top:0.5px solid var(--bd)">
        <td style="padding:6px 0"><div style="display:flex;align-items:center;gap:6px"><div style="width:7px;height:7px;border-radius:50%;background:${c.color};flex-shrink:0"></div>${esc(c.label)}</div></td>
        ${prevCell}<td style="text-align:right;padding:5px 8px">$${thisAmt.toFixed(0)}</td>${deltaCell}
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ── renderMoney ────────────────────────────────────────────────
function renderMoney() {
  populateTxnCatSel();

  const current = thisMonth();
  const txns = S.transactions.filter(t => t.created_at?.slice(0,7) === current);

  const inc = txns.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const sp  = Math.abs(txns.filter(x => x.amount < 0).reduce((a, x) => a + x.amount, 0));
  const net = inc - sp;

  $('mn-inc').textContent = '$' + inc.toFixed(0);
  $('mn-sp').textContent  = '$' + sp.toFixed(0);
  $('mn-rem').textContent = '$' + net.toFixed(0);
  const ne = $('mn-net');
  if (ne) { ne.textContent = (net >= 0 ? '+' : '') + '$' + Math.abs(net).toFixed(0); ne.className = net >= 0 ? 'inc' : 'exp'; }

  renderBudgetSummary(txns);
  renderCatRows(txns);
  renderSavings();
  renderTxnList(txns);

  if (moneyTabActive === 'trends') renderTrends();
}

function renderBudgetSummary(txns) {
  const el = $('budget-summary-card'); if (!el) return;
  const budgets = loadBudgets();
  const capped = getCats().filter(c => !c.is_income && budgets[c.id]?.monthly_limit);
  if (!capped.length) { el.style.display = 'none'; return; }
  el.style.display = '';

  let totalBudget = 0, totalSpent = 0;
  capped.forEach(c => {
    totalBudget += budgets[c.id].monthly_limit;
    totalSpent += Math.abs(txns.filter(t => t.category === c.id && t.amount < 0).reduce((a, t) => a + t.amount, 0));
  });
  const rem = totalBudget - totalSpent;
  const pct = totalBudget > 0 ? Math.min(100, totalSpent / totalBudget * 100) : 0;
  const barColor = pct >= 100 ? 'var(--red)' : pct >= 80 ? '#e8a838' : 'var(--green)';

  el.innerHTML = `<div class="st" style="margin-bottom:10px">Monthly budget summary</div>
    <div class="g3" style="margin-bottom:10px">
      <div class="mc" style="padding:10px"><div class="ml">Budgeted</div><div class="mv" style="font-size:20px">$${totalBudget.toFixed(0)}</div></div>
      <div class="mc" style="padding:10px"><div class="ml">Spent</div><div class="mv exp" style="font-size:20px">$${totalSpent.toFixed(0)}</div></div>
      <div class="mc" style="padding:10px"><div class="ml">Remaining</div><div class="mv ${rem < 0 ? 'exp' : ''}" style="font-size:20px">$${Math.abs(rem).toFixed(0)}${rem < 0 ? ' over' : ''}</div></div>
    </div>
    <div class="pbg"><div style="width:${pct.toFixed(1)}%;background:${barColor};height:100%;border-radius:inherit;transition:width .4s"></div></div>`;
}

function renderCatRows(txns) {
  const el = $('budget-rows'); if (!el) return;
  const catSpend = {};
  txns.forEach(t => { catSpend[t.category] = (catSpend[t.category] || 0) + t.amount; });

  const visible = getCats().filter(c => catSpend[c.id] !== undefined || (!c.is_income && getCatBudget(c.id).monthly_limit));
  if (!visible.length) { el.innerHTML = '<span style="font-size:12px;color:var(--tx2)">No transactions this month.</span>'; return; }

  el.innerHTML = visible.map(c => {
    const amt = catSpend[c.id] || 0;
    const budget = getCatBudget(c.id);
    const limit = c.is_income ? null : budget.monthly_limit;
    const spent = c.is_income ? 0 : Math.abs(Math.min(0, amt));
    let progressHtml = '', warningHtml = '';

    if (limit) {
      const pct = spent / limit * 100, wt = budget.warning_threshold;
      const barColor = pct >= 100 ? 'var(--red)' : pct >= wt ? '#e8a838' : 'var(--green)';
      progressHtml = `<div class="pbg" style="margin-top:5px"><div style="width:${Math.min(100,pct).toFixed(1)}%;background:${barColor};height:100%;border-radius:inherit;transition:width .4s"></div></div>`;
      if (pct >= 100) warningHtml = `<div style="font-size:11px;color:var(--red);margin-top:3px">⚠ Budget exceeded by $${(spent-limit).toFixed(0)}</div>`;
      else if (pct >= wt) warningHtml = `<div style="font-size:11px;color:#c87800;margin-top:3px">⚠ $${spent.toFixed(0)} of $${limit} budget used (${pct.toFixed(0)}%)</div>`;
    }

    return `<div class="brow" style="flex-direction:column;align-items:stretch">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:7px;height:7px;border-radius:50%;background:${c.color || '#888'};flex-shrink:0"></div>
        <span style="flex:1;color:var(--tx2)">${esc(c.label)}</span>
        ${limit ? `<span style="font-size:11px;color:var(--tx3)">$${spent.toFixed(0)}/$${limit}</span>` : ''}
        <span class="${amt >= 0 ? 'inc' : 'exp'}">${amt >= 0 ? '+' : ''}$${Math.abs(amt).toFixed(0)}</span>
      </div>
      ${progressHtml}${warningHtml}
    </div>`;
  }).join('');
}

function svSparkline(contribs) {
  if (contribs.length < 2) return '';
  let run = 0;
  const vals = contribs.map(c => { run += c.amount; return run; });
  const minV = Math.min(0, ...vals), maxV = Math.max(...vals, 0.01);
  const W = 200, H = 30;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * W).toFixed(1)},${((maxV - v) / (maxV - minV) * H).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:30px;margin-bottom:8px;display:block" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function renderSavings() {
  const el = $('savings-list'); if (!el) return;
  el.innerHTML = S.savings.length ? S.savings.map(sv => {
    const contribs = svLoadContribs(sv.id);
    const bal = contribs.length ? contribs.reduce((s, c) => s + c.amount, 0) : (sv.current_amount || 0);
    const pct = sv.target_amount > 0 ? Math.min(100, Math.round(bal / sv.target_amount * 100)) : 0;
    const bc = pct >= 80 ? 'fg' : pct >= 50 ? 'fb' : 'fa';
    const expanded = expandedGoals.has(sv.id);

    let fwd = 0;
    const fwdMap = {};
    contribs.forEach(c => { fwd += c.amount; fwdMap[c.id] = fwd; });

    const detailHtml = expanded ? `
      <div style="margin-top:10px;padding-top:10px;border-top:0.5px solid var(--bd)">
        ${contribs.length >= 2 ? svSparkline(contribs) : ''}
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin-bottom:6px">History</div>
        <div style="max-height:200px;overflow-y:auto">
          ${contribs.length ? [...contribs].reverse().map(c => `
            <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:0.5px solid var(--bd);font-size:12px">
              <span style="color:var(--tx3);flex-shrink:0;width:56px">${fmt(c.date)}</span>
              <span style="flex:1;color:var(--tx2)">${esc(c.note || '—')}</span>
              <span class="${c.amount >= 0 ? 'inc' : 'exp'}">${c.amount >= 0 ? '+' : ''}$${Math.abs(c.amount).toFixed(0)}</span>
              <span style="color:var(--tx3);text-align:right;width:52px">→ $${fwdMap[c.id].toFixed(0)}</span>
              <button class="xb" onclick="delContrib(${sv.id},'${c.id}')">✕</button>
            </div>`).join('')
          : '<div style="font-size:12px;color:var(--tx3);padding:8px 0">No contributions yet.</div>'}
        </div>
        <button class="bp" onclick="openContrib(${sv.id})" style="margin-top:10px;font-size:12px;padding:5px 14px">+ Add contribution</button>
      </div>` : '';

    return `<div class="sg">
      <div class="sg-h">
        <span style="font-weight:500;cursor:pointer" onclick="toggleGoalDetail(${sv.id})">${esc(sv.name)} <span style="font-size:10px;color:var(--tx3)">${expanded ? '▲' : '▼'}</span></span>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--tx2)">$${bal.toLocaleString(undefined,{maximumFractionDigits:0})} / $${sv.target_amount.toLocaleString()} — ${pct}%</span>
          ${!expanded ? `<button class="bp" onclick="openContrib(${sv.id})" style="font-size:11px;padding:2px 8px">+ Add</button>` : ''}
          <button class="xb" onclick="openSavingEdit(${sv.id})" title="Edit">✎</button>
          <button class="xb" onclick="delSaving(${sv.id})">✕</button>
        </div>
      </div>
      <div class="pbg"><div class="pf ${bc}" style="width:${pct}%"></div></div>
      ${detailHtml}
    </div>`;
  }).join('') : '<div class="empty-state" style="padding:12px 0"><div class="es">No savings goals yet.</div></div>';
}

function renderTxnList(txns) {
  const el = $('txn-list'); if (!el) return;
  el.innerHTML = txns.length
    ? txns.map(t => {
        const c = getCat(t.category);
        return `<div class="trow">
          <div style="width:7px;height:7px;border-radius:50%;background:${c.color || '#888'};flex-shrink:0"></div>
          <span style="flex:1">${esc(t.name)}</span>
          <span class="chip">${esc(c.label)}</span>
          <span class="${t.amount >= 0 ? 'inc' : 'exp'}">${t.amount >= 0 ? '+' : ''}$${Math.abs(t.amount).toFixed(0)}</span>
          <button class="xb" onclick="delTxn(${t.id})">✕</button>
        </div>`;
      }).join('')
    : '<div class="empty-state" style="padding:12px 0"><div class="es">No transactions this month.</div></div>';
}

// ── Legacy stubs (replaced by new flow) ───────────────────────
function checkBudgetReset() {}
function resetBudget() {}

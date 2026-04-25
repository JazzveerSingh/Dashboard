function checkBudgetReset() {
  const m = thisMonth();
  const bar = $('budget-reset-bar'); if (!bar) return;
  const txnMonths = S.transactions.map(t => t.created_at?.slice(0, 7));
  const hasOldTxns = txnMonths.some(tm => tm && tm < m);
  if (hasOldTxns) {
    bar.innerHTML = `<span>🔄 New month! Reset transactions?</span><button onclick="resetBudget()" style="font-size:12px;padding:4px 10px">Reset now</button>`;
    bar.className = 'budget-reset-bar';
  } else {
    bar.innerHTML = '';
  }
}

async function resetBudget() {
  for (const t of S.transactions) await dbDelete('transactions', t.id);
  S.transactions = [];
  renderMoney();
}

async function addTxn() {
  const name = $('txn-nm').value.trim(), cat = $('txn-cat').value, amt = parseFloat($('txn-amt').value);
  if (!name || isNaN(amt)) return;
  const amount = cat === 'income' ? Math.abs(amt) : -Math.abs(amt);
  const row = await dbInsert('transactions', { name, category: cat, amount });
  if (row) { S.transactions.unshift(row); $('txn-nm').value = ''; $('txn-amt').value = ''; renderMoney(); renderHome(); }
}

async function delTxn(id) {
  await dbDelete('transactions', id);
  S.transactions = S.transactions.filter(t => t.id !== id);
  renderMoney(); renderHome();
}

function openSavingAdd() {
  $('saving-modal-title').textContent = 'Add savings goal';
  $('s-save-btn').textContent = 'Add goal';
  $('s-id').value = ''; $('s-name').value = ''; $('s-cur').value = ''; $('s-tgt').value = '';
  openM('m-saving');
}

function openSavingEdit(id) {
  const sv = S.savings.find(s => s.id === id); if (!sv) return;
  $('saving-modal-title').textContent = 'Edit savings goal';
  $('s-save-btn').textContent = 'Update';
  $('s-id').value = id; $('s-name').value = sv.name; $('s-cur').value = sv.current_amount; $('s-tgt').value = sv.target_amount;
  openM('m-saving');
}

async function saveSaving() {
  const name = $('s-name').value.trim(), cur = parseFloat($('s-cur').value) || 0, tgt = parseFloat($('s-tgt').value);
  if (!name || isNaN(tgt) || tgt <= 0) return;
  const eid = parseInt($('s-id').value);
  if (eid) {
    const sv = S.savings.find(s => s.id === eid);
    if (sv) { sv.name = name; sv.current_amount = cur; sv.target_amount = tgt; await dbUpdate('savings', eid, { name, current_amount: cur, target_amount: tgt }); }
  } else {
    const row = await dbInsert('savings', { name, current_amount: cur, target_amount: tgt });
    if (row) S.savings.push(row);
  }
  closeM('m-saving'); renderMoney();
}

async function delSaving(id) {
  await dbDelete('savings', id);
  S.savings = S.savings.filter(s => s.id !== id);
  renderMoney();
}

const BC = ['fb', 'fp', 'fg', 'fa', 'fr'];

function renderMoney() {
  checkBudgetReset();
  const inc = S.transactions.filter(x => x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const sp = Math.abs(S.transactions.filter(x => x.amount < 0).reduce((a, x) => a + x.amount, 0));
  const net = inc - sp;
  $('mn-inc').textContent = '$' + inc.toFixed(0);
  $('mn-sp').textContent = '$' + sp.toFixed(0);
  $('mn-rem').textContent = '$' + net.toFixed(0);
  const ne = $('mn-net'); ne.textContent = (net >= 0 ? '+' : '') + ' $' + Math.abs(net).toFixed(0); ne.className = net >= 0 ? 'inc' : 'exp';

  const cats = {};
  S.transactions.forEach(t => { cats[t.category] = (cats[t.category] || 0) + t.amount; });
  $('budget-rows').innerHTML = Object.entries(cats).map(([c, a]) => `
    <div class="brow"><span style="color:var(--tx2)">${c[0].toUpperCase() + c.slice(1)}</span><span class="${a >= 0 ? 'inc' : 'exp'}">${a >= 0 ? '+' : ''} $${Math.abs(a).toFixed(0)}</span></div>`
  ).join('') || '<span style="font-size:12px;color:var(--tx2)">No transactions yet.</span>';

  const ec = {};
  S.transactions.filter(t => t.amount < 0).forEach(t => { ec[t.category] = (ec[t.category] || 0) + Math.abs(t.amount); });
  const mx = Math.max(...Object.values(ec), 1);
  $('cat-bars').innerHTML = Object.entries(ec).map(([c, a], i) => `
    <div class="cb2"><span class="cbl">${c[0].toUpperCase() + c.slice(1)}</span><div class="cbt"><div class="cbf ${BC[i % BC.length]}" style="width:${Math.round(a / mx * 100)}%"></div></div><span class="cba">$${a.toFixed(0)}</span></div>`
  ).join('') || '<span style="font-size:12px;color:var(--tx2)">No expenses yet.</span>';

  $('savings-list').innerHTML = S.savings.length ? S.savings.map(sv => {
    const pct = Math.min(100, Math.round(sv.current_amount / sv.target_amount * 100));
    const bc = pct >= 80 ? 'fg' : pct >= 50 ? 'fb' : 'fa';
    return `<div class="sg">
      <div class="sg-h">
        <span style="font-weight:500">${esc(sv.name)}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--tx2)">$${sv.current_amount.toLocaleString()} / $${sv.target_amount.toLocaleString()} — ${pct}%</span>
          <button class="xb" onclick="openSavingEdit(${sv.id})" title="Edit">✎</button>
          <button class="xb" onclick="delSaving(${sv.id})">✕</button>
        </div>
      </div>
      <div class="pbg"><div class="pf ${bc}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('') : '<div class="empty-state" style="padding:12px 0"><div class="es">No savings goals yet.</div></div>';

  $('txn-list').innerHTML = S.transactions.length ? S.transactions.map(t => `
    <div class="trow"><span style="flex:1">${esc(t.name)}</span><span class="chip">${t.category}</span><span class="${t.amount >= 0 ? 'inc' : 'exp'}">${t.amount >= 0 ? '+' : ''} $${Math.abs(t.amount).toFixed(0)}</span><button class="xb" onclick="delTxn(${t.id})">✕</button></div>`
  ).join('') : '<div class="empty-state" style="padding:12px 0"><div class="es">No transactions yet.</div></div>';
}

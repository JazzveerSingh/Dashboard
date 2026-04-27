// ── State ──────────────────────────────────────────────────────
let TF = '';
const expandedTasks = new Set();
let editingTaskId = null;

// ── Custom Tags ────────────────────────────────────────────────
const TAG_DEFAULTS = [
  {id:'personal',  label:'Personal',  color:null},
  {id:'academics', label:'Academics', color:null},
  {id:'errands',   label:'Errands',   color:null},
  {id:'uni prep',  label:'Uni prep',  color:null},
  {id:'music',     label:'Music',     color:null}
];

function loadTags() {
  try { const d = JSON.parse(localStorage.getItem('user_tags')); return Array.isArray(d) && d.length ? d : null; }
  catch { return null; }
}
function getTags()           { return loadTags() || TAG_DEFAULTS; }
function saveTags(tags)      { try { localStorage.setItem('user_tags', JSON.stringify(tags)); } catch {} }
function getTagLabel(id)     { const t = getTags().find(t => t.id === id); return t ? t.label : (id || ''); }
function initTags()          { if (!loadTags()) saveTags(TAG_DEFAULTS); }

function renderTagStrip() {
  const strip = $('tstrip'); if (!strip) return;
  strip.innerHTML =
    `<span class="tpill${!TF ? ' on' : ''}" onclick="setTF('',this)">All</span>` +
    getTags().map(t => `<span class="tpill${TF === t.id ? ' on' : ''}" onclick="setTF(${JSON.stringify(t.id)},this)">${esc(t.label)}</span>`).join('') +
    `<span class="tpill" onclick="openTagMgr()" style="color:var(--tx3)">⚙ Tags</span>`;
}

function populateTagSel(selId, curId) {
  const el = $(selId); if (!el) return;
  el.innerHTML = getTags().map(t => `<option value="${esc(t.id)}"${t.id === curId ? ' selected' : ''}>${esc(t.label)}</option>`).join('');
}

// ── Tag manager ────────────────────────────────────────────────
function openTagMgr() { renderTagMgr(); openM('m-tagmgr'); }

function renderTagMgr() {
  const el = $('tagmgr-list'); if (!el) return;
  el.innerHTML = getTags().map(t => `
    <div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:0.5px solid var(--bd)">
      <input type="text" value="${esc(t.label)}" style="flex:1;font-size:13px;padding:4px 8px"
        onblur="renameTag(${JSON.stringify(t.id)},this.value)"/>
      <button class="xb" onclick="deleteTag(${JSON.stringify(t.id)})">✕</button>
    </div>`).join('');
}

function renameTag(id, newLabel) {
  const label = newLabel.trim(); if (!label) return;
  const tags = getTags(), t = tags.find(t => t.id === id);
  if (!t || t.label === label) return;
  t.label = label; saveTags(tags);
  renderTagStrip(); renderTasks();
}

async function deleteTag(id) {
  const affected = S.tasks.filter(t => t.tag === id);
  const msg = affected.length
    ? `Delete tag? ${affected.length} task${affected.length > 1 ? 's' : ''} will have their tag removed.`
    : 'Delete tag? No tasks use it.';
  if (!confirm(msg)) return;
  saveTags(getTags().filter(t => t.id !== id));
  for (const tk of affected) { tk.tag = null; await dbUpdate('tasks', tk.id, { tag: null }); }
  if (TF === id) TF = '';
  renderTagMgr(); renderTagStrip(); renderTasks();
}

function addNewTag() {
  const inp = $('tagmgr-new'); if (!inp) return;
  const label = inp.value.trim(); if (!label) return;
  const tags = getTags();
  if (tags.some(t => t.label.toLowerCase() === label.toLowerCase())) return;
  const id = label.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'') + '-' + Date.now().toString().slice(-5);
  tags.push({id, label, color:null}); saveTags(tags);
  inp.value = ''; renderTagMgr(); renderTagStrip();
}

// ── Archive ────────────────────────────────────────────────────
function loadArchive() { try { return JSON.parse(localStorage.getItem('ar_tasks')) || []; } catch { return []; } }
function saveArchive(ar) { try { localStorage.setItem('ar_tasks', JSON.stringify(ar)); } catch {} }
function getCA(tid)      { return localStorage.getItem('ca_' + tid); }
function setCA(tid, ts)  { localStorage.setItem('ca_' + tid, ts); }
function clearCA(tid)    { localStorage.removeItem('ca_' + tid); }

function autoArchive() {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 5);
  const toAr = S.tasks.filter(t => {
    if (!t.done) return false;
    const ca = getCA(t.id); return ca && new Date(ca) < cutoff;
  });
  if (!toAr.length) return;
  const ar = loadArchive();
  toAr.forEach(t => {
    ar.unshift({...t, archived_at: new Date().toISOString()});
    clearCA(t.id); localStorage.removeItem('st_' + t.id);
    dbDelete('tasks', t.id);
  });
  S.tasks = S.tasks.filter(t => !toAr.find(a => a.id === t.id));
  saveArchive(ar);
}

function clearCompleted() {
  const done = S.tasks.filter(t => t.done);
  if (!done.length) return;
  if (!confirm(`Archive ${done.length} completed task${done.length > 1 ? 's' : ''}?`)) return;
  const ar = loadArchive();
  done.forEach(t => {
    ar.unshift({...t, archived_at: new Date().toISOString()});
    clearCA(t.id); localStorage.removeItem('st_' + t.id);
    dbDelete('tasks', t.id);
  });
  S.tasks = S.tasks.filter(t => !t.done);
  saveArchive(ar); renderTasks(); renderHome(); renderArchive();
}

async function restoreTask(aid) {
  const ar = loadArchive(), t = ar.find(a => a.id === aid); if (!t) return;
  const { archived_at, ...data } = t;
  const row = await dbInsert('tasks', { name:data.name, priority:data.priority, tag:data.tag, due_date:data.due_date, done:false });
  if (row) {
    S.tasks.unshift(row);
    saveArchive(ar.filter(a => a.id !== aid));
    renderTasks(); renderHome(); renderArchive();
  }
}

async function deleteArchivedTask(aid) {
  if (!confirm('Permanently delete? This cannot be undone.')) return;
  saveArchive(loadArchive().filter(a => a.id !== aid)); renderArchive();
}

let archiveOpen = false;

function toggleArchive() {
  archiveOpen = !archiveOpen;
  const list = $('archive-list'), chev = $('archive-chev');
  if (list) list.style.display = archiveOpen ? 'block' : 'none';
  if (chev) chev.textContent = archiveOpen ? '▲' : '▼';
  if (archiveOpen) renderArchive();
}

function renderArchive() {
  const ar = loadArchive();
  const sec = $('archive-sec'); if (sec) sec.style.display = ar.length ? '' : 'none';
  const cnt = $('archive-count'); if (cnt) cnt.textContent = ar.length ? ` (${ar.length})` : '';
  const list = $('archive-list'); if (!list || !archiveOpen) return;
  list.innerHTML = ar.length ? ar.map(t => `
    <div class="row">
      <span style="flex:1;color:var(--tx2);text-decoration:line-through;font-size:13px">${esc(t.name)}</span>
      ${t.tag ? `<span class="chip">${esc(getTagLabel(t.tag))}</span>` : ''}
      <span style="font-size:11px;color:var(--tx3)">${fmt(t.archived_at?.slice(0,10))}</span>
      <button style="font-size:11px;padding:2px 8px;border-radius:5px;color:var(--acc);border-color:var(--acc3);background:var(--acc3)" onclick="restoreTask(${t.id})">↩ Restore</button>
      <button class="xb" onclick="deleteArchivedTask(${t.id})" title="Delete forever">✕</button>
    </div>`).join('')
    : '<div style="font-size:12px;color:var(--tx3);padding:4px 0">No archived tasks.</div>';
}

// ── Subtasks ───────────────────────────────────────────────────
function stLoad(tid) { try { return JSON.parse(localStorage.getItem('st_' + tid)) || []; } catch { return []; } }
function stSave(tid, items) { try { localStorage.setItem('st_' + tid, JSON.stringify(items)); } catch {} }

function stToggle(tid, sid) {
  const items = stLoad(tid), item = items.find(i => i.id === sid); if (!item) return;
  item.done = !item.done; stSave(tid, items); renderTasks(); renderHome();
}
function stDelete(tid, sid) { stSave(tid, stLoad(tid).filter(i => i.id !== sid)); renderTasks(); }
function stAdd(tid, text) {
  const t = (text || '').trim(); if (!t) return;
  const items = stLoad(tid);
  items.push({id: Date.now(), text: t, done: false}); stSave(tid, items);
  const inp = $('st-inp-' + tid); if (inp) inp.value = '';
  renderTasks();
}
function toggleSubtasks(tid) {
  if (expandedTasks.has(tid)) expandedTasks.delete(tid); else expandedTasks.add(tid);
  renderTasks();
}

// ── Task modal ─────────────────────────────────────────────────
function openAddTask() {
  editingTaskId = null;
  $('m-task-h').textContent = 'Add task';
  $('t-name').value = ''; $('t-date').value = ''; $('t-pri').value = 'Med';
  populateTagSel('t-tag', null);
  $('t-save').textContent = 'Add task';
  $('t-save').onclick = saveTask;
  openM('m-task'); setTimeout(() => $('t-name').focus(), 50);
}

function openEditTask(id) {
  const tk = S.tasks.find(t => t.id === id); if (!tk) return;
  editingTaskId = id;
  $('m-task-h').textContent = 'Edit task';
  $('t-name').value = tk.name; $('t-date').value = tk.due_date || ''; $('t-pri').value = tk.priority;
  populateTagSel('t-tag', tk.tag);
  $('t-save').textContent = 'Save changes';
  $('t-save').onclick = () => updateTask(id);
  openM('m-task'); setTimeout(() => $('t-name').focus(), 50);
}

async function updateTask(id) {
  const name = $('t-name').value.trim(); if (!name) return;
  const tk = S.tasks.find(t => t.id === id); if (!tk) return;
  tk.name = name; tk.priority = $('t-pri').value;
  tk.tag = $('t-tag').value || null; tk.due_date = $('t-date').value || null;
  await dbUpdate('tasks', id, { name:tk.name, priority:tk.priority, tag:tk.tag, due_date:tk.due_date });
  closeM('m-task'); renderTasks(); renderHome();
}

// ── Core CRUD ──────────────────────────────────────────────────
function setTF(f, el) {
  TF = f;
  document.querySelectorAll('.tpill').forEach(p => p.classList.remove('on'));
  el.classList.add('on'); renderTasks();
}

async function saveTask() {
  const name = $('t-name').value.trim(); if (!name) return;
  const row = await dbInsert('tasks', {
    name, priority: $('t-pri').value, tag: $('t-tag').value || null,
    due_date: $('t-date').value || null, done: false
  });
  if (row) { S.tasks.unshift(row); closeM('m-task'); renderTasks(); renderHome(); }
}

async function toggleTask(id) {
  const tk = S.tasks.find(t => t.id === id); if (!tk) return;
  tk.done = !tk.done;
  if (tk.done) setCA(id, new Date().toISOString()); else clearCA(id);
  await dbUpdate('tasks', id, { done: tk.done });
  renderTasks(); renderHome();
}

async function deleteTask(id) {
  await dbDelete('tasks', id);
  S.tasks = S.tasks.filter(t => t.id !== id);
  clearCA(id); localStorage.removeItem('st_' + id);
  renderTasks(); renderHome();
}

// ── Main render ────────────────────────────────────────────────
function renderTasks() {
  autoArchive(); initTags(); renderTagStrip(); renderArchive();

  let tasks = [...S.tasks];
  const q = ($('task-search') || {value:''}).value.toLowerCase();
  if (TF) tasks = tasks.filter(t => t.tag === TF);
  if (q)  tasks = tasks.filter(t => t.name.toLowerCase().includes(q));
  tasks.sort((a, b) => {
    const p = {High:0, Med:1, Low:2};
    if (a.done !== b.done) return a.done ? 1 : -1;
    return p[a.priority] - p[b.priority];
  });

  const open = S.tasks.filter(t => !t.done).length;
  $('task-lbl').textContent = `${open} open · ${S.tasks.length} total`;

  const clearBtn = $('task-clear-btn');
  if (clearBtn) clearBtn.style.display = S.tasks.some(t => t.done) ? '' : 'none';

  if (!tasks.length) {
    $('task-list').innerHTML = '<div class="empty-state"><div class="ei">✅</div><div class="et">No tasks</div><div class="es">Press N to add one</div></div>';
    return;
  }

  $('task-list').innerHTML = tasks.map(tk => {
    const stItems  = stLoad(tk.id);
    const stDone   = stItems.filter(i => i.done).length;
    const expanded = expandedTasks.has(tk.id);
    const priBadge = tk.priority === 'High' ? 'ph' : tk.priority === 'Med' ? 'pm' : 'pl';
    const tagLbl   = tk.tag ? getTagLabel(tk.tag) : '';

    const stProg = stItems.length
      ? `<span style="font-size:11px;color:var(--tx2);cursor:pointer;white-space:nowrap;padding:1px 7px;background:var(--bg3);border-radius:10px;flex-shrink:0" onclick="toggleSubtasks(${tk.id})">${stDone}/${stItems.length} done</span>`
      : '';

    const dueSpan = tk.due_date
      ? `<span style="font-size:11px;color:var(--tx2);white-space:nowrap">${fmt(tk.due_date)}</span>`
      : '';

    const stHtml = expanded ? `<div style="padding:2px 0 8px 24px">
      ${stItems.map(s => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px">
        <div class="ck${s.done?' on':''}" onclick="stToggle(${tk.id},${s.id})" style="width:14px;height:14px;border-radius:3px"></div>
        <span class="${s.done?'strike':''}" style="flex:1;color:${s.done?'var(--tx3)':'var(--tx)'}">${esc(s.text)}</span>
        <button class="xb" onclick="stDelete(${tk.id},${s.id})">✕</button>
      </div>`).join('')}
      <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
        <input id="st-inp-${tk.id}" type="text" placeholder="Add subtask…" style="flex:1;font-size:12px;padding:3px 8px"
          onkeydown="if(event.key==='Enter'){stAdd(${tk.id},this.value)}"/>
        <button style="font-size:11px;padding:3px 8px" onclick="stAdd(${tk.id},$('st-inp-${tk.id}').value)">+</button>
      </div>
    </div>` : '';

    return `<div style="border-bottom:0.5px solid var(--bd)">
      <div style="display:flex;align-items:center;gap:9px;padding:8px 0;font-size:13px">
        <div class="ck${tk.done?' on':''}" onclick="toggleTask(${tk.id})"></div>
        <span class="${tk.done?'strike':''}" style="flex:1">${esc(tk.name)}</span>
        ${stProg}
        <span class="badge ${priBadge}">${tk.priority}</span>
        ${tagLbl ? `<span class="chip">${esc(tagLbl)}</span>` : ''}
        ${dueSpan}
        <button class="eb" onclick="openEditTask(${tk.id})" title="Edit">✎</button>
        <button class="xb" onclick="deleteTask(${tk.id})">✕</button>
      </div>
      ${stHtml}
    </div>`;
  }).join('');
}

$('t-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') { if (editingTaskId) updateTask(editingTaskId); else saveTask(); }
});

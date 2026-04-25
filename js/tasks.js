let TF = '';

function setTF(f, el) {
  TF = f;
  document.querySelectorAll('.tpill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  renderTasks();
}

async function saveTask() {
  const name = $('t-name').value.trim(); if (!name) return;
  const row = await dbInsert('tasks', {
    name, priority: $('t-pri').value, tag: $('t-tag').value,
    due_date: $('t-date').value || null, done: false
  });
  if (row) { S.tasks.unshift(row); closeM('m-task'); $('t-name').value = ''; renderTasks(); renderHome(); }
}

async function toggleTask(id) {
  const tk = S.tasks.find(t => t.id === id); if (!tk) return;
  tk.done = !tk.done;
  await dbUpdate('tasks', id, { done: tk.done });
  renderTasks(); renderHome();
}

async function deleteTask(id) {
  await dbDelete('tasks', id);
  S.tasks = S.tasks.filter(t => t.id !== id);
  renderTasks(); renderHome();
}

function renderTasks() {
  let tasks = [...S.tasks];
  const q = ($('task-search') || { value: '' }).value.toLowerCase();
  if (TF) tasks = tasks.filter(t => t.tag === TF);
  if (q) tasks = tasks.filter(t => t.name.toLowerCase().includes(q));
  tasks.sort((a, b) => {
    const p = { High:0, Med:1, Low:2 };
    if (a.done !== b.done) return a.done ? 1 : -1;
    return p[a.priority] - p[b.priority];
  });
  const open = S.tasks.filter(t => !t.done).length;
  $('task-lbl').textContent = `${open} open · ${S.tasks.length} total`;
  $('task-list').innerHTML = tasks.length ? tasks.map(tk => `
    <div class="row">
      <div class="ck${tk.done ? ' on' : ''}" onclick="toggleTask(${tk.id})"></div>
      <span class="${tk.done ? 'strike' : ''}" style="flex:1">${esc(tk.name)}</span>
      <span class="badge ${tk.priority === 'High' ? 'ph' : tk.priority === 'Med' ? 'pm' : 'pl'}">${tk.priority}</span>
      <span class="chip">${esc(tk.tag)}</span>
      ${tk.due_date ? `<span style="font-size:11px;color:var(--tx2)">${fmt(tk.due_date)}</span>` : ''}
      <button class="xb" onclick="deleteTask(${tk.id})">✕</button>
    </div>`).join('') : '<div class="empty-state"><div class="ei">✅</div><div class="et">No tasks</div><div class="es">Press N to add one</div></div>';
}

$('t-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveTask(); });

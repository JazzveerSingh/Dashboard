async function saveCourse() {
  const name = $('c-name').value.trim(); if (!name) return;
  const g = parseFloat($('c-grade').value);
  const row = await dbInsert('courses', { name, grade: isNaN(g) ? null : g, notes: '' });
  if (row) { S.courses.push(row); closeM('m-course'); $('c-name').value = ''; $('c-grade').value = ''; renderAcademics(); }
}

async function deleteCourse(id) {
  await dbDelete('courses', id);
  S.courses = S.courses.filter(c => c.id !== id);
  S.assignments = S.assignments.filter(a => a.course_id !== id);
  renderAcademics(); renderHome();
}

async function updateGrade(id, v) {
  const c = S.courses.find(c => c.id === id); if (!c) return;
  c.grade = v === '' ? null : parseFloat(v);
  await dbUpdate('courses', id, { grade: c.grade });
  renderAcaMeta();
}

async function updateNotes(id, v) {
  const c = S.courses.find(c => c.id === id); if (!c) return;
  c.notes = v;
  await dbUpdate('courses', id, { notes: v });
}

function openAssign(cid) {
  $('a-name').value = ''; $('a-date').value = ''; $('a-status').value = 'todo'; $('a-cid').value = cid;
  openM('m-assign');
}

async function saveAssign() {
  const name = $('a-name').value.trim(); if (!name) return;
  const cid = parseInt($('a-cid').value);
  const row = await dbInsert('assignments', { course_id: cid, name, due_date: $('a-date').value || null, status: $('a-status').value });
  if (row) { S.assignments.push(row); closeM('m-assign'); renderAcademics(); }
}

async function cycleStatus(aid) {
  const a = S.assignments.find(a => a.id === aid); if (!a) return;
  const order = ['todo', 'ip', 'done'];
  a.status = order[(order.indexOf(a.status) + 1) % 3];
  await dbUpdate('assignments', aid, { status: a.status });
  renderAcademics(); renderHome();
}

async function delAssign(aid) {
  await dbDelete('assignments', aid);
  S.assignments = S.assignments.filter(a => a.id !== aid);
  renderAcademics();
}

function renderAcaMeta() {
  const grades = S.courses.map(c => c.grade).filter(g => g != null);
  const avg = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
  $('ac-avg').textContent = avg != null ? avg.toFixed(1) + '%' : '—';
  $('ac-bar').style.width = (avg ?? 0) + '%';
  const all = S.assignments, done = all.filter(a => a.status === 'done').length;
  $('ac-done').textContent = `${done} / ${all.length}`;
  $('ac-sub').textContent = all.length ? Math.round(done / all.length * 100) + '% complete' : '';
}

function renderAcademics() {
  renderAcaMeta();
  const sl = s => s === 'done' ? 'Done' : s === 'ip' ? 'In progress' : 'To do';
  const sc = s => s === 'done' ? 'sd' : s === 'ip' ? 'si' : 'st2';
  $('course-list').innerHTML = S.courses.map(c => {
    const assigns = S.assignments.filter(a => a.course_id === c.id);
    return `<div class="cc">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:14px;font-weight:600">${esc(c.name)}</span>
        <div style="display:flex;align-items:center;gap:7px">
          <input type="number" min="0" max="100" value="${c.grade ?? ''}" placeholder="—"
            style="width:56px;text-align:center;font-weight:600;font-size:14px"
            oninput="updateGrade(${c.id},this.value)"/>
          <span style="font-size:11px;color:var(--tx2)">%</span>
          <button class="xb" onclick="deleteCourse(${c.id})">✕</button>
        </div>
      </div>
      ${assigns.map(a => `<div class="arow">
        <span style="flex:1">${esc(a.name)}</span>
        <span class="badge ${sc(a.status)}" style="cursor:pointer" onclick="cycleStatus(${a.id})" title="Click to cycle">${sl(a.status)}</span>
        <span style="font-size:11px;color:var(--tx2)">${fmt(a.due_date)}</span>
        <button class="xb" onclick="delAssign(${a.id})">✕</button>
      </div>`).join('')}
      <button style="margin-top:8px;font-size:12px;padding:5px 10px" onclick="openAssign(${c.id})">+ Add assignment</button>
      <textarea class="notes" placeholder="Notes…" oninput="updateNotes(${c.id},this.value)">${esc(c.notes || '')}</textarea>
    </div>`;
  }).join('') || '<div class="empty-state card"><div class="ei">📚</div><div class="et">No courses yet</div><div class="es">Add your first course to get started</div></div>';
}

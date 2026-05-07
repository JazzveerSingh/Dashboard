// ── Shared helpers (defined first so every script can use them) ──
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const addD = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const fmt = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month:'short', day:'numeric' }) : '';
const dfn = d => Math.round((new Date(d + 'T12:00:00') - new Date(new Date().toDateString())) / 86400000);
const getLast = n => Array.from({ length:n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n-1-i)); return d.toISOString().slice(0, 10); });

// ── Supabase client ───────────────────────────────────────────────
const SUPABASE_URL = 'https://bmamubgaydqscspiglte.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtYW11YmdheWRxc2NzcGlnbHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMjc0MzIsImV4cCI6MjA5MjcwMzQzMn0.dhq66UFRhgP_DTtdE8EnzFfh98ex1BSgCygNXs5sw6U';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── In-memory state (loaded from Supabase on login) ───────────────
const S = {
  profile:          { name: '', avatar: '🎸', location: '' },
  tasks:            [],
  courses:          [],
  assignments:      [],
  transactions:     [],
  savings:          [],
  habits:           [],
  habitLogs:        [],
  subtasks:         [],
  taskArchive:      [],
  budgetCategories: [],
  budgetLimits:     [],
  budgetArchive:    [],
  savingsContribs:  [],
  gradeSnapshots:   [],
  pomoSessions:     null,
  userId:           null
};

// ── Generic CRUD helpers ──────────────────────────────────────────
async function dbGet(table, extra = {}) {
  let q = db.from(table).select('*').eq('user_id', S.userId);
  if (extra.order) q = q.order(extra.order, { ascending: extra.asc ?? true });
  const { data, error } = await q;
  if (error) console.error(`dbGet ${table}:`, error);
  return data || [];
}

async function dbInsert(table, row) {
  const { data, error } = await db.from(table).insert({ ...row, user_id: S.userId }).select().single();
  if (error) { console.error(`dbInsert ${table}:`, error); return null; }
  return data;
}

async function dbUpdate(table, id, changes) {
  const { error } = await db.from(table).update(changes).eq('id', id).eq('user_id', S.userId);
  if (error) console.error(`dbUpdate ${table}:`, error);
}

async function dbDelete(table, id) {
  const { error } = await db.from(table).delete().eq('id', id).eq('user_id', S.userId);
  if (error) console.error(`dbDelete ${table}:`, error);
}

// ── Load all data (explicit column selects, 15 parallel queries) ──
async function loadAll() {
  const uid = S.userId;
  const q = (table, cols, order, asc = true) => {
    let r = db.from(table).select(cols).eq('user_id', uid);
    if (order) r = r.order(order, { ascending: asc });
    return r;
  };

  const [
    profile, tasks, courses, assignments, transactions, savings,
    habits, habitLogs, subtasks, taskArchive, budgetCategories,
    budgetLimits, budgetArchive, savingsContribs, gradeSnapshots
  ] = await Promise.all([
    db.from('profile').select('id, user_id, name, avatar, location').eq('user_id', uid).single(),
    q('tasks',        'id, user_id, name, priority, tag, due_date, done, created_at',                                    'created_at', false),
    q('courses',      'id, user_id, name, grade, notes, created_at',                                                   'created_at'),
    q('assignments',  'id, user_id, course_id, name, due_date, status, weight, type, score, max_score, score_ts, created_at', 'created_at'),
    q('transactions', 'id, user_id, name, category, amount, created_at',                                               'created_at', false),
    q('savings',      'id, user_id, name, target_amount, current_amount, created_at',                                  'created_at'),
    q('habits',       'id, user_id, name, emoji, streak, created_at',                                                  'created_at'),
    q('habit_logs',   'id, user_id, habit_id, log_date',                                                           'log_date'),
    q('subtasks',           'id, user_id, task_id, text, done, created_at',                             'created_at'),
    q('task_archive',       'id, user_id, name, priority, tag, due_date, done, archived_at, created_at','archived_at', false),
    q('budget_categories',  'id, user_id, legacy_id, label, color, is_income, created_at',             'created_at'),
    q('budget_limits',      'id, user_id, category_id, monthly_limit, warning_threshold, created_at',  'created_at'),
    q('budget_archive',     'id, user_id, month, category_id, amount, created_at',                     'month', false),
    q('savings_contributions','id, user_id, goal_id, amount, date, note, created_at',                  'date', false),
    q('grade_snapshots',    'id, user_id, course_id, grade, snapshot_date, created_at',                'snapshot_date')
  ]);

  if (profile.data) S.profile = { name: profile.data.name || '', avatar: profile.data.avatar || '🎸', location: profile.data.location || '' };
  S.tasks            = tasks.data            || [];
  S.courses          = courses.data          || [];
  S.assignments      = assignments.data      || [];
  S.transactions     = transactions.data     || [];
  S.savings          = savings.data          || [];
  S.habits           = habits.data           || [];
  S.habitLogs        = habitLogs.data        || [];
  S.subtasks         = subtasks.data         || [];
  S.taskArchive      = taskArchive.data      || [];
  S.budgetCategories = budgetCategories.data || [];
  S.budgetLimits     = budgetLimits.data     || [];
  S.budgetArchive    = budgetArchive.data    || [];
  S.savingsContribs  = savingsContribs.data  || [];
  S.gradeSnapshots   = gradeSnapshots.data   || [];
}

// ── One-time migrations (localStorage → Supabase) ─────────────────
// localStorage keys are preserved until Phase 4 updates each module
// to read from S.* instead — only then will the keys be removed.
function getMigFlag(key) { return localStorage.getItem('_mig_v2_' + key) === '1'; }
function setMigFlag(key) { localStorage.setItem('_mig_v2_' + key, '1'); }

async function migrateSubtasks() {
  if (getMigFlag('subtasks')) return;
  const rows = [];
  for (const task of S.tasks) {
    const raw = localStorage.getItem('st_' + task.id);
    if (!raw) continue;
    let list; try { list = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(list)) continue;
    for (const st of list) rows.push({ user_id: S.userId, task_id: task.id, text: st.text || '', done: !!st.done });
  }
  if (rows.length) {
    const { error } = await db.from('subtasks').insert(rows);
    if (error) { console.error('[mig] subtasks:', error); return; }
  }
  setMigFlag('subtasks');
  console.log(`[mig] subtasks: ${rows.length} rows`);
}

async function migrateTaskArchive() {
  if (getMigFlag('task_archive')) return;
  const raw = localStorage.getItem('ar_tasks');
  if (!raw) { setMigFlag('task_archive'); return; }
  let list; try { list = JSON.parse(raw); } catch { list = []; }
  const rows = (Array.isArray(list) ? list : []).map(t => ({
    user_id: S.userId, name: t.name || '', priority: t.priority || 'Med',
    tag: t.tag || null, due_date: t.due_date || null, done: !!t.done,
    archived_at: t.archived_at || new Date().toISOString()
  }));
  if (rows.length) {
    const { error } = await db.from('task_archive').insert(rows);
    if (error) { console.error('[mig] task_archive:', error); return; }
  }
  setMigFlag('task_archive');
  console.log(`[mig] task_archive: ${rows.length} rows`);
}

// Budget tables are migrated atomically: categories → limits → archive.
// category_id is stored as text (original string ID) so existing module
// code keeps working unchanged until Phase 4 rewires money.js reads.
async function migrateBudget() {
  if (getMigFlag('budget')) return;

  const catsRaw    = localStorage.getItem('user_cats');
  const limitsRaw  = localStorage.getItem('cat_budgets');
  const archiveRaw = localStorage.getItem('budget_archive');

  if (catsRaw) {
    let cats; try { cats = JSON.parse(catsRaw); } catch { cats = []; }
    if (Array.isArray(cats) && cats.length) {
      const rows = cats.map(c => ({
        user_id: S.userId, legacy_id: c.id,
        label: c.label || '', color: c.color || '#888888', is_income: !!c.is_income
      }));
      const { error } = await db.from('budget_categories').insert(rows);
      if (error) { console.error('[mig] budget_categories:', error); return; }
    }
  }

  if (limitsRaw) {
    let obj; try { obj = JSON.parse(limitsRaw); } catch { obj = {}; }
    const entries = Object.entries(obj || {});
    if (entries.length) {
      const rows = entries.map(([catId, v]) => ({
        user_id: S.userId, category_id: catId,
        monthly_limit: v.monthly_limit ?? null, warning_threshold: v.warning_threshold ?? 80
      }));
      const { error } = await db.from('budget_limits').insert(rows);
      if (error) { console.error('[mig] budget_limits:', error); return; }
    }
  }

  if (archiveRaw) {
    let obj; try { obj = JSON.parse(archiveRaw); } catch { obj = {}; }
    const rows = [];
    for (const [month, cats] of Object.entries(obj || {})) {
      for (const [catId, amount] of Object.entries(cats || {})) {
        rows.push({ user_id: S.userId, month, category_id: catId, amount: Number(amount) || 0 });
      }
    }
    if (rows.length) {
      const { error } = await db.from('budget_archive').insert(rows);
      if (error) { console.error('[mig] budget_archive:', error); return; }
    }
  }

  setMigFlag('budget');
  console.log('[mig] budget: done');
}

async function migrateSavingsContribs() {
  if (getMigFlag('savings_contribs')) return;
  const rows = [];
  for (const goal of S.savings) {
    const raw = localStorage.getItem('sv_contribs_' + goal.id);
    if (!raw) continue;
    let list; try { list = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      rows.push({ user_id: S.userId, goal_id: goal.id, amount: Number(c.amount) || 0, date: c.date || today(), note: c.note || null });
    }
  }
  if (rows.length) {
    const { error } = await db.from('savings_contributions').insert(rows);
    if (error) { console.error('[mig] savings_contribs:', error); return; }
  }
  setMigFlag('savings_contribs');
  console.log(`[mig] savings_contribs: ${rows.length} rows`);
}

async function runMigrations() {
  await migrateSubtasks();
  await migrateTaskArchive();
  await migrateBudget();
  await migrateSavingsContribs();
}

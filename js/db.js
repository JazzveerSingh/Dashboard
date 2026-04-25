// Supabase client
const SUPABASE_URL = 'https://bmamubgaydqscspiglte.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtYW11YmdheWRxc2NzcGlnbHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMjc0MzIsImV4cCI6MjA5MjcwMzQzMn0.dhq66UFRhgP_DTtdE8EnzFfh98ex1BSgCygNXs5sw6U';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// In-memory state (loaded from Supabase on login)
const S = {
  profile: { name: 'Jazz', avatar: '🎸' },
  tasks: [],
  courses: [],
  assignments: [],
  transactions: [],
  savings: [],
  habits: [],
  habitLogs: [],
  userId: null
};

// ── Generic helpers ────────────────────────────────────────────
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

// ── Load all data ─────────────────────────────────────────────
async function loadAll() {
  const [profile, tasks, courses, assignments, transactions, savings, habits, habitLogs] = await Promise.all([
    db.from('profile').select('*').eq('user_id', S.userId).single(),
    dbGet('tasks', { order: 'created_at', asc: false }),
    dbGet('courses', { order: 'created_at' }),
    dbGet('assignments', { order: 'created_at' }),
    dbGet('transactions', { order: 'created_at', asc: false }),
    dbGet('savings', { order: 'created_at' }),
    dbGet('habits', { order: 'created_at' }),
    dbGet('habit_logs', { order: 'log_date' })
  ]);

  if (profile.data) S.profile = { name: profile.data.name, avatar: profile.data.avatar };
  S.tasks = tasks;
  S.courses = courses;
  S.assignments = assignments;
  S.transactions = transactions;
  S.savings = savings;
  S.habits = habits;
  S.habitLogs = habitLogs;
}

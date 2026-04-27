// ── Auth view switching ────────────────────────────────────────
function showAuthView(v) {
  ['signin','signup','forgot','reset'].forEach(n => {
    const el = document.getElementById('av-' + n);
    if (el) el.style.display = n === v ? '' : 'none';
  });
  const err = document.getElementById('auth-error');
  if (err) err.style.display = 'none';
  const suc = document.getElementById('forgot-success');
  if (suc) suc.style.display = 'none';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
}

// ── Sign in ────────────────────────────────────────────────────
async function signIn() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const btn = document.getElementById('auth-signin-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  document.getElementById('auth-error').style.display = 'none';
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  btn.textContent = 'Sign in'; btn.disabled = false;
  if (error) return showAuthError(error.message);
  await onSignIn(data.user);
}

// ── Sign up ────────────────────────────────────────────────────
async function signUp() {
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  if (!name)     return showAuthError('Please enter your name.');
  if (!email)    return showAuthError('Please enter your email.');
  if (password.length < 6) return showAuthError('Password must be at least 6 characters.');
  const btn = document.getElementById('auth-signup-btn');
  btn.textContent = 'Creating account…'; btn.disabled = true;
  document.getElementById('auth-error').style.display = 'none';
  const { data, error } = await db.auth.signUp({ email, password });
  btn.textContent = 'Create account'; btn.disabled = false;
  if (error) return showAuthError(error.message);
  if (data.user) await onSignIn(data.user, name);
}

// ── Sign out ───────────────────────────────────────────────────
async function signOut() {
  await db.auth.signOut();
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  showAuthView('signin');
  S.userId = null;
}

// ── Forgot password ────────────────────────────────────────────
async function sendPasswordReset() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { showAuthError('Please enter your email address.'); return; }
  document.getElementById('auth-error').style.display = 'none';
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) { showAuthError('Something went wrong. Try again in a moment.'); return; }
  const suc = document.getElementById('forgot-success');
  if (suc) suc.style.display = 'block';
}

// ── Update password (after recovery link) ─────────────────────
async function updatePassword() {
  const pw1 = document.getElementById('reset-pw1').value;
  const pw2 = document.getElementById('reset-pw2').value;
  if (pw1 !== pw2)   { showAuthError('Passwords do not match.'); return; }
  if (pw1.length < 8){ showAuthError('Password must be at least 8 characters.'); return; }
  document.getElementById('auth-error').style.display = 'none';
  const { error } = await db.auth.updateUser({ password: pw1 });
  if (error) { showAuthError(error.message); return; }
  const { data } = await db.auth.getSession();
  if (data.session) await onSignIn(data.session.user);
}

function pwStrength(val) {
  const bar = document.getElementById('pw-str-bar');
  if (!bar) return;
  const len = val.length;
  const pct = Math.min(100, (len / 12) * 100);
  const color = len < 6 ? 'var(--red)' : len < 8 ? '#e8a838' : len < 12 ? 'var(--green)' : 'var(--acc)';
  bar.style.width = pct + '%'; bar.style.background = color;
  const btn = document.getElementById('reset-btn');
  if (btn) btn.disabled = len < 8;
}

// ── Shared sign-in flow ────────────────────────────────────────
async function onSignIn(user, displayName) {
  S.userId = user.id;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  await ensureProfile(displayName);
  await loadAll();
  applyProfile();
  initCats();
  initClock();
  fetchWx();
  renderAll();
  initKeyboard();
  initQA();
  initPomo();
  clUpdateDot();
  checkMonthReset();
  clCheckOnLoad();
}

async function ensureProfile(displayName) {
  const { data } = await db.from('profile').select('id').eq('user_id', S.userId).single();
  if (!data) {
    await db.from('profile').insert({
      user_id: S.userId,
      name: displayName || '',
      avatar: '🎸',
      location: ''
    });
  }
}

// ── Page load ──────────────────────────────────────────────────
window.addEventListener('load', async () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    const btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = savedTheme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode';
  }

  // Detect password-recovery link
  db.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      document.getElementById('app').style.display = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
      showAuthView('reset');
    }
  });

  const { data } = await db.auth.getSession();
  if (data.session) await onSignIn(data.session.user);
});

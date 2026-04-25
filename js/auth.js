async function signIn() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const btn = document.getElementById('auth-signin-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  btn.textContent = 'Sign in'; btn.disabled = false;
  if (error) return showAuthError(error.message);
  await onSignIn(data.user);
}

async function signUp() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const btn = document.getElementById('auth-signup-btn');
  btn.textContent = 'Creating account…'; btn.disabled = true;
  const { data, error } = await db.auth.signUp({ email, password });
  btn.textContent = 'Create account'; btn.disabled = false;
  if (error) return showAuthError(error.message);
  if (data.user) await onSignIn(data.user);
}

async function signOut() {
  await db.auth.signOut();
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  S.userId = null;
}

async function onSignIn(user) {
  S.userId = user.id;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  showLoading();
  await ensureProfile();
  await loadAll();
  hideLoading();
  applyProfile();
  initClock();
  fetchWx();
  renderAll();
  initKeyboard();
  initQA();
}

async function ensureProfile() {
  const { data } = await db.from('profile').select('id').eq('user_id', S.userId).single();
  if (!data) {
    await db.from('profile').insert({ user_id: S.userId, name: 'Jazz', avatar: '🎸' });
  }
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
}

function showLoading() {
  const main = document.querySelector('.main');
  if (main) main.innerHTML = '<div class="loading"><div class="spinner"></div>Loading your dashboard…</div>';
}

function hideLoading() {
  const main = document.querySelector('.main');
  if (main) main.innerHTML = document.getElementById('app').querySelector('.main').innerHTML;
}

// Check for existing session on page load
window.addEventListener('load', async () => {
  const { data } = await db.auth.getSession();
  if (data.session) {
    await onSignIn(data.session.user);
  }
});

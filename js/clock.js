let prevD = {};
let clockIs12h = localStorage.getItem('clock12h') === 'true';

function setD(id, v) {
  const c = document.getElementById(id); if (!c) return;
  const st = c.querySelector('.fc-st'); if (st) st.textContent = v;
  const tp = c.querySelector('.tp span'); if (tp) tp.textContent = v;
  const bt = c.querySelector('.bt span'); if (bt) bt.textContent = v;
  const btEl = c.querySelector('.bt'); if (btEl) btEl.style.transform = 'rotateX(0deg)';
}

function flipD(id, ov, nv) {
  if (ov === nv) return;
  const c = document.getElementById(id); if (!c) return;
  try {
    const tp = c.querySelector('.tp'), bt = c.querySelector('.bt'), st = c.querySelector('.fc-st');
    if (!tp || !bt || !st) return;
    tp.querySelector('span').textContent = ov;
    bt.querySelector('span').textContent = nv;
    st.textContent = ov;
    tp.style.cssText = 'transition:none;transform:rotateX(0deg)';
    bt.style.cssText = 'transition:none;transform:rotateX(-90deg)';
    void c.offsetWidth;
    tp.style.transition = 'transform .2s ease-in';
    tp.style.transform = 'rotateX(90deg)';
    setTimeout(function () {
      st.textContent = nv;
      tp.style.cssText = 'transition:none;transform:rotateX(0deg)';
      tp.querySelector('span').textContent = nv;
      bt.style.transition = 'transform .2s ease-out';
      bt.style.transform = 'rotateX(0deg)';
    }, 220);
  } catch (e) { setD(id, nv); }
}

function updateGreeting() {
  const hr = new Date().getHours(), g = document.getElementById('greeting');
  if (g) g.textContent = hr < 12 ? 'Good morning ✦' : hr < 17 ? 'Good afternoon ✦' : 'Good evening ✦';
}

function getClockDigits(now) {
  let rawH = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  let period = null;
  if (clockIs12h) {
    period = rawH >= 12 ? 'PM' : 'AM';
    rawH = rawH % 12 || 12;
  }
  const h = String(rawH).padStart(2, '0');
  return { h0: h[0], h1: h[1], m0: m[0], m1: m[1], period };
}

function tickClock() {
  const now = new Date();
  const cur = getClockDigits(now);
  ['h0','h1','m0','m1'].forEach(function(k) {
    flipD('fc-' + k, prevD[k] != null ? prevD[k] : cur[k], cur[k]);
    prevD[k] = cur[k];
  });
  if (clockIs12h && cur.period !== prevD.period) {
    flipD('fc-ap', prevD.period || cur.period, cur.period);
  }
  if (clockIs12h) prevD.period = cur.period;

  const apGrp = document.getElementById('fc-ap-grp');
  if (apGrp) apGrp.style.opacity = clockIs12h ? '1' : '0';

  const fd = document.getElementById('fc-date');
  if (fd) fd.textContent = now.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  updateGreeting();
}

function toggleClockFmt() {
  clockIs12h = !clockIs12h;
  localStorage.setItem('clock12h', clockIs12h);
  // Remove first-use tooltip after first toggle
  localStorage.setItem('clock_toggled', '1');
  const wrap = document.getElementById('fc-wrap');
  if (wrap) wrap.removeAttribute('title');

  const now = new Date();
  const cur = getClockDigits(now);
  prevD = { h0: cur.h0, h1: cur.h1, m0: cur.m0, m1: cur.m1, period: cur.period };
  ['h0','h1','m0','m1'].forEach(function(k) { setD('fc-' + k, cur[k]); });
  if (cur.period) setD('fc-ap', cur.period);
  const apGrp = document.getElementById('fc-ap-grp');
  if (apGrp) apGrp.style.opacity = clockIs12h ? '1' : '0';
}

function initClock() {
  const now = new Date();
  const cur = getClockDigits(now);
  prevD = { h0: cur.h0, h1: cur.h1, m0: cur.m0, m1: cur.m1, period: cur.period };
  ['h0','h1','m0','m1'].forEach(function(k) { setD('fc-' + k, cur[k]); });
  if (cur.period) setD('fc-ap', cur.period);

  const apGrp = document.getElementById('fc-ap-grp');
  if (apGrp) apGrp.style.opacity = clockIs12h ? '1' : '0';

  const wrap = document.getElementById('fc-wrap');
  if (wrap && !localStorage.getItem('clock_toggled')) {
    wrap.title = 'Click to toggle 12/24h';
  }

  const fd = document.getElementById('fc-date');
  if (fd) fd.textContent = now.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  updateGreeting();
  setInterval(tickClock, 1000);
}

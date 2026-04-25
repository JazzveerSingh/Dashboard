let prevD = {};

function setD(id, v) {
  const c = document.getElementById(id); if (!c) return;
  const st = c.querySelector('.fc-st'); if (st) st.textContent = v;
  c.querySelectorAll('span').forEach(s => s.textContent = v);
  const bt = c.querySelector('.bt'); if (bt) bt.style.transform = 'rotateX(0deg)';
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
  if (g) g.textContent = hr < 12 ? 'Good morning \u2726' : hr < 17 ? 'Good afternoon \u2726' : 'Good evening \u2726';
}

function tickClock() {
  const now = new Date(), h = String(now.getHours()).padStart(2, '0'), m = String(now.getMinutes()).padStart(2, '0');
  const cur = { h0: h[0], h1: h[1], m0: m[0], m1: m[1] };
  Object.entries(cur).forEach(function (entry) {
    flipD('fc-' + entry[0], prevD[entry[0]] != null ? prevD[entry[0]] : entry[1], entry[1]);
    prevD[entry[0]] = entry[1];
  });
  const fd = document.getElementById('fc-date');
  if (fd) fd.textContent = now.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  updateGreeting();
}

function initClock() {
  const now = new Date(), h = String(now.getHours()).padStart(2, '0'), m = String(now.getMinutes()).padStart(2, '0');
  prevD = { h0: h[0], h1: h[1], m0: m[0], m1: m[1] };
  Object.entries(prevD).forEach(function (entry) { setD('fc-' + entry[0], entry[1]); });
  const fd = document.getElementById('fc-date');
  if (fd) fd.textContent = now.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  updateGreeting();
  setInterval(tickClock, 10000);
}

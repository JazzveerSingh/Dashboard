let pS = 25 * 60, pT = 25 * 60, pR = false, pB = false, pI = null;

function pRen() {
  const mm = String(Math.floor(pS / 60)).padStart(2, '0');
  const ss = String(pS % 60).padStart(2, '0');
  document.getElementById('p-time').textContent = mm + ':' + ss;
  document.getElementById('p-bar').style.width = Math.round(pS / pT * 100) + '%';
  document.title = pR ? mm + ':' + ss + ' \u00B7 Jazz\'s Dashboard' : 'Jazz\'s Dashboard';
}

function pomoSS() {
  if (pR) {
    clearInterval(pI); pR = false;
    document.getElementById('p-start').textContent = '&#9654; Start';
    document.title = 'Jazz\'s Dashboard';
  } else {
    pR = true;
    document.getElementById('p-start').textContent = '&#9646;&#9646; Pause';
    pI = setInterval(function () {
      if (pS <= 0) {
        clearInterval(pI); pR = false;
        document.getElementById('p-start').textContent = '&#9654; Start';
        document.title = 'Jazz\'s Dashboard';
        // Browser notification if permitted
        if (Notification.permission === 'granted') {
          new Notification(pB ? 'Break over! Time to focus.' : 'Focus session complete! Take a break.', { icon: '🎸' });
        }
        return;
      }
      pS--; pRen();
    }, 1000);
    // Request notification permission
    if (Notification.permission === 'default') Notification.requestPermission();
  }
}

function pomoReset() {
  clearInterval(pI); pR = false; pS = pT;
  document.getElementById('p-start').textContent = '&#9654; Start';
  document.title = 'Jazz\'s Dashboard';
  pRen();
}

function pomoMode() {
  pB = !pB; clearInterval(pI); pR = false;
  pT = pB ? 5 * 60 : 25 * 60; pS = pT;
  document.getElementById('p-lbl').textContent = pB ? 'Break time' : 'Focus session';
  document.getElementById('p-mode').textContent = pB ? 'Focus mode' : 'Break mode';
  document.getElementById('p-start').textContent = '&#9654; Start';
  document.title = 'Jazz\'s Dashboard';
  pRen();
}

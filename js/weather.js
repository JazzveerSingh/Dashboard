const WK = '1bab283e1692f04224d8ed4ffd5ca5d2';

function wxE(id, day) {
  if (id >= 200 && id < 300) return '⛈️';
  if (id >= 300 && id < 400) return '🌦️';
  if (id >= 500 && id < 600) return '🌧️';
  if (id >= 600 && id < 700) return '❄️';
  if (id >= 700 && id < 800) return '🌁';
  if (id === 800) return day ? '☀️' : '🌙';
  if (id === 801) return '🌤️';
  return '☁️';
}

async function fetchWx() {
  try {
    const [cur, fore] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=Brampton,CA&units=metric&appid=${WK}`).then(r => r.json()),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=Brampton,CA&units=metric&cnt=24&appid=${WK}`).then(r => r.json())
    ]);
    if (cur.cod !== 200) throw new Error();
    const day = cur.dt > cur.sys.sunrise && cur.dt < cur.sys.sunset;
    document.getElementById('wx-icon').textContent = wxE(cur.weather[0].id, day);
    document.getElementById('wx-temp').textContent = Math.round(cur.main.temp) + '°C';
    document.getElementById('wx-cond').textContent = cur.weather[0].main + ' · Brampton';
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], seen = new Set(), fc = [];
    const td = new Date().getDay();
    for (const item of fore.list) {
      const d = new Date(item.dt * 1000), dk = d.toDateString();
      if (!seen.has(dk) && d.getDay() !== td) { seen.add(dk); fc.push({ day: days[d.getDay()], high: Math.round(item.main.temp_max), id: item.weather[0].id }); }
      if (fc.length === 3) break;
    }
    document.getElementById('wx-fc').innerHTML = fc.map(f => `
      <div class="wx-dy">
        <div style="font-size:12px">${wxE(f.id, true)}</div>
        <div style="font-size:10px;font-weight:500;margin-top:1px">${f.high}°</div>
        <div style="font-size:9px;color:var(--tx2)">${f.day}</div>
      </div>`).join('');
  } catch (e) {
    document.getElementById('wx-cond').textContent = 'Unavailable';
    document.getElementById('wx-icon').textContent = '—';
  }
}

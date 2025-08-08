// Daily Lures – keyless (stores API key in localStorage)
(() => {
  'use strict';

  const LAKES = [
    {name:'Lake Winnebago', lat:44.0130, lon:-88.5374},
    {name:'Lake Mendota',  lat:43.1312, lon:-89.4125},
    {name:'Lake Monona',   lat:43.0726, lon:-89.3800}
  ];
  const LURES = [
    {min:0,  max:55, lure:'Slow jig or fat worm'},
    {min:55, max:65, lure:'Carolina rig or dropshot'},
    {min:65, max:75, lure:'Crankbait or spinnerbait'},
    {min:75, max:90, lure:'Topwater popper'}
  ];

  // DOM
  const el = {
    key:   document.getElementById('apikey'),
    save:  document.getElementById('savekey'),
    clear: document.getElementById('clear'),
    date:  document.getElementById('date'),
    spot:  document.getElementById('spot'),
    temps: document.getElementById('temps'),
    cond:  document.getElementById('cond'),
    lure:  document.getElementById('lure'),
    btn:   document.getElementById('refresh'),
  };

  const getKey = () => localStorage.getItem('owmKey') || '';
  const setKey = (k) => localStorage.setItem('owmKey', k);
  const clearKey = () => localStorage.removeItem('owmKey');

  const fmtDate = () => new Date().toLocaleDateString(undefined, {
    weekday:'long', month:'long', day:'numeric', year:'numeric'
  });

  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

  const cacheKey = (lake) => `wx:${lake.lat.toFixed(3)},${lake.lon.toFixed(3)}`;

  const timedFetchJSON = async (url, timeout=8000) => {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally { clearTimeout(to); }
  };

  const fetchWeather = async (key, lake) => {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lake.lat}&lon=${lake.lon}&units=imperial&appid=${key}`;
    return timedFetchJSON(url);
  };

  const pickLure = (water) => {
    for (const e of LURES) if (water >= e.min && water < e.max) return e.lure;
    return 'Plastic worm rig';
  };

  const updateUI = (best) => {
    if (!best) return;
    requestAnimationFrame(() => {
      el.date.textContent  = fmtDate();
      el.spot.textContent  = `Best Spot: ${best.name}`;
      el.temps.textContent = `Air: ${best.air.toFixed(1)}°F | Water: ${best.water.toFixed(1)}°F`;
      el.cond.textContent  = `Conditions: ${best.cond}`;
      el.lure.textContent  = `Use: ${best.lure}`;
    });
  };

  const computeBest = async (key) => {
    const results = await Promise.allSettled(LAKES.map(async lake => ({
      lake, wx: await fetchWeather(key, lake)
    })));
    let best=null, bestDiff=Infinity;
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { lake, wx } = r.value;
      const water = Math.max(40, wx.main.temp - 5);
      const diff = Math.abs(water - 68);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = { name: lake.name, air: wx.main.temp, water, cond: wx.weather[0].main, lure: pickLure(water) };
      }
    }
    return best;
  };

  const update = async () => {
    const key = getKey();
    if (!key) {
      el.spot.textContent = 'Enter your OpenWeather API key above and press Save.';
      return;
    }
    try {
      const best = await computeBest(key);
      if (best) updateUI(best);
    } catch (e) {
      console.error(e);
      el.spot.textContent = 'Error fetching weather. Check your API key or try again shortly.';
    }
  };

  // UI wiring
  el.save.addEventListener('click', () => {
    const k = el.key.value.trim();
    if (!k) return;
    setKey(k);
    el.key.value = '';
    update();
  });
  el.clear.addEventListener('click', () => {
    clearKey();
    el.spot.textContent = 'API key cleared. Enter a new key above.';
  });
  el.btn.addEventListener('click', debounce(update, 600));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });

  // Midnight refresh
  const now = new Date();
  const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1) - now;
  setTimeout(() => { update(); setInterval(update, 24*3600*1000); }, msUntilMidnight);

  // First paint
  update();
})();
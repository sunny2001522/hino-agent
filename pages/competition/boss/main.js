const data = window.HINO_EXCEL_DATA;
const fleet = data && (() => {
  const m = key => data.metrics.find(x => x.key === key).data;
  return {
    name: '全隊',
    drivers: data.regions.flatMap(r => r.drivers),
    series: {safety: data.aggregate.safety, idle: m('idle'), dtc: m('dtc'), speed: m('speed')},
  };
})();

function regionAvg(cat, drivers) {
  return Math.round(drivers.reduce((a, d) => a + cat.score(d), 0) / drivers.length);
}

function tier(s) {
  if (s < 55) return {id: 'bad', label: '表現差'};
  if (s < 70) return {id: 'mid', label: '表現一般'};
  return {id: 'ok', label: '表現好'};
}

function mix(cat, drivers) {
  const n = {bad: 0, mid: 0, ok: 0};
  for (const d of drivers) n[tier(cat.score(d)).id]++;
  return n;
}

function avg1(drivers, key) {
  return (drivers.reduce((a, d) => a + d[key], 0) / drivers.length).toFixed(1);
}

function factLine(cat, drivers) {
  if (cat.id === 'safety') return `超速率 ${avg1(drivers, 'overspeed_pct')}%`;
  if (cat.id === 'efficiency') return `怠速 ${avg1(drivers, 'idle_pct')}% · 高引擎負載 ${avg1(drivers, 'high_load_pct')}%`;
  return `DTC ${drivers.reduce((a, d) => a + d.dtc_count, 0)} 筆`;
}

function scoredRegions(cat) {
  return data.regions.map(r => {
    const s = regionAvg(cat, r.drivers);
    return {r, s, t: tier(s), n: mix(cat, r.drivers)};
  }).sort((a, b) => a.s - b.s);
}

function cardsHtml(cat) {
  return scoredRegions(cat).map(({r, s, t, n}) =>
    `<article class="drv ${t.id}" style="border-left-color:${r.color}">
      <div class="drv-top">
        <b>${esc(r.name)}</b>
        <span class="drv-tag">${t.label}</span>
      </div>
      <p class="drv-st">${r.drivers.length} 台 · 差 ${n.bad} · 一般 ${n.mid} · 好 ${n.ok} · ${esc(factLine(cat, r.drivers))}</p>
      <span class="drv-s" style="color:${tint(s)}">${s}</span>
    </article>`
  ).join('');
}

function render(id) {
  const cat = CATS.find(c => c.id === id);
  const avg = regionAvg(cat, fleet.drivers);
  const weak = scoredRegions(cat)[0];
  const hist = history(cat, fleet);
  const mom = hist.at(-1).v - hist.at(-2).v;
  const pts = hist.slice(-2).map((p, i, a) => ({label: i === a.length - 1 ? '本期' : '上期', v: p.v}));
  document.getElementById('scoreVal').textContent = avg;
  document.getElementById('scoreVal').style.color = tint(avg);
  document.getElementById('scoreLabel').textContent = cat.name + ' · ' + fleet.drivers.length + ' 台平均';
  const deltaEl = document.getElementById('scoreDelta');
  deltaEl.textContent = `較上月 ${signed(mom)}`;
  deltaEl.className = 's ' + (mom > 0 ? 'up' : mom < 0 ? 'down' : '');
  document.getElementById('rankVal').textContent = weak.r.name;
  document.getElementById('rankVal').style.color = tint(weak.s);
  document.getElementById('rankOf').textContent = weak.s + ' 分';
  document.getElementById('regions').innerHTML = cardsHtml(cat);
  document.getElementById('chartTitle').textContent = fleet.name;
  document.getElementById('chartSub').textContent = '及格線 70';
  document.getElementById('chart').innerHTML = lineChart(pts, true);
  for (const btn of document.querySelectorAll('#tabs button')) {
    btn.classList.toggle('on', btn.dataset.cat === id);
  }
}

function boot() {
  if (!fleet) {
    document.querySelector('.screen').textContent = '無法載入全隊資料';
    return;
  }
  document.getElementById('ttl').textContent = fleet.name;
  document.getElementById('tabs').innerHTML = CATS.map(cat => {
    const avg = regionAvg(cat, fleet.drivers);
    const weak = scoredRegions(cat)[0];
    return `<button type="button" data-cat="${cat.id}">
      <div class="tn">${cat.name}</div>
      <div class="tv" style="color:${tint(avg)}">${avg}</div>
      <div class="tr">最弱 ${esc(weak.r.name)}</div>
    </button>`;
  }).join('');
  const asOf = fleet.drivers.reduce((m, d) => d.last_time > m ? d.last_time : m, data.meta.lastRecord).slice(0, 10);
  document.getElementById('period').textContent =
    `${data.meta.period} · 資料截至 ${asOf} · Excel ${fleet.drivers.length} 台`;
  document.getElementById('tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (btn) render(btn.dataset.cat);
  });
  render('safety');
  addEventListener('resize', () => {
    clearTimeout(render._t);
    render._t = setTimeout(() => {
      const on = document.querySelector('#tabs button.on');
      if (on) render(on.dataset.cat);
    }, 120);
  });
}

boot();

(function () {
  if (!fleet) return;
  console.assert(data.regions.length === 3, 'three regions');
  console.assert(fleet.drivers.length === 20, 'excel fleet is 20');
  const safety = scoredRegions(CATS[0]);
  console.assert(safety[0].r.name === '北區' && safety[0].s === 69, 'safety weakest is north 69');
  console.assert(scoredRegions(CATS[1])[0].r.name === '南區' && scoredRegions(CATS[1])[0].s === 69, 'efficiency weakest is south 69');
  console.assert(scoredRegions(CATS[2])[0].r.name === '南區' && scoredRegions(CATS[2])[0].s === 64, 'maintenance weakest is south 64');
  console.assert(regionAvg(CATS[0], fleet.drivers) === 75, 'fleet safety avg');
  const html = cardsHtml(CATS[0]);
  console.assert(data.regions.every(r => html.includes(r.name)), 'every region on a card');
  console.assert(!/ABC-/.test(html), 'no car numbers');
  console.assert(!document.getElementById('aiBrief') && !document.getElementById('drawer'), 'no ai or drawer');
})();

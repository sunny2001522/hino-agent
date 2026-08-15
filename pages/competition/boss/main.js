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

function scoredRegions(cat) {
  return data.regions.map(r => {
    const s = regionAvg(cat, r.drivers);
    return {r, s, t: tier(s)};
  }).sort((a, b) => a.s - b.s);
}

function anomalyN(cat, drivers) {
  // ponytail: pie follows the tab. All-types sum if a single unchanging company pie is needed.
  if (cat.id === 'safety') return drivers.reduce((a, d) => a + d.overspeed_count, 0);
  if (cat.id === 'efficiency') return drivers.reduce((a, d) => a + d.idle_count + d.high_load_count, 0);
  return drivers.reduce((a, d) => a + d.dtc_count, 0);
}

function anomalyLabel(cat) {
  return {safety: '超速', efficiency: '怠速＋高負載', maintenance: 'DTC'}[cat.id];
}

function pieChart(slices) {
  const total = slices.reduce((a, s) => a + s.n, 0);
  const R = 42, CX = 50, CY = 50;
  let a0 = -Math.PI / 2;
  const paths = slices.map(s => {
    if (!total || !s.n) return '';
    const frac = s.n / total;
    if (frac >= 1) return `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${s.color}"/>`;
    const a1 = a0 + frac * 2 * Math.PI;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0);
    const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
    a0 = a1;
    return `<path d="M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z" fill="${s.color}"/>`;
  }).join('');
  const legend = slices.map(s => {
    const pct = total ? Math.round(s.n / total * 100) : 0;
    const per = Math.round(s.n / Math.max(1, s.cars));
    return `<div><i style="background:${s.color}"></i>${esc(s.name)} ${s.n.toLocaleString()}（${pct}%）每台 ${per.toLocaleString()}</div>`;
  }).join('');
  return `<div class="pie-wrap"><svg viewBox="0 0 100 100">${paths}</svg><div class="pie-leg">${legend}</div></div>`;
}

function regionSeries(cat) {
  return data.regions.map(r => ({pts: history(cat, r), color: r.color, name: r.name}));
}

function chartHtml(cat) {
  return linesChart(regionSeries(cat));
}

function render(id) {
  const cat = CATS.find(c => c.id === id);
  const avg = regionAvg(cat, fleet.drivers);
  const weak = scoredRegions(cat)[0];
  const hist = history(cat, fleet);
  const mom = hist.at(-1).v - hist.at(-2).v;
  const slices = data.regions.map(r => ({name: r.name, color: r.color, n: anomalyN(cat, r.drivers), cars: r.drivers.length}));
  const hot = slices.reduce((a, s) => s.n / s.cars > a.n / a.cars ? s : a);
  document.getElementById('scoreVal').textContent = avg;
  document.getElementById('scoreVal').style.color = tint(avg);
  document.getElementById('scoreLabel').textContent = cat.name + ' · ' + fleet.drivers.length + ' 台平均';
  const deltaEl = document.getElementById('scoreDelta');
  deltaEl.textContent = `較上月 ${signed(mom)}`;
  deltaEl.className = 's ' + (mom > 0 ? 'up' : mom < 0 ? 'down' : '');
  document.getElementById('rankVal').textContent = weak.r.name;
  document.getElementById('rankVal').style.color = tint(weak.s);
  document.getElementById('rankOf').textContent = weak.s + ' 分';
  document.getElementById('pieTitle').textContent = anomalyLabel(cat) + '次數';
  document.getElementById('pieSub').textContent = '每台最高 ' + hot.name;
  document.getElementById('pie').innerHTML = pieChart(slices);
  document.getElementById('chartLeg').innerHTML = '<span class="chart-leg">' +
    data.regions.map(r => `<span><i style="background:${r.color}"></i>${esc(r.name)}</span>`).join('') + '</span>';
  document.getElementById('regions').innerHTML = chartHtml(cat);
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
  console.assert(scoredRegions(CATS[1])[0].r.name === '南區', 'efficiency weakest is south');
  console.assert(scoredRegions(CATS[2])[0].r.name === '南區', 'maintenance weakest is south');
  const html = chartHtml(CATS[0]);
  console.assert((html.match(/polyline/g) || []).length === 3, 'one line per region');
  console.assert(regionSeries(CATS[0]).every(s => s.pts.length === regionSeries(CATS[0])[0].pts.length), 'shared months');
  console.assert(!/ABC-/.test(html), 'no car numbers');
  const n = data.regions.map(r => anomalyN(CATS[0], r.drivers));
  console.assert(n[0] === 5544 + 3108, 'north overspeed count');
  const pie = pieChart(data.regions.map(r => ({name: r.name, color: r.color, n: anomalyN(CATS[0], r.drivers), cars: r.drivers.length})));
  console.assert(pie.includes('path') && pie.includes('每台'), 'pie has slices and per-car');
  console.assert(!document.getElementById('aiBrief') && !document.getElementById('drawer'), 'no ai or drawer');
})();

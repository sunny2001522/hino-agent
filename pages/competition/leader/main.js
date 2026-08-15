const data = window.HINO_EXCEL_DATA;
const myRegion = data && (() => {
  const m = key => data.metrics.find(x => x.key === key).data;
  return {
    id: '*',
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

function counts(cat, d) {
  if (cat.id === 'safety') return `超速 ${d.overspeed_count} 筆`;
  if (cat.id === 'efficiency') return `怠速 ${d.idle_count} 筆 · 高負載 ${d.high_load_count} 筆`;
  return `DTC ${d.dtc_count} 筆`;
}

function scored(cat) {
  const order = {bad: 0, mid: 1, ok: 2};
  return myRegion.drivers.map(d => {
    const s = cat.score(d);
    return {d, s, t: tier(s), facts: cat.facts(d)};
  }).sort((a, b) => order[a.t.id] - order[b.t.id] || a.s - b.s);
}

function mix(cat) {
  const list = scored(cat);
  return {
    bad: list.filter(x => x.t.id === 'bad').length,
    mid: list.filter(x => x.t.id === 'mid').length,
    ok: list.filter(x => x.t.id === 'ok').length,
  };
}

function cardsHtml(cat) {
  return scored(cat).map(({d, s, t, facts}) => {
    const fail = facts.filter(f => !f.ok);
    const situ = (fail.length ? fail : facts).map(f => f.detail).join(' · ');
    const extra = t.id === 'ok' ? '' : counts(cat, d);
    return `<article class="drv ${t.id}" style="border-left-color:${tint(s)}">
      <div class="drv-top">
        <b>${esc(d.c)}</b>
        <span class="drv-tag">${t.label}</span>
        <span class="drv-s" style="color:${tint(s)}">${s}</span>
      </div>
      <p class="drv-st">${esc(situ)}${extra ? ' · ' + extra : ''}</p>
    </article>`;
  }).join('');
}

function render(id) {
  const cat = CATS.find(c => c.id === id);
  const avg = regionAvg(cat, myRegion.drivers);
  const n = mix(cat);
  const hist = history(cat, myRegion);
  const mom = hist.at(-1).v - hist.at(-2).v;
  const pts = hist.slice(-2).map((p, i, a) => ({label: i === a.length - 1 ? '本期' : '上期', v: p.v}));
  document.getElementById('scoreVal').textContent = avg;
  document.getElementById('scoreVal').style.color = tint(avg);
  document.getElementById('scoreLabel').textContent = cat.name + ' · ' + myRegion.drivers.length + ' 台平均';
  const deltaEl = document.getElementById('scoreDelta');
  deltaEl.textContent = `較上月 ${signed(mom)}`;
  deltaEl.className = 's ' + (mom > 0 ? 'up' : mom < 0 ? 'down' : '');
  document.getElementById('rankVal').textContent = n.mid;
  document.getElementById('rankOf').textContent = `差 ${n.bad} · 好 ${n.ok}`;
  document.getElementById('drivers').innerHTML = cardsHtml(cat);
  document.getElementById('chartTitle').textContent = myRegion.name;
  document.getElementById('chartSub').textContent = '及格線 70';
  document.getElementById('chart').innerHTML = lineChart(pts, true);
  for (const btn of document.querySelectorAll('#tabs button')) {
    btn.classList.toggle('on', btn.dataset.cat === id);
  }
}

function boot() {
  if (!myRegion) {
    document.querySelector('.screen').textContent = '無法載入本區資料';
    return;
  }
  document.getElementById('ttl').textContent = myRegion.name;
  document.getElementById('tabs').innerHTML = CATS.map(cat => {
    const avg = regionAvg(cat, myRegion.drivers);
    const n = mix(cat);
    return `<button type="button" data-cat="${cat.id}">
      <div class="tn">${cat.name}</div>
      <div class="tv" style="color:${tint(avg)}">${avg}</div>
      <div class="tr">差 ${n.bad} · 一般 ${n.mid} · 好 ${n.ok}</div>
    </button>`;
  }).join('');
  const asOf = myRegion.drivers.reduce((m, d) => d.last_time > m ? d.last_time : m, data.meta.lastRecord).slice(0, 10);
  document.getElementById('period').textContent =
    `${data.meta.period} · 資料截至 ${asOf} · Excel ${myRegion.drivers.length} 台`;
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
  if (!myRegion) return;
  console.assert(myRegion.drivers.length === data.meta.vehicles, 'cards use all excel vehicles');
  const html = cardsHtml(CATS[0]);
  console.assert(myRegion.drivers.every(d => html.includes(d.c)), 'every excel car on a card');
  const labels = new Set(CATS.flatMap(c => scored(c).map(x => x.t.label)));
  console.assert(labels.has('表現好') && labels.has('表現一般'), 'excel has good and average tiers');
  console.assert(myRegion.drivers.length === 20, 'excel fleet is 20');
  const a = myRegion.drivers[0];
  console.assert(CATS[0].score(a) === clamp(100 - a.overspeed_pct * 2), 'excel formula');
})();

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

function rankOf(cat, car) {
  const list = [...myRegion.drivers].sort((a, b) => cat.score(b) - cat.score(a));
  return {rank: list.findIndex(d => d.c === car) + 1, total: list.length};
}

const WATCH = {
  first: {id: 'first', label: '第一次出現異常', how: '留意'},
  rare: {id: 'rare', label: '偶發異常', how: '跟進'},
  habit: {id: 'habit', label: '常態性異常', how: '優先'},
};

function watch(cat, d) {
  const fail = cat.facts(d).filter(f => !f.ok);
  if (!fail.length) return null;
  const s = cat.score(d);
  if (s < 55) return WATCH.habit;
  if (cat.id === 'maintenance') {
    if (d.dtc_count <= 1) return WATCH.first;
    if (d.dtc_count <= 5) return WATCH.rare;
    return WATCH.habit;
  }
  // ponytail: no per-car monthly. Intensity from period pct/count; real first-vs-habit when compiler emits monthly.
  if (cat.id === 'safety') {
    const per = d.overspeed_count / Math.max(1, d.journeys);
    if (d.overspeed_pct >= 15 || per >= 30) return WATCH.habit;
    if (d.overspeed_pct < 10 && per < 10) return WATCH.first;
    return WATCH.rare;
  }
  if (d.idle_pct >= 15 || d.high_load_pct >= 12) return WATCH.habit;
  if (d.idle_pct < 10 && d.high_load_pct < 8) return WATCH.first;
  return WATCH.rare;
}

function focusList(cat) {
  const order = {habit: 0, rare: 1, first: 2};
  return myRegion.drivers.map(d => {
    const w = watch(cat, d);
    if (!w) return null;
    const fail = cat.facts(d).filter(f => !f.ok);
    return {d, s: cat.score(d), w, fail, fix: fail[0]?.fix};
  }).filter(Boolean).sort((a, b) => order[a.w.id] - order[b.w.id] || a.s - b.s);
}

function briefHtml(cat) {
  const list = focusList(cat).slice(0, 3);
  if (!list.length) return '<div class="ai-k">AI 重點</div><p>這一類沒有需關注的車。</p>';
  return '<div class="ai-k">AI 重點</div>' + list.map((x, i) => {
    const situ = x.fail.map(f => f.detail).join(' · ');
    const say = i === 0 && x.fix ? `跟他說：${x.fix}` : '';
    return `<p>${i === 0 ? '先找' : '其次'}
      <button type="button" class="car" data-car="${esc(x.d.c)}">${esc(x.d.c)}</button>
      <span class="how ${x.w.id}">${x.w.label} · ${x.w.how}</span>
      ${esc(situ)}${say ? '。' + esc(say) : ''}</p>`;
  }).join('');
}

function cardsHtml(cat) {
  return scored(cat).map(({d, s, t, facts}) => {
    const fail = facts.filter(f => !f.ok);
    const situ = (fail.length ? fail : facts).map(f => f.detail).join(' · ');
    const extra = t.id === 'ok' ? '' : counts(cat, d);
    const w = watch(cat, d);
    return `<article class="drv ${t.id}" data-car="${esc(d.c)}" style="border-left-color:${tint(s)}">
      <div class="drv-top">
        <b>${esc(d.c)}</b>
        <span class="drv-tag">${t.label}</span>
        ${w ? `<span class="drv-tag ${w.id}">${w.label}</span>` : ''}
        <span class="drv-s" style="color:${tint(s)}">${s}</span>
      </div>
      <p class="drv-st">${esc(situ)}${extra ? ' · ' + extra : ''}</p>
    </article>`;
    }).join('');
}

let openCar = null;
let drawerCat = 'safety';

function drawerHtml(d, cat) {
  const score = cat.score(d);
  const {rank, total} = rankOf(cat, d.c);
  const avg = regionAvg(cat, myRegion.drivers);
  const region = data.regions.find(r => r.id === d.region);
  const pts = history(cat, region);
  const asOf = (d.last_time || data.meta.lastRecord).slice(0, 10);
  const t = tier(score);
  const w = watch(cat, d);
  return `<p class="period">${esc(data.meta.period)} · 資料截至 ${esc(asOf)}</p>
    ${w ? `<p class="how ${w.id}">${w.label} · 關注強度 ${w.how}</p>` : ''}
    <div class="score-row">
      <div class="score-card">
        <div class="k">總分</div>
        <div class="v" style="color:${tint(score)}">${score}</div>
        <div class="s">${esc(cat.name)}分數 · ${t.label}</div>
      </div>
      <div class="score-card">
        <div class="k">排名</div>
        <div class="v">${rank}</div>
        <div class="s">/ ${total} · 平均 ${avg}</div>
      </div>
    </div>
    <div class="chartcard">
      <div class="ch-h"><span class="ttl">${esc(region.name)}月趨勢</span><span class="sub">虛線綠燈 70</span></div>
      <div>${lineChart(pts)}</div>
    </div>
    <div class="status">
      <h3>目前狀況</h3>
      <div class="status-body">${statusHtml(cat, d)}</div>
    </div>
    <p class="drv-st">${esc(d.i)} · ${d.journeys} 趟</p>`;
}

function paintDrawer() {
  const d = myRegion.drivers.find(x => x.c === openCar);
  if (!d) return;
  const cat = CATS.find(c => c.id === drawerCat);
  document.getElementById('drawerTitle').textContent = d.c;
  document.getElementById('drawerBody').innerHTML = drawerHtml(d, cat);
  document.getElementById('drawerTabs').innerHTML = CATS.map(c => {
    const score = c.score(d);
    const {rank, total} = rankOf(c, d.c);
    return `<button type="button" data-cat="${c.id}" class="${c.id === drawerCat ? 'on' : ''}">
      <div class="tn">${c.name}</div>
      <div class="tv" style="color:${tint(score)}">${score}</div>
      <div class="tr">第 ${rank} / ${total}</div>
    </button>`;
  }).join('');
  document.querySelectorAll('.drv.on').forEach(el => el.classList.remove('on'));
  const card = document.querySelector(`.drv[data-car="${CSS.escape(d.c)}"]`);
  if (card) card.classList.add('on');
}

function openDrawer(car) {
  openCar = car;
  drawerCat = document.querySelector('#tabs button.on')?.dataset.cat || 'safety';
  paintDrawer();
  document.getElementById('drawer').showModal();
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
  document.getElementById('aiBrief').innerHTML = briefHtml(cat);
  document.getElementById('chartTitle').textContent = myRegion.name;
  document.getElementById('chartSub').textContent = '及格線 70';
  document.getElementById('chart').innerHTML = lineChart(pts, true);
  for (const btn of document.querySelectorAll('#tabs button')) {
    btn.classList.toggle('on', btn.dataset.cat === id);
  }
  if (openCar) {
    const on = document.querySelector(`.drv[data-car="${CSS.escape(openCar)}"]`);
    if (on) on.classList.add('on');
    if (document.getElementById('drawer').open) paintDrawer();
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
  document.getElementById('drivers').addEventListener('click', e => {
    const card = e.target.closest('.drv');
    if (card) openDrawer(card.dataset.car);
  });
  document.getElementById('aiBrief').addEventListener('click', e => {
    const btn = e.target.closest('[data-car]');
    if (btn) openDrawer(btn.dataset.car);
  });
  document.getElementById('drawerClose').addEventListener('click', () => document.getElementById('drawer').close());
  document.getElementById('drawer').addEventListener('close', () => {
    openCar = null;
    document.querySelectorAll('.drv.on').forEach(el => el.classList.remove('on'));
  });
  document.getElementById('drawer').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX < r.left) e.currentTarget.close();
  });
  document.getElementById('drawerTabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    drawerCat = btn.dataset.cat;
    paintDrawer();
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
  console.assert(watch(CATS[2], {dtc_count: 0, overspeed_pct: 0, idle_pct: 0, high_load_pct: 0}) === null, 'clean car is not a watch');
  console.assert(watch(CATS[2], {dtc_count: 1, overspeed_pct: 0, idle_pct: 0, high_load_pct: 0}).id === 'first', 'dtc 1 is first');
  console.assert(watch(CATS[2], {dtc_count: 20, overspeed_pct: 0, idle_pct: 0, high_load_pct: 0}).id === 'habit', 'dtc 20 is habit');
  const brief = briefHtml(CATS[0]);
  console.assert(brief.includes('AI 重點') && /ABC-/.test(brief), 'brief names a car');
})();

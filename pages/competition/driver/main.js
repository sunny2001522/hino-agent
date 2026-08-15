const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
const tint = s => s < 55 ? 'var(--bad)' : s < 70 ? 'var(--warn)' : 'var(--good)';

const CATS = [
  {id: 'safety', name: '安全',
   score: d => clamp(100 - d.overspeed_pct * 2),
   facts: d => [{
     ok: d.overspeed_pct < 8,
     detail: `超速率 ${d.overspeed_pct}%`,
     keep: '超速控制良好，繼續保持平穩車速。',
     fix: '對照路段限速，避免超速與急加速、急減速。',
   }]},
  {id: 'efficiency', name: '效率',
   score: d => clamp(100 - d.idle_pct * 1.2 - d.high_load_pct * 1.5),
   facts: d => [
     {ok: d.idle_pct < 8, detail: `怠速 ${d.idle_pct}%`,
      keep: '怠速偏低，繼續保持停車即熄火。',
      fix: '停車等候請熄火，降低怠速佔比。'},
     {ok: d.high_load_pct < 6, detail: `高引擎負載 ${d.high_load_pct}%`,
      keep: '引擎負載穩定，繼續保持。',
      fix: '避免長時間高負載，檢查載重與轉速。'},
   ]},
  {id: 'maintenance', name: '保養',
   score: d => clamp(100 - d.dtc_count * 4),
   facts: d => [{
     ok: d.dtc_count === 0,
     detail: `DTC ${d.dtc_count} 筆`,
     keep: '無故障碼，持續定期保養。',
     fix: '有 DTC 紀錄，建議進廠讀碼檢修。',
   }]},
];

const data = window.HINO_EXCEL_DATA;
const fleet = data ? data.regions.flatMap(r => r.drivers) : [];
const me = (() => {
  if (!data) return null;
  const code = data.accountBindings.personal_code;
  const region = data.regions.find(r => r.id === code[0]);
  return region.drivers[+code.slice(1)];
})();
const myRegion = me && data.regions.find(r => r.id === me.region);

function history(cat) {
  const s = myRegion.series;
  const raw = {
    safety: s.safety,
    efficiency: s.idle.map(v => clamp(100 - v * 1.2)),
    maintenance: s.dtc.map(v => clamp(100 - v * 4)),
  }[cat.id];
  // ponytail: workbook has region monthly only, not per-car. Drop empty months; last point = this car's score. Per-car monthly when the compiler emits it.
  const pts = data.months.map((label, i) => ({label, v: raw[i]}))
    .filter((_, i) => s.speed[i] || s.idle[i]);
  pts.at(-1).v = cat.score(me);
  return pts;
}

function lineChart(pts) {
  const W = 560, H = 160, pl = 36, pr = 12, pt = 10, pb = 22;
  const n = pts.length, x = i => pl + (W - pl - pr) * (n < 2 ? 0.5 : i / (n - 1));
  const y = v => pt + (H - pt - pb) * (1 - v / 100);
  const grid = [0, 50, 100].map(gv =>
    `<line x1="${pl}" y1="${y(gv)}" x2="${W - pr}" y2="${y(gv)}" stroke="#e4ebed"/><text x="${pl - 6}" y="${y(gv) + 4}" text-anchor="end">${gv}</text>`).join('');
  const axis = pts.map((p, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${p.label}</text>`).join('');
  const line = pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ');
  const dots = pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="${i === n - 1 ? 4 : 2.4}" fill="#7bb42e"/>`).join('');
  return `<svg class="lc" viewBox="0 0 ${W} ${H}">${grid}${axis}<polyline points="${line}" fill="none" stroke="#7bb42e" stroke-width="2.6" stroke-linejoin="round"/>${dots}</svg>`;
}

function rankOf(cat, car) {
  const list = [...fleet].sort((a, b) => cat.score(b) - cat.score(a));
  return {rank: list.findIndex(d => d.c === car) + 1, total: list.length};
}

function statusHtml(cat, d) {
  const facts = cat.facts(d);
  const keep = facts.filter(f => f.ok);
  const note = facts.filter(f => !f.ok);
  let h = '';
  if (keep.length) h += `<h3 class="keep">繼續保持</h3><ul>${keep.map(f => `<li>${f.keep}（${f.detail}）</li>`).join('')}</ul>`;
  if (note.length) {
    h += `<h3 class="note">需要注意</h3><ul>${note.map(f => `<li>${f.detail}</li>`).join('')}</ul>`;
    h += `<h3>可以怎麼改進</h3><ul>${note.map(f => `<li>${f.fix}</li>`).join('')}</ul>`;
  }
  return h;
}

function render(id) {
  const cat = CATS.find(c => c.id === id);
  const score = cat.score(me);
  const {rank, total} = rankOf(cat, me.c);
  document.getElementById('scoreVal').textContent = score;
  document.getElementById('scoreVal').style.color = tint(score);
  document.getElementById('scoreLabel').textContent = cat.name + '分數';
  document.getElementById('rankVal').textContent = rank;
  document.getElementById('rankOf').textContent = `/ ${total}`;
  document.getElementById('statusBody').innerHTML = statusHtml(cat, me);
  document.getElementById('statusBody').className = 'status-body';
  document.getElementById('chartSub').textContent = '2025';
  document.getElementById('chart').innerHTML = lineChart(history(cat));
  for (const btn of document.querySelectorAll('#tabs button')) {
    btn.classList.toggle('on', btn.dataset.cat === id);
  }
}

function boot() {
  if (!me) {
    document.querySelector('.screen').textContent = '無法載入分數資料';
    return;
  }
  document.getElementById('tabs').innerHTML = CATS.map(cat => {
    const score = cat.score(me);
    const {rank, total} = rankOf(cat, me.c);
    return `<button type="button" data-cat="${cat.id}">
      <div class="tn">${cat.name}</div>
      <div class="tv" style="color:${tint(score)}">${score}</div>
      <div class="tr">第 ${rank} / ${total}</div>
    </button>`;
  }).join('');
  document.getElementById('tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (btn) render(btn.dataset.cat);
  });
  render('safety');
}

boot();

(function () {
  const z = {overspeed_pct: 0, idle_pct: 0, high_load_pct: 0, dtc_count: 0};
  const w = {overspeed_pct: 50, idle_pct: 40, high_load_pct: 40, dtc_count: 30};
  console.assert(CATS.every(c => c.score(z) === 100), 'clean input should be 100');
  console.assert(CATS.every(c => c.score(w) < c.score(z)), 'worse input must score lower');
  if (me) {
    const h = history(CATS[0]);
    console.assert(h.length >= 2, 'history should have months');
    console.assert(h.at(-1).v === CATS[0].score(me), 'last point matches current score');
  }
})();

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
  // ponytail: workbook has region monthly only. Drop empty months; do not splice in this car's score. Per-car monthly when the compiler emits it.
  return data.months.map((label, i) => ({label, v: raw[i]}))
    .filter((_, i) => s.speed[i] || s.idle[i]);
}

function lineChart(pts) {
  const W = 560, H = 160, pl = 36, pr = 18, pt = 10, pb = 22;
  const n = pts.length, x = i => pl + (W - pl - pr) * (n < 2 ? 0.5 : i / (n - 1));
  const y = v => pt + (H - pt - pb) * (1 - v / 100);
  const grid = [0, 50, 100].map(gv =>
    `<line x1="${pl}" y1="${y(gv)}" x2="${W - pr}" y2="${y(gv)}" stroke="#e4ebed"/><text x="${pl - 6}" y="${y(gv) + 4}" text-anchor="end">${gv}</text>`).join('');
  const goal = `<line x1="${pl}" y1="${y(70)}" x2="${W - pr}" y2="${y(70)}" stroke="#43a047" stroke-dasharray="5 4"/><text x="${W - pr + 2}" y="${y(70) + 4}" fill="#43a047">70</text>`;
  const axis = pts.map((p, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${p.label}</text>`).join('');
  const line = pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ');
  const dots = pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="${i === n - 1 ? 4 : 2.4}" fill="#7bb42e"/>`).join('');
  return `<svg class="lc" viewBox="0 0 ${W} ${H}">${grid}${goal}${axis}<polyline points="${line}" fill="none" stroke="#7bb42e" stroke-width="2.6" stroke-linejoin="round"/>${dots}</svg>`;
}

function fleetAvg(cat) {
  return Math.round(fleet.reduce((a, d) => a + cat.score(d), 0) / fleet.length);
}

function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}

function rankOf(cat, car) {
  const list = [...fleet].sort((a, b) => cat.score(b) - cat.score(a));
  return {rank: list.findIndex(d => d.c === car) + 1, total: list.length};
}

function moodOf(d) {
  const s = CATS[0].score(d), e = CATS[1].score(d), m = CATS[2].score(d);
  const mom = history(CATS[0]).at(-1).v - history(CATS[0]).at(-2).v;
  if (d.overspeed_pct >= 15 || s < 55)
    return {tag: '激進', line: '我猜你最近開得比較急，先把節奏放慢，人平安比趕時間重要。'};
  if (d.idle_pct >= 15 || e < 55)
    return {tag: '疲憊', line: '怠速偏高，會不會等太久、人有點累？找空檔歇一下，我陪你慢慢調回來。'};
  if (s < 70 && e < 70 && m < 70)
    return {tag: '抑鬱', line: '這陣子分數都壓著，辛苦了，不急著一次拉回來，有想說的隨時找我。'};
  if (mom <= -8)
    return {tag: '緊繃', line: '最近分數往下掉，壓力大的話先顧好自己，穩穩開就很好了。'};
  return {tag: '穩定', line: '狀態算穩，繼續這樣開，想聊聊隨時找我。'};
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function aiReply(q) {
  const {tag, line} = moodOf(me);
  if (/累|疲|睡|休息|加班/.test(q)) return '累了就停一下，車可以等、人要先顧好。我在這裡。';
  if (/急|氣|超速|趕|煩/.test(q)) return '趕路最容易出事，今天目標就是平安到。你已經在注意了，很好。';
  if (/難過|心情|鬱|壓力|不想/.test(q)) return '心情低的時候不用硬撐成績，先把今天開完、好好吃飯。我聽得見。';
  if (/分數|排名|安全|效率|保養/.test(q)) return line;
  return `我猜你現在偏「${tag}」。想說什麼都行，一句也沒關係。`;
}

function addBub(role, text) {
  const log = document.getElementById('chatlog');
  log.insertAdjacentHTML('beforeend', `<div class="bub ${role}">${esc(text)}</div>`);
  log.scrollTop = log.scrollHeight;
}

function openChat() {
  const dlg = document.getElementById('aiChat');
  const log = document.getElementById('chatlog');
  if (!log.dataset.hi) {
    addBub('ai', moodOf(me).line);
    log.dataset.hi = '1';
  }
  dlg.showModal();
  document.getElementById('chatInput').focus();
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
  const pts = history(cat);
  const mom = pts.at(-1).v - pts.at(-2).v;
  const avg = fleetAvg(cat);
  document.getElementById('scoreVal').textContent = score;
  document.getElementById('scoreVal').style.color = tint(score);
  document.getElementById('scoreLabel').textContent = cat.name + '分數';
  const deltaEl = document.getElementById('scoreDelta');
  deltaEl.textContent = `車隊較上月 ${signed(mom)}`;
  deltaEl.className = 's ' + (mom > 0 ? 'up' : mom < 0 ? 'down' : '');
  document.getElementById('rankVal').textContent = rank;
  document.getElementById('rankOf').textContent = `/ ${total} · 平均 ${avg}`;
  document.getElementById('statusBody').innerHTML = statusHtml(cat, me);
  document.getElementById('statusBody').className = 'status-body';
  document.getElementById('chartTitle').textContent = myRegion.name + '月趨勢';
  document.getElementById('chartSub').textContent = '虛線綠燈 70';
  document.getElementById('chart').innerHTML = lineChart(pts);
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
  const asOf = (me.last_time || data.meta.lastRecord).slice(0, 10);
  document.getElementById('period').textContent = `${data.meta.period} · 資料截至 ${asOf}`;
  document.getElementById('aiBubble').textContent = moodOf(me).line;
  document.getElementById('aiOpen').addEventListener('click', openChat);
  document.getElementById('aiClose').addEventListener('click', () => document.getElementById('aiChat').close());
  document.getElementById('chatForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    addBub('me', q);
    addBub('ai', aiReply(q));
  });
  if (window.lucide) lucide.createIcons();
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
    console.assert(h.at(-1).v === myRegion.series.safety.filter((_, i) => myRegion.series.speed[i] || myRegion.series.idle[i]).at(-1), 'last point is region month');
    console.assert(['激進', '疲憊', '抑鬱', '緊繃', '穩定'].includes(moodOf(me).tag), 'mood tag');
  }
})();

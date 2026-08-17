const data = window.HINO_EXCEL_DATA;
const fleet = data ? data.regions.flatMap(r => r.drivers) : [];
const me = (() => {
  if (!data) return null;
  const code = data.accountBindings.driver_code;
  const region = data.regions.find(r => r.id === code[0]);
  return region.drivers[+code.slice(1)];
})();
const myRegion = me && data.regions.find(r => r.id === me.region);

function rankOf(cat, car) {
  const list = [...fleet].sort((a, b) => cat.score(b) - cat.score(a));
  return {rank: list.findIndex(d => d.c === car) + 1, total: list.length};
}

function moodOf(d) {
  const s = CATS[0].score(d), e = CATS[1].score(d), m = CATS[2].score(d);
  const mom = history(CATS[0], myRegion).at(-1).v - history(CATS[0], myRegion).at(-2).v;
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

function render(id) {
  const cat = CATS.find(c => c.id === id);
  const score = cat.score(me);
  const {rank, total} = rankOf(cat, me.c);
  const pts = history(cat, myRegion);
  const mom = pts.at(-1).v - pts.at(-2).v;
  const avg = regionAvg(cat, fleet);
  document.getElementById('scoreVal').textContent = score;
  document.getElementById('scoreVal').style.color = tint(score);
  document.getElementById('scoreLabel').textContent = cat.name + '分數';
  const deltaEl = document.getElementById('scoreDelta');
  deltaEl.textContent = `本區較上月 ${signed(mom)}`;
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
  const z = {overspeed_pct: 0, idle_pct: 0, high_load_pct: 0, dtc_count: 0};
  const w = {overspeed_pct: 50, idle_pct: 40, high_load_pct: 40, dtc_count: 30};
  console.assert(CATS.every(c => c.score(z) === 100), 'clean input should be 100');
  console.assert(CATS.every(c => c.score(w) < c.score(z)), 'worse input must score lower');
  if (me) {
    const h = history(CATS[0], myRegion);
    console.assert(h.length >= 2, 'history should have months');
    console.assert(h.at(-1).v === myRegion.series.safety.filter((_, i) => myRegion.series.speed[i] || myRegion.series.idle[i]).at(-1), 'last point is region month');
    console.assert(['激進', '疲憊', '抑鬱', '緊繃', '穩定'].includes(moodOf(me).tag), 'mood tag');
  }
})();

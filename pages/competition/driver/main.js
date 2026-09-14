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
  if (d.overspeed_pct >= 15) return {tag: '待覆核', line: '歷史超速紀錄偏高，請先確認限速資料與派車條件。車號訊號不能推定個人情緒或責任。'};
  if (d.idle_pct >= 15) return {tag: '等待情境待確認', line: '怠速紀錄偏高，請在停妥後回報裝卸、等待與必要作業原因，由調度協助確認。'};
  return {tag: '歷史資料摘要', line: '目前沒有超過這組展示門檻，仍需留意路況。這是規則摘要，不是即時風險預測。'};
}

function aiReply(q) {
  if (/累|疲|睡|休息/.test(q)) return '請在安全地點停妥後再操作或回報，並由調度協助安排。此介面無法判斷疲勞程度。';
  return moodOf(me).line;
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
  deltaEl.textContent = `本區較前次有資料月份 ${signed(mom)}`;
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
    console.assert(h.at(-1).v === myRegion.series.safety.filter((_, i) => myRegion.recordsByMonth ? myRegion.recordsByMonth[i] > 0 : myRegion.series.safety[i] !== null).at(-1), 'last point is region month');
    console.assert(['待覆核', '等待情境待確認', '歷史資料摘要'].includes(moodOf(me).tag), 'mood tag');
  }
})();

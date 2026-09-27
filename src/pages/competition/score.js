export const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
export const tint = s => s < 55 ? 'var(--bad)' : s < 70 ? 'var(--warn)' : 'var(--good)';
export const signed = n => n > 0 ? `+${n}` : String(n);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const regionAvg = (cat, drivers) => Math.round(drivers.reduce((a, d) => a + cat.score(d), 0) / drivers.length);
export function tier(s) {
  if (s < 55) return {id: 'bad', label: '表現差'};
  if (s < 70) return {id: 'mid', label: '表現一般'};
  return {id: 'ok', label: '表現好'};
}
export function mix(cat, drivers) {
  const n = {bad: 0, mid: 0, ok: 0};
  for (const d of drivers) n[tier(cat.score(d)).id]++;
  return n;
}

export const CATS = [
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
      keep: '怠速訊號偏低，持續核對必要作業情境。',
      fix: '確認冷藏、PTO 與作業需求後，再減少非必要等待怠速。'},
     {ok: d.high_load_pct < 6, detail: `高引擎負載 ${d.high_load_pct}%`,
      keep: '引擎負載穩定，繼續保持。',
      fix: '避免長時間高負載，檢查載重與轉速。'},
   ]},
  {id: 'maintenance', name: '保養',
   score: d => clamp(100 - d.dtc_count * 4),
   facts: d => [{
     ok: d.dtc_count === 0,
     detail: `DTC ${d.dtc_count} 筆`,
     keep: '本期間未記錄 DTC，仍需依原廠規範保養。',
     fix: '有 DTC 紀錄，建議進廠讀碼檢修。',
   }]},
];

export function history(cat, region) {
  const months = window.HINO_EXCEL_DATA.months;
  const s = region.series;
  const cars = Math.max(1, (region.drivers || []).length);
  const raw = {
    safety: s.safety,
    // ponytail: monthly idle% only. high_load_pct is period-level; add when compiler emits monthly load%.
    efficiency: s.idle.map(v => clamp(100 - v * 1.2)),
    maintenance: s.dtc.map(v => clamp(100 - (v / cars) * 4)),
  }[cat.id];
  // ponytail: workbook has region monthly only. Drop empty months. Per-car monthly when the compiler emits it.
  return months.map((label, i) => ({label, v: raw[i]}))
    .filter((_, i) => region.recordsByMonth ? region.recordsByMonth[i] > 0 : s.safety[i] !== null);
}

export function allDrivers(data = window.HINO_EXCEL_DATA) {
  return data?.regions.flatMap(r => r.drivers) ?? [];
}

export function cmpByCat(cat, a, b) {
  const d = cat.score(b) - cat.score(a);
  return d !== 0 ? d : (a.c < b.c ? -1 : a.c > b.c ? 1 : 0);
}

export function fleetByCat(cat, drivers = allDrivers()) {
  return [...drivers].sort((a, b) => cmpByCat(cat, a, b));
}

export function rankOf(cat, car, drivers = allDrivers()) {
  const list = fleetByCat(cat, drivers);
  return { rank: list.findIndex(d => d.c === car) + 1, total: list.length };
}

export function monthRanks(cat, data = window.HINO_EXCEL_DATA) {
  const { regions, months } = data;
  const pts = regions.map(r => history(cat, r));
  return months.flatMap(label => {
    const rows = regions
      .map((r, i) => {
        const pt = pts[i].find(p => p.label === label);
        return pt ? { i, r, v: pt.v } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b.v - a.v) || (a.i - b.i))
      .map((row, n) => ({ id: row.r.id, name: row.r.name, v: row.v, rank: n + 1 }));
    return rows.length ? [{ label, ranks: rows }] : [];
  });
}

export function mvps(data = window.HINO_EXCEL_DATA) {
  const drivers = allDrivers(data);
  return CATS.map(cat => {
    const d = fleetByCat(cat, drivers)[0];
    return { id: cat.id, c: d.c, score: cat.score(d) };
  });
}

export function linesChart(series, simple) {
  const pts = series[0].pts;
  const narrow = window.innerWidth < 520;
  const W = 560, H = 160, pl = simple || narrow ? 26 : 36, pr = simple || narrow ? 12 : 18, pt = 10, pb = 22;
  const labels = window.HINO_EXCEL_DATA.months;
  const n = labels.length, x = label => pl + (W - pl - pr) * (labels.indexOf(label) / Math.max(1, n - 1));
  const y = v => pt + (H - pt - pb) * (1 - v / 100);
  const mid = Math.floor((n - 1) / 2);
  const grid = simple ? '' : [0, 50, 100].map(gv =>
    `<line x1="${pl}" y1="${y(gv)}" x2="${W - pr}" y2="${y(gv)}" stroke="#e4ebed"/><text x="${pl - 6}" y="${y(gv) + 4}" text-anchor="end">${gv}</text>`).join('');
  const goal = `<line x1="${pl}" y1="${y(70)}" x2="${W - pr}" y2="${y(70)}" stroke="#43a047" stroke-dasharray="5 4"/>` +
    (simple ? '' : `<text x="${W - pr + 2}" y="${y(70) + 4}" fill="#43a047">70</text>`);
  const axis = labels.map((label, i) => {
    if (!simple && narrow && i !== 0 && i !== n - 1 && i !== mid) return '';
    return `<text x="${x(label)}" y="${H - 6}" text-anchor="middle">${label}</text>`;
  }).join('');
  const lines = series.map(s => {
    const col = s.color || '#7bb42e';
    let last = -2;
    const commands = s.pts.map(p => {
      const index = labels.indexOf(p.label);
      const command = index === last + 1 ? 'L' : 'M';
      last = index;
      return `${command}${x(p.label)},${y(p.v)}`;
    }).join(' ');
    return `<path d="${commands}" fill="none" stroke="${col}" stroke-width="2.6"/>` + s.pts.map(p => `<circle cx="${x(p.label)}" cy="${y(p.v)}" r="2.4" fill="${col}"/>`).join('');
  }).join('');
  const col = series[0].color || '#7bb42e';
  const dots = simple || series.length > 1 ? '' : pts.map((p, i) => `<circle cx="${x(p.label)}" cy="${y(p.v)}" r="${i === n - 1 ? 4 : 2.4}" fill="${col}"/>`).join('');
  return `<svg class="lc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${goal}${axis}${lines}${dots}</svg>`;
}

export function lineChart(pts, simple, color) {
  return linesChart([{pts, color: color || '#7bb42e'}], simple);
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

(function () {
  const data = window.HINO_EXCEL_DATA;
  if (!data) return;
  const south = data.regions.find(r => r.id === 'KP');
  if (!south) return;
  const lastDtc = south.series.dtc.filter((_, i) => south.recordsByMonth ? south.recordsByMonth[i] > 0 : south.series.safety[i] !== null).at(-1);
  console.assert(
    history(CATS[2], south).at(-1).v === clamp(100 - (lastDtc / south.drivers.length) * 4),
    'maintenance history is per-car dtc not region sum'
  );
})();

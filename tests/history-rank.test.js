import test from 'node:test';
import assert from 'node:assert/strict';
global.window = {};
await import('../excel-derived-data.js');
const { CATS, clamp, fleetByCat, history, monthRanks, mvps, quarterRanks, rankOf } = await import('../src/pages/competition/score.js');
const data = window.HINO_EXCEL_DATA;

test('fleet rank is stable, ties by plate, total is all cars', () => {
  for (const cat of CATS) {
    assert.deepEqual(fleetByCat(cat).map(d => d.c), fleetByCat(cat).map(d => d.c));
  }
  const twins = [
    { c: 'ZZZ-9999', overspeed_pct: 10, idle_pct: 0, high_load_pct: 0, dtc_count: 0 },
    { c: 'AAA-0001', overspeed_pct: 10, idle_pct: 0, high_load_pct: 0, dtc_count: 0 },
  ];
  assert.deepEqual(fleetByCat(CATS[0], twins).map(d => d.c), ['AAA-0001', 'ZZZ-9999']);
  const safety52 = fleetByCat(CATS[0]).filter(d => CATS[0].score(d) === 52);
  assert.ok(safety52.length >= 2);
  assert.ok(safety52[0].c < safety52[1].c);
  assert.equal(rankOf(CATS[0], safety52[0].c).total, 20);
});

test('month ranks skip empty months and break ties by region order', () => {
  const safety = monthRanks(CATS[0]);
  assert.ok(!safety.some(m => m.label === '2月'));
  const aug = safety.find(m => m.label === '8月');
  assert.equal(aug.ranks.length, 1);
  assert.equal(aug.ranks[0].id, 'MI');
  const clone = structuredClone(data);
  const i = clone.months.indexOf('1月');
  clone.regions[0].series.safety[i] = 50;
  clone.regions[1].series.safety[i] = 50;
  clone.regions[0].recordsByMonth[i] = 1;
  clone.regions[1].recordsByMonth[i] = 1;
  const jan = monthRanks(CATS[0], clone).find(m => m.label === '1月');
  const earlier = jan.ranks.find(r => r.id === clone.regions[0].id);
  const later = jan.ranks.find(r => r.id === clone.regions[1].id);
  assert.ok(earlier.rank < later.rank);
});

test('MVP is first of each cat and scores stay 100 when clean', () => {
  const list = mvps();
  assert.equal(list.length, 3);
  assert.deepEqual(list.map(m => m.id), ['safety', 'efficiency', 'maintenance']);
  for (const row of list) {
    const cat = CATS.find(c => c.id === row.id);
    const top = fleetByCat(cat)[0];
    assert.equal(row.c, top.c);
    assert.equal(row.score, cat.score(top));
  }
  const z = { overspeed_pct: 0, idle_pct: 0, high_load_pct: 0, dtc_count: 0 };
  assert.ok(CATS.every(c => c.score(z) === 100));
  const kp = data.regions.find(r => r.id === 'KP');
  const lastDtc = kp.series.dtc.filter((_, i) => kp.recordsByMonth[i] > 0).at(-1);
  assert.equal(history(CATS[2], kp).at(-1).v, clamp(100 - (lastDtc / kp.drivers.length) * 4));
});

test('fleet history locks to lead_region cars and months', () => {
  const rid = data.accountBindings.lead_region;
  assert.equal(rid, data.accountBindings.lead_region);
  assert.notEqual(rid, 'MI');
  const region = data.regions.find(r => r.id === rid);
  const cars = [...region.drivers].sort((a, b) => (a.c < b.c ? -1 : a.c > b.c ? 1 : 0)).map(d => d.c);
  assert.deepEqual(cars, region.drivers.map(d => d.c).sort());
  assert.ok(!cars.includes('ABC-6776'));
  assert.ok(!cars.includes('ABC-7160'));
  const months = CATS.map(cat => monthRanks(cat));
  const labels = (months[0] || []).filter(m => m.ranks.some(row => row.id === rid)).map(m => m.label);
  assert.ok(!labels.includes('8月'));
  assert.ok(!labels.includes('2月'));
});

test('quarter ranks average recorded months, skip empty quarters, tie by region order', () => {
  for (const cat of CATS) assert.ok(quarterRanks(cat).length < monthRanks(cat).length);
  const clone = structuredClone(data);
  for (const m of ['4月', '5月', '6月']) {
    const i = clone.months.indexOf(m);
    for (const r of clone.regions) r.recordsByMonth[i] = 0;
  }
  const labels = quarterRanks(CATS[0], clone).map(q => q.label);
  assert.ok(!labels.includes('第2季'));
  assert.deepEqual(labels, ['第1季', '第3季', '第4季']);
  const maint = quarterRanks(CATS[2]).find(q => q.label === '第2季').ranks;
  assert.deepEqual(maint.slice(0, 2).map(r => [r.id, r.rank]), [['N', 1], ['MI', 2]]);
  const eff = quarterRanks(CATS[1]).find(q => q.label === '第4季').ranks;
  assert.equal(eff.find(r => r.id === 'CT').rank, 2);
  assert.equal(eff.find(r => r.id === 'YJ').rank, 3);
  const mi = quarterRanks(CATS[0]).find(q => q.label === '第3季').ranks.find(r => r.id === 'MI');
  assert.equal(mi.v, 52);
  assert.deepEqual(quarterRanks(CATS[2]), quarterRanks(CATS[2]));
});

test('quarter MVP is the top competition car per cat, ties by plate', () => {
  const cars = data.competition.teams.flatMap(t => t.drivers);
  const got = mvps({ regions: data.competition.teams });
  CATS.forEach((cat, i) => {
    const top = [...cars].sort((a, b) => (cat.score(b) - cat.score(a)) || a.c.localeCompare(b.c))[0];
    assert.deepEqual([got[i].c, got[i].score], [top.c, cat.score(top)]);
    assert.ok(cars.some(d => d.c === got[i].c));
  });
  assert.deepEqual(got.map(m => [m.c, m.score]), [['ABC-2037', 87], ['ABC-2713', 94], ['ABC-1655', 100]]);
});

test('fleet car tab: competition quarter cars ranked among all competition cars', () => {
  const comp = data.competition;
  assert.equal(+comp.id.split('Q')[1], 3);
  const all = comp.teams.flatMap(t => t.drivers);
  const n = comp.teams.find(t => t.id === data.accountBindings.lead_region).drivers.map(d => d.c).sort();
  assert.deepEqual(n.map(c => CATS.map(cat => {
    const d = all.find(x => x.c === c);
    return [cat.score(d), rankOf(cat, c, all).rank, rankOf(cat, c, all).total];
  })), [
    [[64, 14, 20], [81, 9, 20], [88, 16, 20]],
    [[53, 16, 20], [68, 12, 20], [100, 7, 20]],
  ]);
});

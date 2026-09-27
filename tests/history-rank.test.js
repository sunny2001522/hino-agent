import test from 'node:test';
import assert from 'node:assert/strict';
global.window = {};
await import('../excel-derived-data.js');
const { CATS, clamp, fleetByCat, history, monthRanks, mvps, rankOf } = await import('../src/pages/competition/score.js');
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

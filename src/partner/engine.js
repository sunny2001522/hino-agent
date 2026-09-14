// Deterministic analysis. Thresholds are demo triage settings, not validated risk models.
export const POLICY = Object.freeze({ minMileage: 500, idlePct: 15, speedPct: 10 });
const number = value => value !== null && value !== '' && Number.isFinite(Number(value));
export function scopedVehicles(data, session, driverCar) {
  const rows = data.regions.flatMap(r => r.drivers);
  if (session?.role === 'fleet') return rows;
  if (session?.role === 'lead') return rows.filter(v => v.region === session.acc.region);
  if (session?.role === 'driver') return rows.filter(v => v.c === driverCar);
  return [];
}
export function fuelBaseline(vehicles) {
  const month = vehicles.map(v => v.fuel_month).filter(Boolean).sort().at(-1);
  const eligible = vehicles.filter(v => v.fuel_month === month && number(v.mileage_km) && v.mileage_km >= POLICY.minMileage && number(v.fuel_liters) && v.fuel_liters > 0);
  const liters = eligible.reduce((sum, v) => sum + Number(v.fuel_liters), 0);
  const km = eligible.reduce((sum, v) => sum + Number(v.mileage_km), 0);
  return { month, eligible, excluded: vehicles.length - eligible.length, liters, km, per100: km > 0 ? liters / km * 100 : null };
}
export function opportunities(vehicles, period) {
  const cards = [];
  for (const v of vehicles) {
    if (number(v.idle_pct) && v.idle_pct >= POLICY.idlePct) cards.push({
      id: `${v.c}:idle`, car: v.c, kind: '節能', value: v.idle_pct, title: '先釐清可避免的等待怠速',
      evidence: `${period}｜怠速 ${v.idle_pct}%（${v.idle_count} 筆）；分母為行駛＋怠速紀錄，非時間佔比。`,
      source: 'carStatus → idle_count / (driving + idle_count)',
      why: '達到 Demo 怠速覆核門檻 15%。怠速是調查線索，不能直接換算耗油或認定駕駛浪費。',
      steps: ['駕駛：停妥後回報等待、裝卸、冷藏／PTO 作業等原因。', '調度：核對到場與卸貨時段，先試調整一個可避免的等待點。', '保修：確認車輛與作業允許後，再討論減少非必要怠速。'],
      metric: '比較相同作業條件的 L/100km，並補上可避免怠速分鐘；維持必要作業與安全。'
    });
    if (number(v.overspeed_pct) && v.overspeed_pct >= POLICY.speedPct) cards.push({
      id: `${v.c}:speed`, car: v.c, kind: '安全', value: v.overspeed_pct, title: '下一趟前，先做限速與派車覆核',
      evidence: `${period}｜超速 ${v.overspeed_pct}%（${v.overspeed_count} 筆）；分母為行駛紀錄，不是獨立事件數。`,
      source: 'max(gps.speed, can.canSpeed) > gps.speedLimit → overspeed_pct',
      why: '達到 Demo 超速覆核門檻 10%。這是歷史訊號排序，尚未訓練事故機率模型。',
      steps: ['調度：核對限速資料、路段與交付時窗，確認是否有趕工壓力。', '駕駛：出車前閱讀一項提醒，停妥後回報路況；行駛中不操作介面。', '管理者：合併重複紀錄為事件後再判讀，將誤報回填覆核。'],
      metric: '試點蒐集去重超速事件／1,000 km、提醒誤報率與回報完成率；不宣稱事故下降。'
    });
  }
  // Interleave safety and efficiency so volume in one category never hides the other.
  const groups = ['安全', '節能'].map(kind => cards.filter(c => c.kind === kind).sort((a,b) => b.value-a.value || a.car.localeCompare(b.car)));
  return Array.from({length: Math.max(...groups.map(g=>g.length), 0)}, (_, i) => groups.map(g=>g[i]).filter(Boolean)).flat();
}
export function estimateSavings(baseline, reduction, price) {
  if (baseline.per100 === null || !number(reduction) || reduction < 0 || reduction > 30 || !number(price) || price <= 0 || price > 200) return null;
  const liters = baseline.liters * Number(reduction) / 100;
  return { liters, money: liters * Number(price), target: baseline.per100 * (1-Number(reduction)/100) };
}
export function compareFuel(beforeLiters, beforeKm, afterLiters, afterKm) {
  if (![beforeLiters, beforeKm, afterLiters, afterKm].every(v=>number(v) && Number(v)>0)) return null;
  const before = Number(beforeLiters)/Number(beforeKm)*100;
  const after = Number(afterLiters)/Number(afterKm)*100;
  return { before, after, change: (before-after)/before*100, short: Math.min(beforeKm, afterKm)<POLICY.minMileage };
}
export function advanceCase(current, note, actor, time = new Date().toISOString()) {
  if (!note?.trim()) throw new Error('請填寫覆核或回報內容。');
  const states = ['review', 'doing', 'observe'];
  const index = states.indexOf(current.status);
  if (index < 0 || index === states.length-1) throw new Error('已進入待量測；補齊追蹤資料才能評估成效。');
  return {...current, status: states[index+1], history: [...current.history, {actor, note: note.trim().slice(0,1000), time}]};
}

import { readFileSync } from 'node:fs';
import { fuelBaseline, opportunities } from '../src/partner/engine.js';
const source = readFileSync(new URL('../excel-derived-data.js', import.meta.url), 'utf8');
const data = JSON.parse(source.slice(source.indexOf('window.HINO_EXCEL_DATA = ') + 'window.HINO_EXCEL_DATA = '.length).trim().replace(/;$/, ''));

// Demo roles are not authentication. The server owns all telemetry facts and
// only accepts a role, an existing region id, and an in-scope evidence id.
export function trustedContext(request = {}) {
  if (!['fleet','lead'].includes(request.role)) throw new Error('unsupported role');
  const region = data.regions.find(r=>r.id===request.regionId);
  if (request.role==='lead' && !region) throw new Error('unknown region');
  const regions = request.role==='lead' ? [region] : data.regions;
  const vehicles = regions.flatMap(r=>r.drivers);
  const baseline = fuelBaseline(vehicles);
  const evidence = opportunities(vehicles, data.meta.period);
  const selected = evidence.find(c=>c.id===request.selectedEvidenceId);
  return {
    role:request.role,name:request.role==='fleet'?'車隊管理 Demo':`${region.name}總負責人 Demo`,
    region:region?.name, regionId:region?.id,
    fuel:baseline.per100, idle:request.role==='lead'?region.idlePct:data.aggregate.idlePct,
    aggSafe:data.aggregate.safety.at(-1),safe:region?.safety.at(-1),anomaly:region?.anomaly,overload:region?.overload,
    drivers:vehicles.map(v=>({n:v.c,s:v.s,i:v.i})),
    regions:regions.map(r=>({name:r.name,safe:r.safety.at(-1),idlePct:r.idlePct,anomaly:r.anomaly})),
    fuelTop:baseline.eligible.slice().sort((a,b)=>b.fuel_per_100km-a.fuel_per_100km).slice(0,3).map(v=>({car:v.c,month:v.fuel_month,fuelPer100:v.fuel_per_100km,fuelLiters:v.fuel_liters,mileageKm:v.mileage_km,idlePct:v.idle_pct})),
    evidencePack:{source:data.meta.sourceFile,period:data.meta.period,mode:'historical-demo',
      baseline:{month:baseline.month,liters:baseline.liters,km:baseline.km,per100:baseline.per100,excluded:baseline.excluded},
      missingMonths:data.months.filter((_,i)=>!data.aggregate.recordsByMonth[i]),
      opportunities:selected?[selected]:evidence.slice(0,3),
      limitations:['車號非駕駛身分，區域為GPS展示分組','歷史紀錄不能推估當前風險或已實現效益','無對照組與事故標籤','怠速與超速是紀錄比例，沒有去重成事件','樣本門檻為500km，非統計顯著性保證']}
  };
}

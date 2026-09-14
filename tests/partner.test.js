import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedVehicles,fuelBaseline,opportunities,estimateSavings,compareFuel,advanceCase} from '../src/partner/engine.js';
global.window={};
await import('../excel-derived-data.js');
const data=window.HINO_EXCEL_DATA;
const rows=data.regions.flatMap(r=>r.drivers);
test('baseline weights liters and mileage and excludes missing and short samples',()=>{
 const b=fuelBaseline([{fuel_month:'2025-11',fuel_liters:100,mileage_km:1000},{fuel_month:'2025-11',fuel_liters:400,mileage_km:2000},{fuel_month:'2025-11',fuel_liters:200,mileage_km:100},{fuel_month:'2025-10',fuel_liters:900,mileage_km:900},{fuel_month:'2025-11',fuel_liters:null,mileage_km:1000}]);
 assert.equal(b.per100,500/3000*100);assert.equal(b.eligible.length,2);assert.equal(b.excluded,3);
 assert.equal(fuelBaseline([]).per100,null);
});
test('scope prevents other regions or vehicle cases from being shown',()=>{
 assert.equal(scopedVehicles(data,{role:'driver'},rows[0].c).length,1);
 assert.ok(scopedVehicles(data,{role:'lead',acc:{region:'N'}}).every(v=>v.region==='N'));
 assert.deepEqual(scopedVehicles(data,{role:'shipper'}),[]);
});
test('real evidence cards are traceable and interleave the two focus areas',()=>{
 const cards=opportunities(rows,data.meta.period);
 assert.equal(cards[0].kind,'安全');assert.equal(cards[1].kind,'節能');
 assert.ok(cards.length>0);assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
 for(const c of cards){const v=rows.find(v=>v.c===c.car);assert.ok(v);assert.equal(c.value,c.kind==='安全'?v.overspeed_pct:v.idle_pct);assert.ok(c.evidence.includes(data.meta.period));}
});
test('savings handles zero, invalid and missing input without fabricating money',()=>{
 const b=fuelBaseline(rows);assert.equal(estimateSavings(b,0,30).money,0);
 assert.ok(Math.abs(estimateSavings(b,3,30).liters-b.liters*.03)<1e-9);
 for(const r of [-1,31,'',NaN]) assert.equal(estimateSavings(b,r,30),null);
 assert.equal(estimateSavings(b,3,0),null);assert.equal(estimateSavings(fuelBaseline([]),3,30),null);
});
test('before-after normalizes distance and reports worsening and short samples',()=>{
 assert.equal(compareFuel(100,1000,180,2000).change,10);
 assert.equal(compareFuel(100,1000,220,2000).change,-10);
 assert.equal(compareFuel(10,100,10,110).short,true);
 assert.equal(compareFuel(100,0,10,100),null);
});
test('case requires notes, preserves audit history and cannot become verified',()=>{
 const initial={status:'review',history:[]};assert.throws(()=>advanceCase(initial,' ','driver'));
 const doing=advanceCase(initial,'已確認等待原因','調度','2026-09-14');
 assert.equal(initial.history.length,0);assert.equal(doing.status,'doing');
 const observe=advanceCase(doing,'已調整到場時段，待追蹤','駕駛','2026-09-15');
 assert.equal(observe.status,'observe');assert.equal(observe.history.length,2);
 assert.throws(()=>advanceCase(observe,'直接結案','主管'));
});

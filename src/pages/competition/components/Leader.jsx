import { useEffect, useRef, useState } from 'react';
import { CATS, history, lineChart, regionAvg, tier, mix, tint, signed, clamp } from '../score.js';
import CatTabs from './CatTabs.jsx';
import StatusFacts from './StatusFacts.jsx';

const data = typeof window !== 'undefined' ? window.HINO_EXCEL_DATA : null;

function counts(cat, d) {
  if (cat.id === 'safety') return `超速 ${d.overspeed_count} 筆`;
  if (cat.id === 'efficiency') return `怠速 ${d.idle_count} 筆 · 高負載 ${d.high_load_count} 筆`;
  return `DTC ${d.dtc_count} 筆`;
}

function scored(cat, region) {
  const order = { bad: 0, mid: 1, ok: 2 };
  return region.drivers.map(d => {
    const s = cat.score(d);
    return { d, s, t: tier(s), facts: cat.facts(d) };
  }).sort((a, b) => order[a.t.id] - order[b.t.id] || a.s - b.s);
}

function rankOf(cat, car, region) {
  const list = [...region.drivers].sort((a, b) => cat.score(b) - cat.score(a));
  return { rank: list.findIndex(d => d.c === car) + 1, total: list.length };
}

const WATCH = {
  first: { id: 'first', label: '低量訊號待覆核', how: '留意' },
  rare: { id: 'rare', label: '中量訊號待覆核', how: '跟進' },
  habit: { id: 'habit', label: '高量訊號待覆核', how: '優先' },
};

function watch(cat, d) {
  const fail = cat.facts(d).filter(f => !f.ok);
  if (!fail.length) return null;
  const s = cat.score(d);
  if (s < 55) return WATCH.habit;
  if (cat.id === 'maintenance') {
    if (d.dtc_count <= 1) return WATCH.first;
    if (d.dtc_count <= 5) return WATCH.rare;
    return WATCH.habit;
  }
  // ponytail: no per-car monthly. Intensity from period pct/count; real first-vs-habit when compiler emits monthly.
  if (cat.id === 'safety') {
    const per = d.overspeed_count / Math.max(1, d.journeys);
    if (d.overspeed_pct >= 15 || per >= 30) return WATCH.habit;
    if (d.overspeed_pct < 10 && per < 10) return WATCH.first;
    return WATCH.rare;
  }
  if (d.idle_pct >= 15 || d.high_load_pct >= 12) return WATCH.habit;
  if (d.idle_pct < 10 && d.high_load_pct < 8) return WATCH.first;
  return WATCH.rare;
}

function dispatch(fail) {
  return fail.map(f =>
    f.detail.startsWith('DTC') ? '先排進廠，這幾天別塞滿班' :
    f.detail.startsWith('怠速') ? '少派要等、要塞的市區件' :
    f.detail.startsWith('高引擎') ? '核對載重與坡段' :
    f.detail.startsWith('超速率') ? '少派測速密的路段' : ''
  ).filter(Boolean).join('；');
}

function focusList(cat, region) {
  const order = { habit: 0, rare: 1, first: 2 };
  return region.drivers.map(d => {
    const w = watch(cat, d);
    if (!w) return null;
    const fail = cat.facts(d).filter(f => !f.ok);
    return { d, s: cat.score(d), w, fail, fix: fail[0]?.fix, send: dispatch(fail) };
  }).filter(Boolean).sort((a, b) => order[a.w.id] - order[b.w.id] || a.s - b.s);
}

/** assert helpers — same shape as leader/main.js string builders */
function cardsHtml(cat, region) {
  return scored(cat, region).map(({ d }) => d.c).join(' ');
}

function briefHtml(cat, region) {
  const list = focusList(cat, region).slice(0, 3);
  if (!list.length) return 'AI 重點';
  return 'AI 重點 ' + list.map(x => x.d.c).join(' ');
}

export default function Leader() {
  const leadId = data?.accountBindings?.lead_region;
  const [regionId, setRegionId] = useState(leadId || null);
  const [catId, setCatId] = useState('safety');
  const [openCar, setOpenCar] = useState(null);
  const [drawerCat, setDrawerCat] = useState('safety');
  const [, setTick] = useState(0);
  const drawerRef = useRef(null);

  const myRegion = data?.regions?.find(r => r.id === regionId) || null;

  useEffect(() => {
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setTick(n => n + 1), 120);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    if (openCar) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [openCar]);

  if (!myRegion) return <p className="period">無法載入本區資料</p>;

  const cat = CATS.find(c => c.id === catId);
  const avg = regionAvg(cat, myRegion.drivers);
  const n = mix(cat, myRegion.drivers);
  const hist = history(cat, myRegion);
  const mom = hist.at(-1).v - hist.at(-2).v;
  const pts = hist.slice(-2).map((p, i, a) => ({ label: i === a.length - 1 ? '本期' : '上期', v: p.v }));
  const asOf = myRegion.drivers.reduce((m, d) => d.last_time > m ? d.last_time : m, data.meta.lastRecord).slice(0, 10);
  const cards = scored(cat, myRegion);
  const focus = focusList(cat, myRegion).slice(0, 3);
  const tabItems = CATS.map(c => {
    const a = regionAvg(c, myRegion.drivers);
    const m = mix(c, myRegion.drivers);
    return { id: c.id, name: c.name, score: a, color: tint(a), sub: `差 ${m.bad} · 一般 ${m.mid} · 好 ${m.ok}` };
  });

  function switchRegion(id) {
    if (id === regionId) return;
    setRegionId(id);
    setOpenCar(null);
  }

  function openDrawer(car) {
    setDrawerCat(catId);
    setOpenCar(car);
  }

  const drawerDriver = openCar ? myRegion.drivers.find(x => x.c === openCar) : null;
  const dCat = CATS.find(c => c.id === drawerCat);
  let drawerBody = null;
  let drawerTabs = null;
  if (drawerDriver && dCat) {
    const score = dCat.score(drawerDriver);
    const { rank, total } = rankOf(dCat, drawerDriver.c, myRegion);
    const dAvg = regionAvg(dCat, myRegion.drivers);
    const region = data.regions.find(r => r.id === drawerDriver.region);
    const dPts = history(dCat, region);
    const dAsOf = (drawerDriver.last_time || data.meta.lastRecord).slice(0, 10);
    const t = tier(score);
    const w = watch(dCat, drawerDriver);
    const send = dispatch(dCat.facts(drawerDriver).filter(f => !f.ok));
    drawerTabs = CATS.map(c => {
      const s = c.score(drawerDriver);
      const rk = rankOf(c, drawerDriver.c, myRegion);
      return { id: c.id, name: c.name, score: s, color: tint(s), sub: `第 ${rk.rank} / ${rk.total}` };
    });
    drawerBody = (
      <>
        <p className="period">{data.meta.period} · 資料截至 {dAsOf}</p>
        {w ? <p className={`how ${w.id}`}>{w.label} · 關注強度 {w.how}</p> : null}
        <div className="score-row">
          <div className="score-card">
            <div className="k">總分</div>
            <div className="v" style={{ color: tint(score) }}>{score}</div>
            <div className="s">{dCat.name}分數 · {t.label}</div>
          </div>
          <div className="score-card">
            <div className="k">排名</div>
            <div className="v">{rank}</div>
            <div className="s">/ {total} · 平均 {dAvg}</div>
          </div>
        </div>
        <div className="chartcard">
          <div className="ch-h">
            <span className="ttl">{region.name}月趨勢</span>
            <span className="sub">虛線綠燈 70</span>
          </div>
          <div dangerouslySetInnerHTML={{ __html: lineChart(dPts) }} />
        </div>
        <div className="status">
          <h3>目前狀況</h3>
          <div className="status-body">
            <StatusFacts facts={dCat.facts(drawerDriver)} />
          </div>
        </div>
        {send ? <p className="drv-st">派車建議：{send}</p> : null}
        <p className="drv-st">{drawerDriver.i} · {drawerDriver.journeys} 趟</p>
      </>
    );
  }

  return (
    <>
      <section className="dash-top">
        <p className="period">
          {data.meta.period} · 資料截至 {asOf} · {myRegion.name} {myRegion.drivers.length} 台
          {' · '}
          {data.regions.map(r => (
            <button
              key={r.id}
              type="button"
              className={r.id === regionId ? 'car' : undefined}
              style={{
                font: 'inherit', fontWeight: r.id === regionId ? 800 : 600,
                color: r.id === regionId ? 'var(--teal)' : 'var(--mut)',
                background: 'none', border: 0, padding: '0 4px', cursor: 'pointer',
                textDecoration: r.id === regionId ? 'underline' : 'none',
              }}
              onClick={() => switchRegion(r.id)}
            >
              {r.name}
            </button>
          ))}
        </p>
        <p className="period">歷史車號指標 Demo，非官方駕駛成績；區域為 GPS 展示分組，缺測月份不參與比較。</p>
        <div className="score-row">
          <div className="score-card">
            <div className="k">本區平均</div>
            <div className="v" style={{ color: tint(avg) }}>{avg}</div>
            <div className="s">{cat.name} · {myRegion.drivers.length} 台平均</div>
            <div className={`s ${mom > 0 ? 'up' : mom < 0 ? 'down' : ''}`}>
              較前次有資料月份 {signed(mom)}
            </div>
          </div>
          <div className="score-card">
            <div className="k">表現一般</div>
            <div className="v">{n.mid}</div>
            <div className="s">差 {n.bad} · 好 {n.ok}</div>
          </div>
          <div className="chartcard">
            <div className="ch-h">
              <span className="ttl">{myRegion.name}</span>
              <span className="sub">及格線 70</span>
            </div>
            <div className="chart" dangerouslySetInnerHTML={{ __html: lineChart(pts, true) }} />
          </div>
        </div>
        <aside className="ai-brief">
          <div className="ai-k">AI 重點</div>
          {!focus.length ? (
            <p>這一類沒有需關注的車。</p>
          ) : focus.map((x, i) => {
            const situ = x.fail.map(f => f.detail).join(' · ');
            const say = i === 0 && x.fix ? `跟他說：${x.fix}` : '';
            const send = x.send ? `派車：${x.send}` : '';
            return (
              <p key={x.d.c}>
                {i === 0 ? '先找' : '其次'}{' '}
                <button type="button" className="car" onClick={() => openDrawer(x.d.c)}>{x.d.c}</button>
                {' '}
                <span className={`how ${x.w.id}`}>{x.w.label} · {x.w.how}</span>
                {' '}{situ}{say ? `。${say}` : ''}{send ? `。${send}` : ''}
              </p>
            );
          })}
        </aside>
        <div className="drv-grid">
          {cards.map(({ d, s, t, facts }) => {
            const fail = facts.filter(f => !f.ok);
            const situ = (fail.length ? fail : facts).map(f => f.detail).join(' · ');
            const extra = t.id === 'ok' ? '' : counts(cat, d);
            const w = watch(cat, d);
            return (
              <article
                key={d.c}
                className={`drv ${t.id}${openCar === d.c ? ' on' : ''}`}
                style={{ borderLeftColor: tint(s) }}
                onClick={() => openDrawer(d.c)}
              >
                <div className="drv-top">
                  <b>{d.c}</b>
                  <span className="drv-tag">{t.label}</span>
                  {w ? <span className={`drv-tag ${w.id}`}>{w.label}</span> : null}
                </div>
                <p className="drv-st">{situ}{extra ? ` · ${extra}` : ''}</p>
                <span className="drv-s" style={{ color: tint(s) }}>{s}</span>
              </article>
            );
          })}
        </div>
      </section>
      <CatTabs catId={catId} onChange={setCatId} items={tabItems} />
      <dialog
        className="drawer"
        ref={drawerRef}
        onClose={() => setOpenCar(null)}
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left) e.currentTarget.close();
        }}
      >
        <div className="drawer-hd">
          <strong>{openCar || ''}</strong>
          <button type="button" className="ai-x" onClick={() => drawerRef.current?.close()}>關閉</button>
        </div>
        <div className="drawer-body">{drawerBody}</div>
        {drawerTabs ? <CatTabs catId={drawerCat} onChange={setDrawerCat} items={drawerTabs} /> : null}
      </dialog>
    </>
  );
}

(function () {
  if (!data) return;
  const home = data.regions.find(r => r.id === data.accountBindings.lead_region);
  if (!home) return;
  console.assert(home.id === data.accountBindings.lead_region, 'leader is one region');
  console.assert(home.drivers.every(d => d.region === home.id), 'only this region');
  const html = cardsHtml(CATS[0], home);
  console.assert(home.drivers.every(d => html.includes(d.c)), 'every region car on a card');
  const outsider = data.regions.flatMap(r => r.drivers).find(d => d.region !== home.id);
  console.assert(!outsider || !html.includes(outsider.c), 'other regions stay off the board');
  const other = data.regions.find(r => r.id !== home.id);
  const switched = cardsHtml(CATS[0], other);
  console.assert(other.drivers.every(d => switched.includes(d.c)), 'switch shows that region');
  console.assert(!switched.includes(home.drivers[0].c), 'old region cars gone');
  const a = home.drivers[0];
  console.assert(CATS[0].score(a) === clamp(100 - a.overspeed_pct * 2), 'excel formula');
  console.assert(watch(CATS[2], { dtc_count: 0, overspeed_pct: 0, idle_pct: 0, high_load_pct: 0 }) === null, 'clean car is not a watch');
  console.assert(watch(CATS[2], { dtc_count: 1, overspeed_pct: 0, idle_pct: 0, high_load_pct: 0 }).id === 'first', 'dtc 1 is first');
  console.assert(watch(CATS[2], { dtc_count: 20, overspeed_pct: 0, idle_pct: 0, high_load_pct: 0 }).id === 'habit', 'dtc 20 is habit');
  const brief = briefHtml(CATS[0], home);
  console.assert(brief.includes('AI 重點') && /ABC-/.test(brief), 'brief names a car');
  console.assert(dispatch(CATS[2].facts({ dtc_count: 3 }).filter(f => !f.ok)).includes('進廠'), 'dtc suggests workshop');
  console.assert(dispatch(CATS[1].facts({ idle_pct: 20, high_load_pct: 0, overspeed_pct: 0, dtc_count: 0 }).filter(f => !f.ok)).includes('市區'), 'idle suggests skip city waits');
})();

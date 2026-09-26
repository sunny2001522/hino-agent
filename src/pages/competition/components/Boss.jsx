import { useEffect, useState } from "react";
import {
  CATS,
  history,
  linesChart,
  regionAvg,
  tier,
  mix,
  tint,
  signed,
} from "../score.js";
import CatTabs from "./CatTabs.jsx";

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const data = typeof window !== "undefined" ? window.HINO_EXCEL_DATA : null;
const fleet =
  data &&
  (() => {
    const m = (key) => data.metrics.find((x) => x.key === key).data;
    return {
      name: "全隊",
      drivers: data.regions.flatMap((r) => r.drivers),
      series: {
        safety: data.aggregate.safety,
        idle: m("idle"),
        dtc: m("dtc"),
        speed: m("speed"),
      },
    };
  })();

function regionStats(cat) {
  return data.regions.map((r) => {
    const s = regionAvg(cat, r.drivers);
    return { r, s, t: tier(s), n: mix(cat, r.drivers) };
  });
}

function scoredRegions(cat) {
  return regionStats(cat)
    .slice()
    .sort((a, b) => a.s - b.s);
}

function anomalyN(cat, drivers) {
  // ponytail: pie follows the tab. All-types sum if a single unchanging company pie is needed.
  if (cat.id === "safety")
    return drivers.reduce((a, d) => a + d.overspeed_count, 0);
  if (cat.id === "efficiency")
    return drivers.reduce((a, d) => a + d.idle_count + d.high_load_count, 0);
  return drivers.reduce((a, d) => a + d.dtc_count, 0);
}

function anomalyLabel(cat) {
  return { safety: "超速", efficiency: "怠速＋高負載", maintenance: "DTC" }[
    cat.id
  ];
}

function pieChart(slices) {
  const total = slices.reduce((a, s) => a + s.n, 0);
  const R = 42,
    CX = 50,
    CY = 50;
  let a0 = -Math.PI / 2;
  const paths = slices
    .map((s) => {
      if (!total || !s.n) return "";
      const frac = s.n / total;
      if (frac >= 1)
        return `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${s.color}"/>`;
      const a1 = a0 + frac * 2 * Math.PI;
      const large = frac > 0.5 ? 1 : 0;
      const x0 = CX + R * Math.cos(a0),
        y0 = CY + R * Math.sin(a0);
      const x1 = CX + R * Math.cos(a1),
        y1 = CY + R * Math.sin(a1);
      a0 = a1;
      return `<path d="M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z" fill="${s.color}"/>`;
    })
    .join("");
  const legend = slices
    .map((s) => {
      const pct = total ? Math.round((s.n / total) * 100) : 0;
      const per = Math.round(s.n / Math.max(1, s.cars));
      return `<div><i style="background:${s.color}"></i>${esc(s.name)} ${s.n.toLocaleString()}（${pct}%）每台 ${per.toLocaleString()}</div>`;
    })
    .join("");
  return `<div class="pie-wrap"><div class="pie-fit"><svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${paths}</svg></div><div class="pie-leg">${legend}</div></div>`;
}

function regionSeries(cat) {
  return data.regions.map((r) => ({
    pts: history(cat, r),
    color: r.color,
    name: r.name,
  }));
}

function legendHtml(cat) {
  return (
    '<div class="chart-leg">' +
    regionStats(cat)
      .map(
        ({ r, s, n }) =>
          `<span><i style="background:${r.color}"></i>${esc(r.name)} ${r.drivers.length} 台 ${s}分 · 差 ${n.bad} · 一般 ${n.mid} · 好 ${n.ok}</span>`,
      )
      .join("") +
    "</div>"
  );
}

function chartHtml(cat) {
  return linesChart(regionSeries(cat));
}

export default function Boss() {
  const [catId, setCatId] = useState("safety");
  const [, setTick] = useState(0);

  useEffect(() => {
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setTick((n) => n + 1), 120);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (!fleet) return <p className="period">無法載入全隊資料</p>;

  const cat = CATS.find((c) => c.id === catId);
  const avg = regionAvg(cat, fleet.drivers);
  const weak = scoredRegions(cat)[0];
  const hist = history(cat, fleet);
  const mom = hist.at(-1).v - hist.at(-2).v;
  const slices = data.regions.map((r) => ({
    name: r.name,
    color: r.color,
    n: anomalyN(cat, r.drivers),
    cars: r.drivers.length,
  }));
  const hot = slices.reduce((a, s) => (s.n / s.cars > a.n / a.cars ? s : a));
  const asOf = fleet.drivers
    .reduce((m, d) => (d.last_time > m ? d.last_time : m), data.meta.lastRecord)
    .slice(0, 10);
  const tabItems = CATS.map((c) => {
    const a = regionAvg(c, fleet.drivers);
    const w = scoredRegions(c)[0];
    return {
      id: c.id,
      name: c.name,
      score: a,
      color: tint(a),
      sub: `最弱 ${w.r.name}`,
    };
  });

  return (
    <>
      <section className="dash-top">
        <p className="period">
          {data.meta.period} · 資料截至 {asOf} · Excel {fleet.drivers.length} 台
        </p>
        <p className="period">
          歷史車號指標 Demo，非官方駕駛成績；區域為 GPS
          展示分組，缺測月份不參與比較。
        </p>
        <div className="score-row">
          <div className="score-card">
            <div className="k">全隊平均</div>
            <div className="v" style={{ color: tint(avg) }}>
              {avg}
            </div>
            <div className="s">
              {cat.name} · {fleet.drivers.length} 台平均
            </div>
            <div className={`s ${mom > 0 ? "up" : mom < 0 ? "down" : ""}`}>
              較前次有資料月份 {signed(mom)}
            </div>
          </div>
          <div className="score-card">
            <div className="k">最弱區</div>
            <div className="v" style={{ color: tint(weak.s) }}>
              {weak.r.name}
            </div>
            <div className="s">{weak.s} 分</div>
          </div>
        </div>
        <div className="mid-row">
          <div className="chartcard pie-chart">
            <div className="ch-h">
              <span className="ttl">{anomalyLabel(cat)}次數</span>
              <span className="sub">每台最高 {hot.name}</span>
            </div>
            <div
              className="pie"
              dangerouslySetInnerHTML={{ __html: pieChart(slices) }}
            />
          </div>
          <div className="chartcard region-chart">
            <div className="ch-h">
              <span className="ttl">各區月趨勢</span>
            </div>
            <div
              className="regions"
              dangerouslySetInnerHTML={{ __html: chartHtml(cat) }}
            />
            <div dangerouslySetInnerHTML={{ __html: legendHtml(cat) }} />
          </div>
        </div>
      </section>
      <CatTabs catId={catId} onChange={setCatId} items={tabItems} />
    </>
  );
}

(function () {
  if (!fleet) return;
  console.assert(data.regions.length === 6, "six regions");
  console.assert(
    data.regions.map((r) => r.id).join() === "N,TH,MI,CT,YJ,KP",
    "region ids",
  );
  console.assert(fleet.drivers.length === 20, "excel fleet is 20");
  const safety = scoredRegions(CATS[0]);
  console.assert(
    safety[0].r.name === "苗中區" && safety[0].s === 60,
    "safety weakest is 苗中區 60",
  );
  console.assert(
    scoredRegions(CATS[1])[0].r.name === "苗中區",
    "efficiency weakest is 苗中區",
  );
  console.assert(
    scoredRegions(CATS[2])[0].r.name === "高屏區",
    "maintenance weakest is 高屏區",
  );
  const html = chartHtml(CATS[0]);
  console.assert(!html.includes("polyline"), "lines are paths");
  console.assert(
    (html.match(/<path d="/g) || []).length === data.regions.length,
    "one line per region",
  );
  const kpM = regionStats(CATS[2]).find((x) => x.r.id === "KP");
  console.assert(
    kpM.n.bad === 1 && kpM.n.mid === 0 && kpM.n.ok === 0,
    "KP maintenance mix",
  );
  const northS = regionStats(CATS[0]).find((x) => x.r.id === "N");
  console.assert(
    northS.s === 61 && northS.r.drivers.length === 2,
    "north safety 2 cars 61",
  );
  const leg = legendHtml(CATS[0]);
  console.assert(
    leg.includes("2 台") && leg.includes("61分") && /差 \d/.test(leg),
    "legend has n, score, mix",
  );
  const months = data.months;
  console.assert(months.length === 11, "full month axis");
  console.assert(
    regionSeries(CATS[0]).every((s) =>
      s.pts.every((p) => months.includes(p.label)),
    ),
    "shared months",
  );
  console.assert(
    months.every((m) => html.includes(">" + m + "<")),
    "axis labels are months",
  );
  console.assert(!/ABC-/.test(html), "no car numbers");
  const n = data.regions.map((r) => anomalyN(CATS[0], r.drivers));
  console.assert(n[0] === 7675 + 3554, "north overspeed count");
  const pie = pieChart(
    data.regions.map((r) => ({
      name: r.name,
      color: r.color,
      n: anomalyN(CATS[0], r.drivers),
      cars: r.drivers.length,
    })),
  );
  console.assert(
    pie.includes("path") && pie.includes("每台"),
    "pie has slices and per-car",
  );
  console.assert(
    !document.getElementById("aiBrief") && !document.getElementById("drawer"),
    "no ai or drawer",
  );
})();

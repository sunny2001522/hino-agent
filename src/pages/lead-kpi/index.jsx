export default function LeadKpi() {
  const r = window.myRegion();
  const sc = r.safety.at(-1);
  const ac = r.anomaly >= 8 ? 'var(--bad)' : r.anomaly >= 5 ? 'var(--warn)' : 'var(--good)';
  const aggSafety = window.HINO_EXCEL_DATA.aggregate.safety;
  const ordersByRegion = window.HINO_EXCEL_DATA.ordersByRegion;
  const onTime = r.onTime == null ? '未提供' : `${r.onTime}%`;
  return (
    <div className="screen" data-react>
      <section>
        <div className="sh"><h2>{r.name} · 本區 KPI</h2></div>
        <div className="subt">負責人 {r.lead}（只看 {r.name}，看不到其他區）</div>
        <div className="kpis">
          <div className="kpi"><div className="k">本區安全分</div><div className="v" style={{ color: window.scoreColor(sc) }}>{sc}</div><div className="s">全隊平均 {aggSafety.at(-1)}</div></div>
          <div className="kpi"><div className="k">異常率</div><div className="v" style={{ color: ac }}>{r.anomaly}%</div><div className="s">越低越好</div></div>
          <div className="kpi"><div className="k">準時率</div><div className="v" style={{ color: r.onTime == null ? 'var(--mut)' : r.onTime >= 95 ? 'var(--good)' : 'var(--warn)' }}>{onTime}</div><div className="s">來源未提供</div></div>
          <div className="kpi"><div className="k">人均單量</div><div className="v">{Math.round(ordersByRegion[r.id]/r.drivers.length)}</div><div className="s">{r.drivers.length} 位駕駛</div></div>
        </div>
      </section>
      <section>
        <div className="sh"><h2 className="sm">本區狀態</h2></div>
        <div className="card">
          <div style={{ fontSize: 13, lineHeight: 1.9 }}>
            <div>怠速佔比：<b style={{ color: r.idlePct >= 14 ? 'var(--bad)' : r.idlePct >= 10 ? 'var(--warn)' : 'var(--good)' }}>{r.idlePct}%</b>（目標 ≤8%）</div>
            <div>高引擎負載遙測：<b>{r.overload}</b>次</div>
            <div>百公里油耗：<b>{r.fuel} L</b></div>
          </div>
        </div>
      </section>
      <div className="foot">總負責人視角 · 僅限 {r.name}</div>
    </div>
  );
}

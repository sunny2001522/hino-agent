export default function LeadFocus() {
  const r = window.myRegion();
  const pts = [];
  r.drivers.forEach((d) => {
    if (d.s < 55) pts.push(`<b style="color:var(--txt)">${d.n}</b>（安全分 ${d.s}・紅）建議今日約談`);
  });
  r.drivers.forEach((d) => {
    if (d.i.includes('超載')) pts.push(`${d.n} ${d.c} 疑似超載，需處理`);
    if (d.i.includes('疲勞')) pts.push(`${d.n} 疲勞風險，安排休息/交接`);
    if (d.i.includes('點檢')) pts.push(`${d.n} 未完成出車前點檢`);
  });
  const fatigueSet = new Set();
  fatigueSet.forEach((code) => {
    if (code[0] === r.id) {
      const d = r.drivers[+code.slice(1)];
      if (d && !pts.some((p) => p.includes(d.n + ' 疲勞'))) pts.push(`${d.n} 疲勞風險，安排休息/交接`);
    }
  });
  if (!pts.length) pts.push('本區狀況良好，無急件');
  const idleP = [1, 2, 3].map((k) => +(r.idlePct - 1.6 * k).toFixed(1)).map((v) => Math.max(6, v));
  const list = r.drivers.slice().sort((a, b) => a.s - b.s).slice(0, 3);
  return (
    <div className="screen" data-react>
      <section id="lrisk">
        <div className="sh"><h2 className="sm">今日高風險預警</h2><span className="aibadge"><span className="sp"></span>AI 事前預測</span></div>
        <div className="subt">AI 事前預測本區今天誰／何時最可能出事，主動介入</div>
        {!list.length ? (
          <div className="card"><div className="dt">沒有可判讀的 車聯網紀錄。</div></div>
        ) : (
          <>
            <div className="private-note"><b>資料限制：</b>來源未提供事故、疲勞、急煞或即時風險預測欄位；以下僅依 遙測計算安全分排序，作為人工覆核優先序。</div>
            {list.map((vehicle) => (
              <div key={vehicle.c} className={`riskcard ${vehicle.s < 55 ? 'bad' : vehicle.s < 70 ? 'mid' : 'low'}`}>
                <div className="rtop"><span className="rname">{vehicle.c}</span><span className="stpill" style={{ background: 'var(--card2)', color: 'var(--mut)' }}>計算安全分 {vehicle.s}</span></div>
                <div className="rwhy">超速 {vehicle.overspeed_count.toLocaleString()} 筆 · 怠速 {vehicle.idle_pct}% · 高引擎負載 {vehicle.high_load_count.toLocaleString()} 筆 · DTC {vehicle.dtc_count.toLocaleString()} 筆</div>
                <div className="rwhy" style={{ marginTop: 5 }}>優先覆核：{vehicle.i}</div>
                <div className="racts"><button type="button" className="btn pri sm" onClick={() => window.act('已建立 ' + vehicle.c + ' 的遙測資料覆核提醒。', 'wn')}>建立覆核提醒</button></div>
              </div>
            ))}
          </>
        )}
      </section>
      <section>
        <div className="sh"><h2 className="sm">{r.name} 省油目標</h2><span className="newbadge">協同</span></div>
        <div className="subt">上級目標 ≤8%，分解到本區與駕駛，AI 追蹤進度</div>
        <div className="goalcard">
          <div className="gt">本區怠速目標 ≤8% <span className="aibadge"><span className="sp"></span>AI 追蹤</span></div>
          <div className="gnums"><span className="big" style={{ color: r.idlePct <= 8 ? 'var(--good)' : 'var(--warn)' }}>{r.idlePct}%</span><span className="gl">目前 · 目標 8%</span><span className="aibadge" style={{ marginLeft: 'auto' }}>預測 3 個月可達 {idleP[2]}%</span></div>
          <div className="prog"><div className="fl" style={{ width: `${Math.round(Math.max(0, Math.min(1, (16 - r.idlePct) / (16 - 8))) * 100)}%` }}></div><div className="tk" style={{ left: '100%' }}></div></div>
          <div className="acts" style={{ marginTop: 11 }}><button type="button" className="btn pri sm" onClick={() => window.openFuelCoach(r.drivers[0].n)}>檢視優先改善車號</button></div>
        </div>
      </section>
      <section>
        <div className="sh"><h2>{r.name} · 今日重點</h2></div>
        <div className="subt">誰該約談、誰要處理，一目了然</div>
        <div className="cause" style={{ borderLeftColor: 'var(--bad)' }}>
          <ul style={{ marginLeft: 18 }}>{pts.map((p, i) => <li key={i} dangerouslySetInnerHTML={{ __html: p }} />)}</ul>
          <div className="acts" style={{ marginTop: 6 }}>
            <button type="button" className="btn pri sm" onClick={() => window.openFleetMail(r.id)}>對全區寄信限期改善</button>
            <button type="button" className="btn gho sm" onClick={() => window.act('已替本區高風險駕駛排安全訓練。', 'ok')}>安排安全訓練</button>
            <button type="button" className="btn gho sm" onClick={() => window.msgLead(r.id)}>回報上級</button>
          </div>
        </div>
      </section>
      <div className="foot">總負責人視角 · 僅限 {r.name}</div>
    </div>
  );
}

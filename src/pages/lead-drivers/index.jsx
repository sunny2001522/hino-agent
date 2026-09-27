import { useState } from 'react';

export default function LeadDrivers() {
  const r = window.myRegion();
  const fatigueSet = new Set();
  const [notify, setNotify] = useState({});
  return (
    <div className="screen" data-react>
      <section>
        <div className="sh"><h2>{r.name} · 我的駕駛</h2></div>
        <div className="subt">紅黃綠 · 已通知次數 · 可直接通知／語音／派交接</div>
        <div>
          {r.drivers.map((d, i) => {
            const [lv, col] = window.lvl(d.s);
            const n = notify[r.id + '_' + i] || 0;
            const nc = n >= 2 ? 'var(--bad)' : n === 1 ? 'var(--warn)' : 'var(--mut2)';
            const fat = fatigueSet.has(r.id + i);
            return (
              <div className="drvline" key={i}>
                <div className="who"><span className="dot" style={{ background: col }}></span><b>{d.n}</b>
                  <span className="lvpill" style={{ color: col, borderColor: col, marginLeft: 'auto' }}>{lv} {d.s}</span></div>
                <div className="mt2">{d.c} · {d.i}{fat ? ' · 疲勞' : ''}</div>
                <div className="row2"><span className="ntag" style={{ color: nc }}>已通知 {n} 次</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className={`btn ${n >= 2 ? 'dng' : 'gho'} sm`} onClick={() => {
                      const name = d.n;
                      const next = n + 1;
                      setNotify((prev) => ({ ...prev, [r.id + '_' + i]: next }));
                      window.toast('已通知駕駛', `已通知 ${name}（第 ${next} 次）。` + (next >= 2 ? ' 已達 2 次，建議約談。' : ''), next >= 2 ? 'dn' : 'wn');
                    }}>{n >= 2 ? '約談' : '通知'}</button>
                    <button type="button" className="btn gho sm" onClick={() => window.voiceCall(d.n, 'voice')}>語音</button>
                    {fat ? <button type="button" className="btn warnb sm" onClick={() => window.openHandover()}>派交接</button> : null}
                  </span></div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="foot">總負責人視角 · 僅限 {r.name}</div>
    </div>
  );
}

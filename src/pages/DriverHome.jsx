import { useEffect, useState } from 'react';

export default function DriverHome() {
  const { d } = window.myDriver();
  const event = window.primaryDriverEvent(d);
  const [acknowledged, setAcknowledged] = useState(() => window.driverAcknowledgements?.[d.c] || '');
  const [weekId, setWeekId] = useState(() => window.HINO_EXCEL_DATA?.weekly?.currentId ?? null);

  const weekly = window.activeDriverWeek(d.c, weekId);
  const season = window.HINO_EXCEL_DATA.competition;
  const seasonDriver = season.teams.find((item) => item.id === d.region)?.drivers.find((item) => item.c === d.c);
  const notice = event.tone === 'normal' ? '目前沒有需播報的異常提醒' : '系統已自動語音提醒；請安全停靠後再操作';

  useEffect(() => {
    if (!window.driverAcknowledgements?.[d.c]) {
      requestAnimationFrame(() => window.autoPlayDriverSafetyAudio(d, event));
    }
  }, []);

  function handleMainAction() {
    if (acknowledged) {
      window.openSafetyCoach();
      return;
    }
    window.acknowledgeDriverEvent();
    setAcknowledged(window.driverAcknowledgements[d.c] || '');
  }

  const weeklySection = weekly?.score ? (
    <section className="driver-weekly-section">
      <div className="sh">
        <h2>本週我的評分</h2>
        <span className="tag">{weekly.week.label}</span>
      </div>
      <div className="weekly-period-tabs">
        {weekly.weekly.weeks.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`weekly-period ${item.id === weekly.week.id ? 'on' : ''}`}
            onClick={() => setWeekId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="weekly-score-note">
        依需要注意程度排序；本週以 {weekly.score.records.toLocaleString()} 筆可用行車紀錄計算。
      </p>
      <div className="weekly-score-list">
        {weekly.score.categories.map((category, index) => (
          <article key={category.id} className={`weekly-score-card ${category.tone}`}>
            <div className="weekly-score-head">
              <div>
                <span>{index === 0 ? '優先注意' : '持續追蹤'}</span>
                <h3>{category.label}</h3>
              </div>
              <b>
                {category.score}
                <small>分</small>
              </b>
            </div>
            <p className="weekly-score-attention">
              {category.attention.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </p>
            <div className="weekly-score-facts">
              {category.facts.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  ) : (
    <section>
      <div className="driver-task-detail">
        <div>
          <span>超速紀錄</span>
          <b>{d.overspeed_count.toLocaleString()} 筆</b>
        </div>
        <div>
          <span>怠速佔比</span>
          <b>{d.idle_pct}%</b>
        </div>
        <div>
          <span>高引擎負載</span>
          <b>{d.high_load_count.toLocaleString()} 筆</b>
        </div>
        <div>
          <span>DTC</span>
          <b>{d.dtc_count.toLocaleString()} 筆</b>
        </div>
      </div>
    </section>
  );

  return (
    <div className="screen" data-react>
      <section className="driver-drive-header">
        <span>車輛使用者</span>
        <h2>{d.c}</h2>
        <p>目前狀態：{d.last_status} · 最後更新 {d.last_time}</p>
      </section>
      <section className={`driver-drive-card ${event.tone}`}>
        <div>
          <span>現在要注意</span>
          <h3>{acknowledged ? '已回報，請安全完成當前行程' : event.title}</h3>
          <p>{acknowledged ? `已於 ${acknowledged} 回報車隊；若狀況改變請再次聯繫。` : event.detail}</p>
          <small style={{ display: 'block', marginTop: '7px', color: 'var(--mut)' }}>{notice}</small>
        </div>
        <div className="driver-drive-actions">
          <button type="button" className="btn pri" onClick={handleMainAction}>
            {acknowledged ? '查看改善方式' : event.action}
          </button>
        </div>
      </section>
      <section className="driver-task-strip">
        <div>
          <span>本次行程</span>
          <b>{d.last_status}</b>
          <small>目前車速 {d.last_speed} km/h</small>
        </div>
        <div>
          <span>下一步</span>
          <b>{Number(d.dtc_count || 0) ? '安全停靠後回報車況' : '安全完成行程'}</b>
          <small>不需閱讀長報表或操作地圖</small>
        </div>
      </section>
      {weeklySection}
      <section className="driver-season-status">
        <span>安全競賽</span>
        <b>{season.label} {seasonDriver ? `已結算 ${seasonDriver.s} 分` : '季結算'}</b>
        <small>每週分數只用來改善；不以週榜公開比較個人，季末才結算。</small>
      </section>
      <div className="foot">
        {weekly?.weekly?.cadence || '此頁只保留即時提醒、行程狀態與必要回報。'} 重要安全提醒會由系統直接語音播報。
      </div>
    </div>
  );
}

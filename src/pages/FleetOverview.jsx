import { useEffect, useState } from 'react';

export default function FleetOverview() {
  const [, bump] = useState(0);

  useEffect(() => {
    window.onWorkforceReviewChange = () => bump((n) => n + 1);
    return () => {
      window.onWorkforceReviewChange = undefined;
    };
  }, []);

  const source = window.HINO_EXCEL_DATA.meta;
  const focus = window.executiveManagementFocus();
  const season = window.activeCompetition();
  const ranking = window.seasonalTeamRanks();
  const latest = source.lastRecord || source.period;
  const recognition = window.workforceCandidates('recognition');
  const support = window.workforceCandidates('support');

  return (
    <div className="screen" data-react>
      <section className="decision-command">
        <div>
          <span>車隊管理總覽</span>
          <h2>今天先看這 2 件事</h2>
          <p>最後資料：{latest} · 直接看需要總負責人追蹤的安全與車況訊號。</p>
        </div>
        <button type="button" className="btn gho sm" onClick={() => window.openExecutiveReadGuide()}>判讀方式</button>
      </section>
      <section className="decision-actions">
        <div className="sh"><h2>本週管理重點</h2><span className="tag">不需老闆逐筆核准</span></div>
        <div className="executive-decision-row urgent">
          <div><b>{focus.speed.title}</b><span>{focus.speed.signal}</span></div>
          <span className="executive-status done">總負責人追蹤</span>
          <button type="button" className="btn gho sm" onClick={() => window.openExecutiveEvidence('speed')}>查看車號</button>
        </div>
        <div className="executive-decision-row warning">
          <div><b>{focus.maintenance.title}</b><span>{focus.maintenance.signal}</span></div>
          <span className="executive-status done">總負責人追蹤</span>
          <button type="button" className="btn gho sm" onClick={() => window.openExecutiveEvidence('maintenance')}>查看車號</button>
        </div>
      </section>
      <section className="executive-operating-grid">
        <article className="executive-panel competition">
          <div className="panel-title">
            <div><span>安全競賽</span><h3>{season.label} 六區季結算比較</h3></div>
            <button type="button" className="btn gho sm" onClick={() => window.openExecutiveCompetition()}>完整名次</button>
          </div>
          <div className="decision-six-grid">
            {ranking.slice(0, 6).map((team) => {
              const anomaly = Number(team.anomaly || 0);
              return (
                <div key={team.id} className={`decision-quadrant ${anomaly > 8 ? 'risk' : 'score'}`} style={{ '--quadrant-fill': `${Math.min(100, team.score)}%` }}>
                  <span>{team.name} · 風險 {anomaly}%</span>
                  <b>季結算 {team.score} 分</b>
                  <i></i>
                </div>
              );
            })}
          </div>
          <div className="executive-driver-leaders">
            <b>本季安全駕駛前三名</b>
            <span>帳號顯示資料</span>
            <div className="driver-leaderboard compact" dangerouslySetInnerHTML={{ __html: window.driverLeaderboardRows(true) }} />
          </div>
          <p className="panel-note">{season.period} · {season.recordCadence}。{source.regionMethod}。安全分越高越好；團隊名次可比較，個別車號名次僅限授權範圍。</p>
        </article>
        <article className="executive-panel people">
          <div className="panel-title">
            <div><span>人力覆核</span><h3>獎勵與改善名單</h3></div>
            <button type="button" className="btn gho sm" onClick={() => window.openWorkforceGuardrail()}>決策條件</button>
          </div>
          <div className="workforce-queues">
            <div>
              <div className="workforce-row" dangerouslySetInnerHTML={{ __html: `<b>獎勵／留任覆核</b>${window.workforceReviewBadge('recognition')}` }} />
              <p>車號 {recognition.map((item) => item.car).join('、')}</p>
              <button type="button" className="btn gho sm" onClick={() => window.openWorkforceReview('recognition')}>查看原因與送覆核</button>
            </div>
            <div>
              <div className="workforce-row" dangerouslySetInnerHTML={{ __html: `<b>改善與人資審查</b>${window.workforceReviewBadge('support')}` }} />
              <p>車號 {support.map((item) => item.car).join('、')}</p>
              <button type="button" className="btn gho sm" onClick={() => window.openWorkforceReview('support')}>查看原因與送覆核</button>
            </div>
          </div>
          <p className="panel-note">來源未提供駕駛姓名、工時與薪資；上述以車號遙測篩出覆核優先序，需先由人資比對人員並補齊資料。</p>
        </article>
        <article className="executive-panel ai">
          <div className="panel-title">
            <div><span>AI 行動建議</span><h3>先問清楚，再做決定</h3></div>
            <button type="button" className="btn gho sm" onClick={() => window.openAIChat()}>詢問 AI</button>
          </div>
          <div className="ai-summary-lines">
            <span>{focus.speed.region}：{focus.speed.next}</span>
            <span>{focus.maintenance.region}：{focus.maintenance.next}</span>
          </div>
          <p className="panel-note">AI 協助整理事實與改善問題；不會以單一遙測訊號自動處分人員或停止派車。</p>
        </article>
      </section>
      <div className="foot">資料期間：{source.period} · 本頁只保留可讓老闆快速掌握的管理摘要。</div>
    </div>
  );
}

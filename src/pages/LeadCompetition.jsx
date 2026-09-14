export default function LeadCompetition() {
  const region = window.myRegion();
  const season = window.activeCompetition();
  const competitionTeam = season.teams.find(item => item.id === region.id);
  const teamRank = window.seasonalTeamRanks().findIndex(item => item.id === region.id) + 1;
  const score = competitionTeam.score;
  return (
    <div className="screen" data-react>
      <section className="competition-hero">
        <div className="eyebrow">{region.name}車隊 · {season.label} 季結算</div>
        <h2>季結算第 {teamRank} 名，安全分 {score}</h2>
        <p>結算區間為 {season.period}；可看各車隊最終名次，個別資料以車號呈現且僅限您的管理範圍。</p>
        <div className="hero-actions">
          <button type="button" className="btn sm ghost" onClick={() => window.gotoTab('drivers')}>安排下季覆核</button>
        </div>
      </section>
      <section>
        <div className="sh"><h2>季結算車隊排行</h2><span className="tag">團隊資料可比較</span></div>
        <div className="ranklist" dangerouslySetInnerHTML={{ __html: window.seasonalTeamRankRows(region.id) }} />
      </section>
      <section>
        <div className="decision-card emphasis">
          <h3>本區下一步</h3>
          <p>先覆核超速、怠速、高引擎負載與 DTC 記錄，再安排提醒或保修。請不要公開車號末段名次，也不要把計算分數直接用於人事處分。</p>
          <div className="acts">
            <button type="button" className="btn pri sm" onClick={() => window.act('已排入本區遙測資料覆核會議。','ok')}>安排資料覆核</button>
          </div>
        </div>
      </section>
      <section dangerouslySetInnerHTML={{ __html: window.competitionRules() }} />
      <div className="foot">總負責人視角 · {region.name}管理範圍</div>
    </div>
  );
}

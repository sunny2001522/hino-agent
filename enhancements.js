/* Role-aware RWD upgrades: people decisions, safe-driving competition, and privacy-safe shipper tracking. */
(function () {
  const baseLogin = login;
  const baseLogout = logout;
  const baseDriverHome = renderDriverHome;
  const baseDriverTask = renderDriverTask;
  const baseDriverAlerts = renderDriverAlerts;
  const baseFleetMe = renderFleetMe;
  const baseAiContext = aiContext;
  const baseAiSuggestions = aiSuggestions;
  const baseAiGenerate = aiGenerate;
  const baseOpenAIChat = openAIChat;
  const baseAddChatActions = addChatActions;

  function currentTeamScore(region) { return region.safety.at(-1); }
  function teamRanks() { return regions.slice().sort((a, b) => currentTeamScore(b) - currentTeamScore(a)); }
  function allDrivers() { return regions.flatMap(region => region.drivers.map(driver => ({ region, driver }))); }
  function competitionRank(driver, region, score) {
    return region.drivers.filter(item => item.c !== driver.c && item.s > score).length + 1;
  }
  function improvementPlan(driver, region) {
    const reasons = [];
    if (/超速/.test(driver.i)) reasons.push('連續 7 天於限速內行駛');
    if (/未繫/.test(driver.i)) reasons.push('每趟全程繫妥安全帶');
    if (/怠速/.test(driver.i) || region.idlePct >= 14) reasons.push('等候超過 90 秒熄火');
    if (/急|煞/.test(driver.i)) reasons.push('提早減速並保持安全車距');
    if (!reasons.length) reasons.push('維持零違規與出車前點檢');
    const gain = Math.min(10, Math.max(3, reasons.length * 3));
    const now = competitionRank(driver, region, driver.s);
    const next = competitionRank(driver, region, Math.min(100, driver.s + gain));
    return { reasons: reasons.slice(0, 3), gain, now, next, forward: Math.max(0, now - next) };
  }
  function teamRankRows(highlightId) {
    return teamRanks().map((region, index) => {
      const score = currentTeamScore(region);
      const improve = Math.max(0, 70 - score);
      return `<div class="rankrow ${region.id === highlightId ? 'mine' : ''}">
        <div class="ranknum ${index < 3 ? 'top' : ''}">${index + 1}</div>
        <div class="rankmain"><b>${region.name}車隊${region.id === highlightId ? ' · 我的車隊' : ''}</b><span>安全分 ${score} · 異常率 ${region.anomaly}% · ${improve ? '距 70 分差 ' + improve + ' 分' : '已達安全獎勵門檻'}</span></div>
        <div class="rankscore" style="color:${scoreColor(score)}">${score}<small>安全分</small></div>
      </div>`;
    }).join('');
  }
  function competitionRules() {
    return `<div class="guardrail"><b>競賽護欄：</b>個人只看自己的名次，不公開同仁姓名；團隊可看團隊名次。獎勵以「安全改善與達標」為主，不以違規罰款或扣薪為規則；安全分不直接作為解雇依據，須經改善期、申訴與人資覆核。</div>`;
  }
  const manualPages = [
    { p:1, t:'iTRAQ WEB', d:'iTRAQ WEB 管理入口。', b:['WEB 系統操作介面','車隊與管理資料入口','AI 決策以營運資料為基礎'], m:'系統入口與版型基準' },
    { p:2, t:'監控地圖', d:'即時監控車輛狀態、位置、駕駛與基本車輛資訊。', b:['車號、駕駛、行駛狀態、手機、車速、位置、最後上線時間','狀態：行駛中、怠速、失聯、熄火','電子圍籬範圍／名稱與即時影像、外接設備入口'], m:'即時監控資料' },
    { p:3, t:'即時影像', d:'查看車輛安裝 DVR 設備的即時影像內容。', b:['多鏡頭即時播放區','選取左側或右側車輛即可播放','車輛資訊列表可回到即時位置'], m:'DVR 即時影像資料' },
    { p:4, t:'軌跡回放', d:'查詢歷史車輛行駛軌跡與車輛資料。', b:['第一層：車隊內所有車輛的歷史軌跡','第二層：單一車輛的所有軌跡行程','第三層：單一軌跡的點位時間、位置、狀態與觸發事件'], m:'歷史行程與軌跡資料' },
    { p:5, t:'影像調閱', d:'查詢或下載該車七日內的行駛影像紀錄。', b:['以車號與日期搜尋','點選日期後查看該日車輛影像列表','影像調閱屬付費使用功能'], m:'七日行駛影像紀錄' },
    { p:6, t:'任務管理', d:'查看需執行之任務狀態，支援新增、匯入、複製與刪除。', b:['依任務或車號查看清單','狀態：待執行、調度中、執行中、已中斷、已完成','執行中／調度中的任務不可刪除'], m:'任務執行狀態' },
    { p:7, t:'保修系統｜車輛週期', d:'查看近期保修紀錄與預約原廠保修。', b:['以日期、部門等條件篩選','設定前次保修值與保修週期','查看保修週期排程與工單項目'], m:'保修週期與工單資料' },
    { p:8, t:'保修系統｜預約資料', d:'查看預約原廠保修之資料與處理狀態。', b:['切換已預約、已進廠、已逾期等狀態','匯出或刪除預約資料','點選清單列查看預約細節'], m:'原廠保修預約資料' },
    { p:9, t:'事件列表', d:'查詢車輛觸發的歷史事件。', b:['查看車隊所有車輛事件次數與七大類事件','單一車輛／單類事件可下鑽','每筆包含觸發地點、時間、當下車速、持續時間與備註'], m:'安全與車況事件資料' },
    { p:10, t:'營運月報', d:'查看每月營運月報資料與匯出月報。', b:['每日車輛移動率圖表','每日累積里程、累積油耗量、平均油耗','保養維修項目比例與筆數／花費、任務執行率與準時達成率'], m:'月營運 KPI 資料' },
    { p:11, t:'車輛管理', d:'查看各個車輛資料，新增後可編輯、刪除與重新納管。', b:['部門、搜尋條件與車輛清單','車輛基本資料、ETC、網址、裝置識別碼','新增車輛後顯示成功通知'], m:'車輛主檔資料' },
    { p:12, t:'駕駛管理', d:'瀏覽車隊駕駛資料，並指派管理行程給對應駕駛。', b:['新增駕駛與編輯基本資料','管理駕駛行程','點選安全分可查看駕駛成績'], m:'駕駛主檔與安全分資料' },
    { p:13, t:'管理行程', d:'管理行程指派給指定駕駛，並依狀態結算成績。', b:['依行程狀態搜尋','行程歸屬駕駛可調整','月內無違反有疑慮才可結算成績'], m:'排班與行程執行資料' },
    { p:14, t:'駕駛成績', d:'查看駕駛成績內容與車速、怠速等分析。', b:['駕駛基本資料、總成績、總行駛時間與里程','可切換車速、怠速、油門、急煞等分析','可匯出成績單'], m:'個人安全駕駛成績資料' },
    { p:15, t:'圍籬管理', d:'使用者查詢圍籬範圍，車輛進出範圍時發送訊息告知。', b:['新增、編輯、刪除圍籬','範圍顏色與是否顯示在地圖','車輛離開或進入圍籬產生通知'], m:'電子圍籬與進出通知資料' },
    { p:16, t:'通知中心', d:'查看各類型通知，支援日期與通知類型篩選。', b:['事件、任務、圍籬、語音、納管、平台通知','保修通知、駕駛成績、影像通知','預設顯示全部通知，可依日期查詢'], m:'通知紀錄資料' }
  ];
  const manualLiveData = {
    1:[['系統模組','16 頁'],['納管車輛','20 台'],['登入角色','5 種']],
    2:[['行駛中','12 台'],['怠速','3 台'],['熄火／失聯','4／1 台']],
    3:[['DVR 車輛','8 台'],['即時鏡頭','4 路'],['可播放車號','KLA-999']],
    4:[['歷史行程','186 筆'],['點位事件','42 筆'],['最近回放','KLA-111']],
    5:[['調閱期間','7 日'],['可用影像','144 段'],['查詢車號','KLA-111']],
    6:[['待執行','7 件'],['執行中','5 件'],['已完成','18 件']],
    7:[['待保修車輛','3 台'],['最近保修','KLA-111'],['週期預警','10 小時']],
    8:[['已預約','5 筆'],['已進廠','2 筆'],['已逾期','1 筆']],
    9:[['事件總數','2,184 件'],['超速事件','730 件'],['未繫帶','683 件']],
    10:[['本月里程','394,300 km'],['累積油耗','3,921 L'],['平均油耗','20.2 L/100km']],
    11:[['車輛主檔','20 台'],['ETC 已設定','18 台'],['待重新納管','1 台']],
    12:[['駕駛主檔','20 人'],['已派行程','18 人'],['待補資料','2 人']],
    13:[['本月行程','100 件'],['準時完成','90%'],['可結算成績','5 人']],
    14:[['最高成績','100 分'],['平均車速','87 km/h'],['急煞安全分','78 分']],
    15:[['啟用圍籬','9 組'],['今日進出','37 次'],['待確認警示','2 件']],
    16:[['未讀通知','12 則'],['事件通知','6 則'],['保修／任務','3／3 則']]
  };
  let currentManualPage = 2;
  function renderItraqWorkspace() {
    const pages = manualPages.filter(item => item.p > 1);
    const page = pages.find(item => item.p === currentManualPage) || pages[0];
    const tabs = pages.map(item => `<button class="itraq-web-tab ${item.p === page.p ? 'on' : ''}" onclick="selectManualPage(${item.p})">${item.t}</button>`).join('');
    const live = (manualLiveData[page.p] || []).map(([label,value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('');
    screen.innerHTML = `
      <section class="itraq-workspace"><div class="itraq-web-tabs">${tabs}</div><div class="itraq-view"><div class="itraq-canvas"><img src="assets/itraq-manual/manual-${String(page.p).padStart(2,'0')}.jpg" alt="iTRAQ ${page.t}"></div><aside class="itraq-sidepanel"><div class="module-kicker">iTRAQ WEB</div><h2>${page.t}</h2><p>${page.d}</p><div class="status-tile">${live}</div><ul>${page.b.map(item => `<li>${item}</li>`).join('')}</ul><div class="connected-note"><b>管理連動：</b>${page.m}可供風險預警、車隊決策、競賽與 AI 問答依權限使用。</div><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn pri sm" onclick="openItraqDataDetail(${page.p})">查看數據</button><button class="btn gho sm" onclick="gotoTab('${SESSION.role === 'fleet' ? 'analytic' : 'focus'}')">AI 分析</button></div></aside></div></section>`;
  }
  function renderFleetCompetition() {
    screen.innerHTML = `
      <section class="competition-hero"><div class="eyebrow">SAFETY LEAGUE · 08 月賽季</div><h2>把安全駕駛變成可前進的團隊目標</h2><p>第一名車隊可獲團隊獎金；每位駕駛的個人名次維持私密，只呈現自己的改善路徑。</p><div class="hero-actions"><button class="btn sm" onclick="openCompetitionLaunch()">設定本月獎勵</button><button class="btn sm ghost" onclick="openCompetitionRules()">查看公平規則</button></div></section>
      <section><div class="sh"><h2>車隊安全聯賽</h2><span class="newbadge">公開至團隊層級</span></div><div class="subt">依月結安全分排序；每週更新，分數採事件校正與人工抽查後入榜。</div><div class="ranklist">${teamRankRows()}</div></section>
      <section class="office-grid"><div class="next-gain"><strong>第一名：南區 81 分</strong><p>團隊獎金 NT$6,000，由車隊自行分配；不以高工時或多接單換取分數。</p></div><div class="next-gain"><strong>中區若先降超速與未繫帶</strong><p>安全分預估 +8，團隊可前進 1 名；先改善風險，再談獎金。</p></div></section>
      <section>${competitionRules()}</section><div class="foot">車隊管理視角 · 團隊排行公開、個人明細僅限授權主管與本人</div>`;
  }
  function renderLeadCompetition() {
    const region = myRegion();
    const teamRank = teamRanks().findIndex(item => item.id === region.id) + 1;
    const score = currentTeamScore(region);
    screen.innerHTML = `
      <section class="competition-hero"><div class="eyebrow">${region.name}車隊 · 安全聯賽</div><h2>目前第 ${teamRank} 名，安全分 ${score}</h2><p>可看各車隊名次；駕駛個人資料僅限您的管理範圍，個人名次不對其他同仁公開。</p><div class="hero-actions"><button class="btn sm" onclick="openCompetitionLaunch()">向駕駛說明規則</button><button class="btn sm ghost" onclick="gotoTab('drivers')">安排改善跟進</button></div></section>
      <section><div class="sh"><h2>車隊排行</h2><span class="tag">團隊資料可比較</span></div><div class="ranklist">${teamRankRows(region.id)}</div></section>
      <section><div class="decision-card emphasis"><h3>本區下一步</h3><p>先讓超速、未繫帶與急煞事件下降，再於週會公布「本區改善幅度」與團隊獎金進度；請不要公開個人末段名次。</p><div class="acts"><button class="btn pri sm" onclick="act('已排入本區安全改善週會與匿名回饋。','ok')">安排安全週會</button></div></div></section>
      <section>${competitionRules()}</section><div class="foot">總負責人視角 · ${region.name}管理範圍</div>`;
  }
  function renderDriverCompetition() {
    const { region, driver } = (() => { const x = myDriver(); return { region: x.r, driver: x.d }; })();
    const plan = improvementPlan(driver, region);
    const prize = driver.s >= 70 ? '已達 NT$1,200 安全獎金門檻' : `再 ${Math.max(0, 70 - driver.s)} 分即可達 NT$1,200 安全獎金門檻`;
    screen.innerHTML = `
      <section class="competition-hero"><div class="eyebrow">MY SAFE DRIVE · 私密榜單</div><h2>我的名次：第 ${plan.now} / ${region.drivers.length}</h2><p>只有你看得到自己的名次；系統不顯示其他駕駛姓名或分數。</p><div class="hero-actions"><button class="btn sm" onclick="openDriverSafetyPlan()">開始 7 天提分計畫</button></div></section>
      <section><div class="private-note"><b>隱私保護：</b>你看得到自己的排名、分數與下一步；團隊只會看整體成績，不會看到誰排第幾名。</div></section>
      <section><div class="sh"><h2>照做後可前進幾名</h2></div><div class="next-gain"><strong>完成這 3 件事，預估 +${plan.gain} 分${plan.forward ? '、前進 ' + plan.forward + ' 名' : ''}</strong><p>改善預估供你設定目標；最終入榜前會排除車況、路況與派工因素，並提供申訴管道。</p><ul class="mini-checks">${plan.reasons.map(item => `<li>${item}</li>`).join('')}</ul><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn pri sm" onclick="openDriverSafetyPlan()">看我的改善步驟</button><button class="btn gho sm" onclick="playDriverSafetyAudio()">播放安全語音</button></div></div></section>
      <section><div class="decision-card emphasis"><h3>獎勵，不是懲罰</h3><p>${prize}。賽季第一名個人可獲 NT$3,000；但不以危險趕工、接更多單或壓縮休息換分數。</p></div></section>
      <section>${competitionRules()}</section><div class="foot">車隊駕駛視角 · 個人資料僅本人可見</div>`;
  }
  function renderPeopleDecision() {
    const staffing = regions.map(region => {
      const orders = ordersByRegion[region.id];
      const required = Math.ceil(orders / TARGET_PER_DRIVER);
      return { region, orders, required, gap: required - region.drivers.length };
    }).sort((a, b) => b.gap - a.gap);
    const hires = staffing.filter(item => item.gap > 0).reduce((sum, item) => sum + item.gap, 0);
    const raisePeople = allDrivers().filter(item => item.driver.s >= 80).sort((a, b) => b.driver.s - a.driver.s).slice(0, 3);
    const low = allDrivers().filter(item => item.driver.s < 55).sort((a, b) => a.driver.s - b.driver.s);
    screen.innerHTML = `
      <section class="competition-hero"><div class="eyebrow">PEOPLE DECISION CENTER</div><h2>老闆只看需要拍板的人力決策</h2><p>把安全、單量與培訓資料轉成「招募、調度、加薪與改善程序」；不自動解雇、不用單一分數做人事判決。</p><div class="hero-actions"><button class="btn sm" onclick="openHiringDecision()">核准招募需求</button><button class="btn sm ghost" onclick="openRaiseReview()">檢視薪酬建議</button></div></section>
      <section class="office-grid">
        <div class="decision-card emphasis"><h3>招募與調度</h3><div class="decision-metric"><span>建議優先招募</span><b>${hires} 人</b></div><p>${staffing.filter(item => item.gap > 0).map(item => item.region.name + ' +' + item.gap).join('、') || '目前無缺額'}。先用低負荷區支援，再補足長期缺口，避免以加班填補人力。</p><div class="acts"><button class="btn pri sm" onclick="openHiringDecision()">送交 HR 招募</button><button class="btn gho sm" onclick="act('已建立跨區短期支援方案，送調度與各區負責人確認。','ok')">先排跨區支援</button></div></div>
        <div class="decision-card emphasis"><h3>薪酬與留任</h3><div class="decision-metric"><span>安全與穩定表現候選</span><b>${raisePeople.length} 人</b></div><p>${raisePeople.map(item => item.driver.n + '（' + item.region.name + ' ' + item.driver.s + ' 分）').join('、')}。建議以月安全分、出勤、客訴與安全改善共評，不以單月排名定薪。</p><div class="acts"><button class="btn pri sm" onclick="openRaiseReview()">送薪酬會議</button></div></div>
        <div class="decision-card warning"><h3>低分改善與留任風險</h3><div class="decision-metric"><span>需啟動改善計畫</span><b>${low.length} 人</b></div><p>${low.map(item => item.driver.n + '（' + item.region.name + ' ' + item.driver.s + ' 分）').join('、')}。先檢查車況、排班與訓練需求，提供 30 天輔導與申訴，再由人資進行個案審查。</p><div class="acts"><button class="btn warnb sm" onclick="openPerformanceReview()">啟動改善與審查</button></div></div>
        <div class="decision-card danger"><h3>裁員／解約保護閘門</h3><p>系統不能自動裁員，也不會把競賽末名直接列為解雇建議。若業務量下滑，須先做工作量、排班、轉調可能性、法遵與人資覆核。</p><div class="acts"><button class="btn gho sm" onclick="openWorkforceGuardrail()">查看人資覆核流程</button></div></div>
      </section>
      <section>${competitionRules()}</section><div class="foot">車隊管理視角 · 所有薪酬與人事行動均為原型模擬，需經人資與主管核准</div>`;
  }
  function renderFleetSettingsEnhanced() {
    baseFleetMe();
    const foot = screen.querySelector('.foot');
    foot.insertAdjacentHTML('beforebegin', `<section><div class="sh"><h2 class="sm">iTRAQ WEB 功能</h2><span class="tag">監控、車務、保修與通知</span></div><div class="module-grid"><div class="module-chip"><b>監控地圖 / 車輛定位</b><span>位置、狀態與基本車輛資訊</span></div><div class="module-chip"><b>即時影像 / 軌跡回放</b><span>行車影像調閱與歷史軌跡</span></div><div class="module-chip"><b>任務 / 事件 / 通知</b><span>任務派發、異常事件與推播中心</span></div><div class="module-chip"><b>保修 / 車輛 / 駕駛</b><span>保修履歷、車輛資料與駕駛管理</span></div><div class="module-chip"><b>營運月報 / 駕駛成績</b><span>月報圖表與安全駕駛成績</span></div><div class="module-chip"><b>管理行程 / 圍籬</b><span>工作流程、電子圍籬與進出通知</span></div></div><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn pri sm" onclick="gotoTab('itraq')">開啟 iTRAQ WEB</button></div></section>`);
  }
  function renderDriverHomeEnhanced() {
    baseDriverHome();
    if (SESSION.role !== 'driver') return;
    const foot = screen.querySelector('.foot');
    foot.insertAdjacentHTML('beforebegin', `<section><div class="private-note"><b>安全競賽已開放：</b>你可在「排名」查看自己的私密名次與可前進的步驟；團隊成績公開，個人姓名與名次不公開。</div></section>`);
  }
  function renderDriverTaskEnhanced() {
    baseDriverTask();
    if (SESSION.role !== 'driver') return;
    const foot = screen.querySelector('.foot');
    foot.insertAdjacentHTML('beforebegin', `<section><div class="decision-card emphasis"><h3>AI 路線討論</h3><p>遇到壅塞、怠速或趕時間，先向 AI 詢問替代路線與休息點；系統會把安全與法規放在「最快」之前。</p><div class="acts"><button class="btn pri sm" onclick="openDriverRouteCoach()">討論替代路線</button></div></div></section>`);
  }
  function renderDriverAlertsEnhanced() {
    baseDriverAlerts();
    if (SESSION.role !== 'driver') return;
    const foot = screen.querySelector('.foot');
    foot.insertAdjacentHTML('beforebegin', `<section><div class="private-note"><b>推播不是處罰：</b>超速、怠速、未繫帶會先用簡短語音提醒與單鍵回報；系統再用後續行車資料確認是否改善，必要時由總負責人提供休息、路線或車況支援。</div><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn pri sm" onclick="playDriverSafetyAudio()">播放目前安全提醒</button><button class="btn gho sm" onclick="act('已回報需要主管協助，系統會安排安全關懷。','wn')">我需要協助</button></div></section>`);
  }
  function renderShipperTrackEnhanced() {
    if (animTimer) clearInterval(animTimer);
    const list = myOrders();
    if (!curOrder || !list.find(order => order.id === curOrder)) curOrder = list[0].id;
    const order = list.find(item => item.id === curOrder) || list[0];
    const tabs = list.map(item => `<div class="regchip ${curOrder === item.id ? 'on' : ''}" onclick="selectOrder('${item.id}')">${item.id}${item.risk ? ' · 延誤通知' : ''}</div>`).join('');
    const steps = ['已取貨', '運送中', '即將到達', '已送達'];
    const active = order.progress >= 1 ? 3 : order.progress >= .85 ? 2 : order.progress > 0 ? 1 : 0;
    const timeline = steps.map((step, index) => `<div class="tstep ${index < active ? 'done' : index === active ? 'cur' : ''}"><div class="d"></div><div class="t">${step}</div></div>`).join('');
    const vehicle = order.car.split(' · ')[0];
    screen.innerHTML = `
      <section><div class="sh"><h2>我的貨件</h2><span class="newbadge">隱私追蹤</span></div><div class="subt">${myShipper().name} · 僅顯示貨件必要資訊</div><div class="regsel">${tabs}</div>
      <div class="card"><div class="eta-hero"><span class="big">${order.etaMin}</span><span class="lbl">分鐘後到達</span><span class="stpill ${order.risk ? 'st-risk' : order.progress >= .85 ? 'st-soon' : 'st-go'}" style="margin-left:auto">${order.status}</span></div>
      <div class="status-tile"><div><span>貨件編號</span><b>${order.id}</b></div><div><span>車輛編號</span><b>${vehicle}</b></div><div><span>出貨地</span><b>${order.from}</b></div><div><span>收貨地</span><b>${order.to}</b></div></div>
      <div class="tline">${timeline}</div>
      <div class="shipper-ai"><h3>AI 到貨管家</h3><p>${order.risk ? '系統偵測到市區壅塞與裝卸等待，已由調度套用安全替代路線並更新 ETA。' : '車輛正依計畫運送；如遇裝卸等待或安全事件，AI 會先保護駕駛，再主動更新 ETA。'}</p><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn pri sm" onclick="openAIChat()">詢問貨況</button><button class="btn gho sm" onclick="act('已開啟到貨與延誤推播通知。','ok')">開啟推播</button></div></div>
      <div class="private-note" style="margin-top:12px"><b>為保護行車安全：</b>不顯示即時地圖、司機姓名／聯絡方式；貨主端不能取消訂單。如需異動，由客服與調度統一處理。</div></div></section><div class="foot">貨主視角 · 僅限 ${myShipper().name} 的貨件</div>`;
  }
  function renderShipperOrdersEnhanced() {
    if (animTimer) clearInterval(animTimer);
    const list = myOrders();
    const cards = list.map(order => `<div class="shipcard"><div class="top"><span class="id">${order.id}</span><span class="stpill ${order.risk ? 'st-risk' : order.progress >= .85 ? 'st-soon' : 'st-go'}" style="margin-left:auto">${order.status}</span></div><div class="cust">${order.from} → <b style="color:var(--txt)">${order.to}</b></div><div class="cust">ETA ${order.etaMin} 分 · 車輛 ${order.car.split(' · ')[0]}</div><div class="acts"><button class="btn pri sm" onclick="selectOrderTab('${order.id}')">查看必要貨況</button><button class="btn gho sm" onclick="act('已開啟本貨件到貨推播。','ok')">接收推播</button></div></div>`).join('');
    screen.innerHTML = `<section><div class="sh"><h2>我的貨件</h2><span class="num" style="background:var(--accent);color:#04121f">${list.length}</span></div><div class="subt">延誤優先；不提供地圖、聯絡司機或取消訂單</div>${cards}</section><div class="foot">貨主視角 · 僅限 ${myShipper().name} 的貨件</div>`;
  }
  window.openCompetitionRules = function () { showModal(`<h3>安全聯賽公平規則</h3><p>競賽目的是降低風險與表揚改善，不是以壓力逼迫駕駛趕工。</p><ul class="mini-checks"><li>個人名次只顯示給本人；團隊名次可公開比較。</li><li>以安全改善、法遵與休息合規計分，不以多跑趟次加分。</li><li>車況、路況與派工造成的異常可申訴並人工覆核。</li><li>不把末名、單一安全分或競賽結果作為自動扣薪／解雇依據。</li></ul><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); };
  window.openCompetitionLaunch = function () { showModal(`<h3>發起 4 週安全聯賽</h3><p>建議先與駕駛代表確認規則與獎勵。第一名團隊獎金 NT$6,000；個人第一名 NT$3,000；所有分數月結後人工抽查。</p><div class="guardrail">不以競賽排名直接影響底薪、排班或去留。遇到壓力、車況或工時問題，可直接回報並停止計分。</div><div class="mb"><button class="btn gho" onclick="closeOv()">再討論</button><button class="btn pri" onclick="act('已建立安全聯賽草案，待駕駛代表與人資共同確認。','ok');closeOv()">送交共同確認</button></div>`); };
  window.openHiringDecision = function () { const need = regions.map(r => ({ name:r.name, n:Math.max(0, Math.ceil(ordersByRegion[r.id] / TARGET_PER_DRIVER) - r.drivers.length) })).filter(x => x.n); showModal(`<h3>人力招募決策</h3><p>依近期單量與每人月承載 ${TARGET_PER_DRIVER} 單試算，建議優先補足：${need.map(x => x.name + ' +' + x.n).join('、')}。</p><div class="guardrail">正式招募需確認預算、駕照資格、工時與安全訓練容量；系統只提供需求預估。</div><div class="mb"><button class="btn gho" onclick="closeOv()">返回</button><button class="btn pri" onclick="act('已將人力招募需求送交 HR 與財務預算審核。','ok');closeOv()">送交 HR 審核</button></div>`); };
  window.openRaiseReview = function () { const list = allDrivers().filter(x => x.driver.s >= 80).sort((a,b) => b.driver.s-a.driver.s).slice(0,3); showModal(`<h3>薪酬與留任覆核</h3><p>候選：${list.map(x => x.driver.n + '（' + x.region.name + '，安全 ' + x.driver.s + ' 分）').join('、')}。</p><div class="guardrail">建議將安全表現與出勤、客訴、技術、資歷及同工同酬一併評估；不以單月排名直接加薪。</div><div class="mb"><button class="btn gho" onclick="closeOv()">返回</button><button class="btn pri" onclick="act('已建立薪酬覆核清單，送主管與人資共同審查。','ok');closeOv()">送薪酬會議</button></div>`); };
  window.openPerformanceReview = function () { showModal(`<h3>啟動安全改善與個案審查</h3><p>先由總負責人確認車況、排班、訓練與健康／工時風險，再給 30 天改善計畫、必要支持與申訴管道。</p><div class="guardrail"><b>不啟動自動裁員：</b>若改善未達成，仍須由人資依勞動法規、績效紀錄與合理調整程序進行個案審查。</div><div class="mb"><button class="btn gho" onclick="closeOv()">返回</button><button class="btn warnb" onclick="act('已建立 30 天安全改善計畫與人資個案覆核，不執行自動裁員。','wn');closeOv()">建立改善計畫</button></div>`); };
  window.openWorkforceGuardrail = function () { showModal(`<h3>人資決策覆核流程</h3><p>1. 檢視單量、車況與班表；2. 提供轉調／訓練／合理調整；3. 設定改善目標與申訴管道；4. 人資與主管依適用法規個案核准。</p><div class="guardrail">安全分是輔助訊號，不是裁員按鈕。所有解約／裁撤均須人為審核與法遵確認。</div><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); };
  window.openManualChecklist = function () { gotoTab('itraq'); };
  window.selectManualPage = function (page) { currentManualPage = page; renderItraqWorkspace(); };
  window.openItraqDataDetail = function (pageNo) { const page = manualPages.find(item => item.p === pageNo); showModal(`<h3>${page.t}｜資料欄位</h3><p>${page.d}</p><ul class="mini-checks">${page.b.map(item => `<li>${item}</li>`).join('')}</ul><div class="source-note"><b>使用方式：</b>${page.m}會回填到車隊決策、AI 問答、風險預警與競賽改善計畫；資料仍依登入身份限縮可見範圍。</div><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); };
  window.openDriverSafetyPlan = function () { const {r,d} = myDriver(), p = improvementPlan(d,r); showModal(`<h3>${d.n} 的 7 天安全提分計畫</h3><p>目標：安全分 ${d.s} → ${Math.min(100,d.s+p.gain)}，${p.forward ? '預估前進 ' + p.forward + ' 名' : '先穩定降低事件'}。</p><ul class="mini-checks">${p.reasons.map((item,i)=>`<li>第 ${i+1} 項：${item}</li>`).join('')}<li>每天結束前查看自己的事件摘要；有車況或工時問題直接回報。</li></ul><div class="mb"><button class="btn gho" onclick="closeOv()">稍後再說</button><button class="btn pri" onclick="act('已啟動 7 天安全提分計畫，提醒不影響休息與安全判斷。','ok');closeOv()">開始計畫</button></div>`); };
  window.openDriverRouteCoach = function () { showModal(`<h3>AI 路線建議</h3><p>目前路段：國道一號大雅段。AI 建議先維持安全車距，若壅塞持續 10 分鐘以上，再由調度確認後改走替代路線 A；不會要求你為了排名超速或縮短休息。</p><div class="mb"><button class="btn gho" onclick="closeOv()">維持原路線</button><button class="btn pri" onclick="act('已請調度評估替代路線與卸貨時段。','ok');closeOv()">請調度評估</button></div>`); };
  window.playDriverSafetyAudio = function () { const {d} = myDriver(); const text = /超速/.test(d.i) ? '請依目前路段限速行駛，放鬆油門並保持安全車距。' : /怠速/.test(d.i) ? '等候超過九十秒請熄火，安全省油一起做到。' : '請全程繫好安全帶，保持專注，行車平安。'; try { if ('speechSynthesis' in window) { speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-TW'; speechSynthesis.speak(utterance); } } catch (_) {} toast('安全語音已播放', '提醒後系統會用後續行車資料確認是否改善；需要協助可直接回報。', 'wn'); };

  window.login = function (role) { baseLogin(role); document.body.classList.toggle('office', role === 'fleet' || role === 'lead'); if (role === 'shipper') document.getElementById('aifab').style.display = 'grid'; };
  window.logout = function () { document.body.classList.remove('office'); baseLogout(); };
  window.selectOrder = function (id) { curOrder = id; renderShipperTrackEnhanced(); };
  window.renderDriverHome = renderDriverHomeEnhanced;
  window.renderDriverTask = renderDriverTaskEnhanced;
  window.renderDriverAlerts = renderDriverAlertsEnhanced;
  window.renderFleetMe = renderFleetSettingsEnhanced;
  function originalDataAnswer(question) {
    const topic = [
      { test:/保修|維修|工單|進廠/, p:7, next:'可至 iTRAQ → 保修系統查看週期與預約資料。' },
      { test:/任務|派工|調度/, p:6, next:'可至 iTRAQ → 任務管理查看待執行、執行中與已完成任務。' },
      { test:/事件|超速|未繫|急煞/, p:9, next:'可至 iTRAQ → 事件列表下鑽車號、地點、時間與持續時間。' },
      { test:/月報|里程|油耗|營運/, p:10, next:'可至 iTRAQ → 營運月報檢視每日趨勢與保修／任務 KPI。' },
      { test:/圍籬|進出|地理/, p:15, next:'可至 iTRAQ → 圍籬管理檢視進出警示與範圍。' },
      { test:/通知|推播|未讀/, p:16, next:'可至 iTRAQ → 通知中心依類型與日期篩選。' },
      { test:/影像|DVR|錄影/, p:3, next:'可至 iTRAQ → 即時影像／影像調閱查看可播放與七日紀錄。' },
      { test:/監控|位置|地圖|軌跡/, p:2, next:'可至 iTRAQ → 監控地圖或軌跡回放查看車輛狀態。' }
    ].find(item => item.test.test(question));
    if (!topic) return null;
    const page = manualPages.find(item => item.p === topic.p);
    const values = manualLiveData[topic.p] || [];
    return `${AI_TAG} 依 iTRAQ「${page.t}」資料快照：\n\n${values.map(([label,value]) => `· ${label}：<b>${value}</b>`).join('\n')}\n\n${topic.next} 這些數據也會回填到風險預警與管理決策，但人事與安全處置仍需依權限與人工覆核。`;
  }
  window.aiContext = function () {
    if (SESSION && SESSION.role === 'shipper') { const order = myOrders()[0]; return { role:'shipper', name:SESSION.acc.name, company:myShipper().name, order, vehicle:order.car.split(' · ')[0] }; }
    return baseAiContext();
  };
  window.aiSuggestions = function () { if (SESSION && SESSION.role === 'shipper') return ['為什麼 ETA 有變化？', '貨件現在需要我做什麼？', '若延誤，系統會怎麼通知我？']; if (SESSION && (SESSION.role === 'fleet' || SESSION.role === 'lead')) return [...baseAiSuggestions(), '目前待保修車輛與工單？', '本月營運月報的油耗與里程？']; return baseAiSuggestions(); };
  window.aiGenerate = function (question) {
    if (SESSION && SESSION.role === 'shipper') { const c = aiContext(), o = c.order; if (/延誤|ETA|多久|到達/.test(question)) return `${AI_TAG} ${o.id} 目前預估 ${o.etaMin} 分鐘後到達。${o.risk ? '系統已偵測到壅塞，調度正在採用安全替代方案，若 ETA 再變動會立即推播。' : '運送節點正常，若出現安全或裝卸等待事件，會先保護駕駛並主動更新 ETA。'}`; if (/怠速|為什麼|狀況/.test(question)) return `${AI_TAG} 我只提供與貨況相關的摘要：${o.risk ? '本次 ETA 受市區壅塞與裝卸等待影響，調度已處理。' : '目前沒有影響 ETA 的異常。'} 為保護駕駛隱私與行車安全，不提供司機個資或精確位置。`; return `${AI_TAG} 我可以協助說明 ${o.id} 的 ETA、到貨通知與異常處理。這個介面不顯示地圖、司機聯絡方式，也不能取消訂單。`; }
    if (SESSION && (SESSION.role === 'fleet' || SESSION.role === 'lead')) { const answer = originalDataAnswer(question); if (answer) return answer; }
    return baseAiGenerate(question);
  };
  window.openAIChat = function () {
    if (!SESSION || SESSION.role !== 'shipper') return baseOpenAIChat();
    const suggestions = aiSuggestions().map(item => `<span class="chip2" onclick="aiAsk('${item}')">${item}</span>`).join('');
    showModal(`<div class="chatwrap"><div class="chathd"><div class="ci">AI</div><div><div class="cn">AI 到貨管家 ${AI_TAG}</div><div class="cs">貨況摘要與主動推播</div></div></div><div class="chatlog" id="chatlog"></div><div class="chips2" id="chatChips">${suggestions}</div><div class="chatin"><input id="chatInput" type="text" placeholder="例如：為什麼 ETA 有變化？" onkeydown="if(event.key==='Enter')aiAskInput()"><button class="send" id="chatSend" onclick="aiAskInput()">↑</button></div></div>`);
    document.getElementById('chatlog').innerHTML = `<div class="bub ai"><div class="lbl">${AI_TAG}</div>${SESSION.acc.name} 您好，我會主動說明貨況與 ETA；不顯示精確位置或駕駛個資。</div>`;
  };
  window.addChatActions = function (bubble, question) { if (SESSION && SESSION.role === 'shipper') { bubble.appendChild(el(`<div style="margin-top:9px"><button class="btn pri sm" onclick="act('已開啟貨件 ETA 與延誤推播。','ok')">開啟到貨推播</button></div>`)); document.getElementById('chatlog').scrollTop = 99999; return; } baseAddChatActions(bubble, question); };

  TABS.fleet.splice(0, TABS.fleet.length,
    { id:'todo', l:'決策', render:renderFleetTodo },
    { id:'itraq', l:'iTRAQ', render:renderItraqWorkspace },
    { id:'analytic', l:'分析', render:renderFleetAnalytics },
    { id:'people', l:'人力', render:renderPeopleDecision },
    { id:'competition', l:'競賽', render:renderFleetCompetition },
    { id:'me', l:'設定', render:renderFleetSettingsEnhanced }
  );
  TABS.lead.splice(3, 0, { id:'itraq', l:'iTRAQ', render:renderItraqWorkspace }, { id:'competition', l:'競賽', render:renderLeadCompetition });
  TABS.driver.splice(3, 0, { id:'competition', l:'排名', render:renderDriverCompetition });
  TABS.driver.find(tab => tab.id === 'home').render = renderDriverHomeEnhanced;
  TABS.driver.find(tab => tab.id === 'task').render = renderDriverTaskEnhanced;
  TABS.driver.find(tab => tab.id === 'alert').render = renderDriverAlertsEnhanced;
  TABS.shipper.find(tab => tab.id === 'track').render = renderShipperTrackEnhanced;
  TABS.shipper.find(tab => tab.id === 'orders').render = renderShipperOrdersEnhanced;
})();

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
    foot.insertAdjacentHTML('beforebegin', `<section><div class="sh"><h2 class="sm">iTRAQ 原始 WEB 功能</h2><span class="tag">依使用手冊功能模組對照</span></div><div class="subt">保留監控、車務、保修與通知的原始操作範圍；本作品的 AI 決策層建立在這些資料之上。</div><div class="module-grid"><div class="module-chip"><b>監控地圖 / 車輛定位</b><span>位置、狀態與基本車輛資訊</span></div><div class="module-chip"><b>即時影像 / 軌跡回放</b><span>行車影像調閱與歷史軌跡</span></div><div class="module-chip"><b>任務 / 事件 / 通知</b><span>任務派發、異常事件與推播中心</span></div><div class="module-chip"><b>保修 / 車輛 / 駕駛</b><span>保修履歷、車輛資料與駕駛管理</span></div><div class="module-chip"><b>營運月報 / 駕駛成績</b><span>月報圖表與安全駕駛成績</span></div><div class="module-chip"><b>管理行程</b><span>工作流程與調度歷程</span></div></div><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><a class="btn pri sm" href="index-desktop.html">開啟 iTRAQ 原始操作台</a><button class="btn gho sm" onclick="openManualChecklist()">查看手冊頁面對照</button></div></section>`);
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
  window.openManualChecklist = function () { showModal(`<h3>iTRAQ 使用手冊頁面對照</h3><p>原始 WEB 功能由操作台承接；AI 層使用其中的事件、車輛、駕駛、保修與營運資料，做權限分流與決策建議。</p><ul class="mini-checks"><li>頁 2–5：監控地圖、即時影像、軌跡回放、影像調閱</li><li>頁 6–9：任務管理、保修系統、保修資料、事件列表</li><li>頁 10–14：營運月報、車輛管理、駕駛管理、管理行程、駕駛成績</li><li>頁 15–16：車輛管理定位、通知中心</li></ul><div class="guardrail">本次新增的競賽、招募、薪酬與人資覆核，均是建立在上述原始資料能力之上。</div><div class="mb"><a class="btn pri" href="index-desktop.html">前往原始操作台</a><button class="btn gho" onclick="closeOv()">關閉</button></div>`); };
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
  window.aiContext = function () {
    if (SESSION && SESSION.role === 'shipper') { const order = myOrders()[0]; return { role:'shipper', name:SESSION.acc.name, company:myShipper().name, order, vehicle:order.car.split(' · ')[0] }; }
    return baseAiContext();
  };
  window.aiSuggestions = function () { if (SESSION && SESSION.role === 'shipper') return ['為什麼 ETA 有變化？', '貨件現在需要我做什麼？', '若延誤，系統會怎麼通知我？']; return baseAiSuggestions(); };
  window.aiGenerate = function (question) {
    if (SESSION && SESSION.role === 'shipper') { const c = aiContext(), o = c.order; if (/延誤|ETA|多久|到達/.test(question)) return `${AI_TAG} ${o.id} 目前預估 ${o.etaMin} 分鐘後到達。${o.risk ? '系統已偵測到壅塞，調度正在採用安全替代方案，若 ETA 再變動會立即推播。' : '運送節點正常，若出現安全或裝卸等待事件，會先保護駕駛並主動更新 ETA。'}`; if (/怠速|為什麼|狀況/.test(question)) return `${AI_TAG} 我只提供與貨況相關的摘要：${o.risk ? '本次 ETA 受市區壅塞與裝卸等待影響，調度已處理。' : '目前沒有影響 ETA 的異常。'} 為保護駕駛隱私與行車安全，不提供司機個資或精確位置。`; return `${AI_TAG} 我可以協助說明 ${o.id} 的 ETA、到貨通知與異常處理。這個介面不顯示地圖、司機聯絡方式，也不能取消訂單。`; }
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
    { id:'analytic', l:'分析', render:renderFleetAnalytics },
    { id:'people', l:'人力', render:renderPeopleDecision },
    { id:'competition', l:'競賽', render:renderFleetCompetition },
    { id:'me', l:'設定', render:renderFleetSettingsEnhanced }
  );
  TABS.lead.push({ id:'competition', l:'競賽', render:renderLeadCompetition });
  TABS.driver.splice(3, 0, { id:'competition', l:'排名', render:renderDriverCompetition });
  TABS.driver.find(tab => tab.id === 'home').render = renderDriverHomeEnhanced;
  TABS.driver.find(tab => tab.id === 'task').render = renderDriverTaskEnhanced;
  TABS.driver.find(tab => tab.id === 'alert').render = renderDriverAlertsEnhanced;
  TABS.shipper.find(tab => tab.id === 'track').render = renderShipperTrackEnhanced;
  TABS.shipper.find(tab => tab.id === 'orders').render = renderShipperOrdersEnhanced;
})();

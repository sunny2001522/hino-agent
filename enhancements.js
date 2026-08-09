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
    1:[['系統','iTRAQ WEB'],['資料來源','原始操作畫面']],
    2:[['部門篩選','(all)'],['搜尋結果','總計 23 筆'],['清單欄位','車號／駕駛／狀態／速度／位置']],
    3:[['影像畫面','4 路'],['已選車號','683-M6'],['行駛狀態','行駛中 · 70 km/h']],
    4:[['第一層','車號／駕駛／累積里程／總時長'],['第二層','啟動、熄火、累積時長、起訖點'],['第三層','點位時間、位置、車況、觸發事件']],
    5:[['查詢日期','2020-11-11'],['KLA-1111','144 段'],['SDC-1688','53 段']],
    6:[['查詢日期','2020-11-11'],['任務編號','20211115001–20211115010'],['示例車號','KLA-1111／KLA-9999']],
    7:[['篩選日期','2020-11-11–2020-11-11'],['前次保修里程','21,463 公里'],['保修引擎時數','10 小時']],
    8:[['預約車號','KLA-1111'],['預約編號','DDD123'],['示例日期','2021/12/14、2021/12/01']],
    9:[['查詢日期','2020-11-11'],['KLA-9999 全部事件','122'],['首列分類次數','4／2／5／5／2／46／46']],
    10:[['統計月份','2022-04'],['累積里程／油耗','394,300 公里／3,291 公升'],['平均油耗／費用','20 公里/公升／40,201 元']],
    11:[['部門篩選','(all)'],['搜尋結果','總計 23 筆'],['範例資料','KLA-9999 · 2021-08 · 17T']],
    12:[['範例手機','0911-389-291'],['綁定車輛','KLA-9312'],['可見成績','80／79／73／87／88']],
    13:[['查詢月份','2020-11'],['示例駕駛','AAA-1111／AAA-1112'],['行程狀態','待確認、駕駛 A、無駕駛']],
    14:[['駕駛','林興聯'],['總成績','100 分'],['里程／油耗','123,456 公里／987 公升']],
    15:[['圍籬名稱','豐盛、北部 PDS、台北港'],['顯示／進出通知','是／否'],['有效期限','已到期、永久有效、2021-11-09']],
    16:[['查詢日期','2020-11-11'],['通知類型','事件、任務、圍籬、語音、納管、平台、保修、成績、影像'],['預設顯示','全部通知']]
  };
  const itraqSections = {
    monitor: [2, 3],
    history: [4, 5],
    task: [6],
    maintenance: [7, 8],
    data: [9, 10],
    fleet: [11, 12, 13, 14, 15],
    settings: [16]
  };
  let currentManualPage = 2;
  let currentItraqSection = 'monitor';
  function sectionForPage(pageNo) { return Object.keys(itraqSections).find(key => itraqSections[key].includes(pageNo)) || 'monitor'; }
  function renderItraqPage(pageNo, section) { currentManualPage = pageNo; currentItraqSection = section || sectionForPage(pageNo); renderItraqWorkspace(); }
  const excelSource = { file:'output data_Hotai_20260511.xlsx', records:487510, vehicles:20, period:'2025-01-01 至 2025-11-30', driving:415256, idling:68551, parking:3703, speeding:57259 };
  const excelVehicleSnapshot = [
    { car:'ABC-5310', time:'2025-11-30 23:53:54', status:'停車', speed:0, limit:30, position:'121.283089, 25.086189', mileage:52356, fuel:11589, engine:3139.3 },
    { car:'ABC-6776', time:'2025-11-30 18:37:32', status:'停車', speed:0, limit:25, position:'121.073257, 24.778786', mileage:83474, fuel:36063.5, engine:3884.3 },
    { car:'ABC-7610', time:'2025-11-30 17:50:57', status:'停車', speed:0, limit:30, position:'121.549294, 23.861162', mileage:39098, fuel:18132.5, engine:3174.5 },
    { car:'ABC-7569', time:'2025-11-30 18:39:36', status:'停車', speed:0, limit:30, position:'120.313835, 23.101540', mileage:32244.1, fuel:4916.5, engine:878 },
    { car:'ABC-1999', time:'2025-11-21 18:07:11', status:'停車', speed:0, limit:50, position:'121.586815, 23.935158', mileage:20029.5, fuel:5555, engine:1560 },
    { car:'ABC-6325', time:'2025-11-21 17:00:13', status:'停車', speed:0, limit:30, position:'120.496475, 24.153843', mileage:28447.3, fuel:5156.5, engine:1119.8 }
  ];
  const nativeVehicles = excelVehicleSnapshot.map(vehicle => [vehicle.car,'—',vehicle.status,'—',vehicle.speed,vehicle.position,vehicle.time]);
  const nativeTasks = [
    ['執行中','20211115001','2/5','王曉明 / 0911-111-111','KLA-1111','綠豆糕','宏台 (10:00)'],
    ['調度中','20211115002','10/12','李曉明 / 0911-111-111','KLA-9999','文宣稿','和泰本場 (13:00)'],
    ['已完成','20211115003','1/8','吳小雯 / 0911-111-111','KLA-9999','餅乾盒','--'],
    ['已中斷','20211115004','0/3','陳曉明 / 0911-111-111','KLA-9999','文宣稿','--'],
    ['待執行','20211115005','0/3','陳曉明 / 0911-111-111','KLA-9999','菠蘿','大里車站 (18:00)']
  ];
  function nativeTable(headers, rows, tone) {
    return `<div class="native-table-wrap"><table class="native-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td${i === 0 && tone ? ` class="${tone(cell)}"` : ''}>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function nativeIconActions(...items) {
    return `<span class="native-row-actions">${items.map(([key, icon, label]) => `<button type="button" class="native-icon-action" data-itraq-action="${key}" aria-label="${label}" title="${label}">${icon}</button>`).join('')}</span>`;
  }
  function nativeTextAction(label, key='open') { return `<button type="button" class="native-text-action" data-itraq-action="${key}">${label}</button>`; }
  function nativeFilter({date='2020-11-11', search='搜尋車號／駕駛／姓名／車牌', actions='' } = {}) {
    return `<div class="native-filter"><button type="button" class="native-input" data-itraq-filter="date">◫&nbsp; ${date}</button><button type="button" class="native-input" data-itraq-filter="department">部門 (all)⌄</button><label class="native-search">⌕ <input value="" placeholder="${search}" aria-label="${search}"></label>${actions}</div>`;
  }
  function nativePager() { return `<div class="native-pager"><button type="button" class="native-page-size" data-itraq-action="page-size">每頁資料筆數: 10⌄</button><span><button type="button" data-itraq-page="prev">‹</button><button type="button" class="on" data-itraq-page="1">1</button><button type="button" data-itraq-page="2">2</button><button type="button" data-itraq-page="3">3</button><button type="button" data-itraq-page="4">4</button><button type="button" data-itraq-page="next">›</button></span></div>`; }
  function nativePageTitle(title, trail) {
    const pageCount = (itraqSections[currentItraqSection] || []).length;
    return `<div class="native-breadcrumb"><span class="native-crumb-text">${trail || '車隊管理'} <i>›</i> ${title}</span>${pageCount > 1 ? '<button type="button" class="native-page-menu" onclick="openItraqPageMenu()">切換功能⌄</button>' : ''}</div>`;
  }
  function nativeSectionLabel(pageNo) {
    if ([2, 3].includes(pageNo)) return '即時監控';
    if ([4, 5].includes(pageNo)) return '歷史車輛';
    if (pageNo === 6) return '任務派遣';
    if ([7, 8].includes(pageNo)) return '保修系統';
    if ([9, 10].includes(pageNo)) return '數據中心';
    if ([11, 12, 13, 14, 15].includes(pageNo)) return '車隊管理';
    return '系統設定';
  }
  function nativeMap() {
    return `<div class="native-map"><i class="road road-a"></i><i class="road road-b"></i><i class="road road-c"></i><i class="water"></i><span class="map-label label-a">新莊生命禮儀</span><span class="map-label label-b">大立企業社</span><button type="button" class="map-pin pin-run" data-itraq-action="vehicle">▶</button><button type="button" class="map-pin pin-idle" data-itraq-action="vehicle">Ⅱ</button><button type="button" class="map-pin pin-off" data-itraq-action="vehicle">×</button><button type="button" class="map-fence" data-itraq-action="fence">北部PDS</button></div>`;
  }
  function nativeMonitor() {
    return `<div class="native-workspace"><div class="native-monitor-layout"><div><div class="native-map-switch"><button class="on">車號</button><button class="on">駕駛</button><button class="on">速度</button><button class="on">電子圍籬</button></div>${nativeMap()}</div><div class="native-list-panel"><b>Excel 資料：${excelSource.vehicles} 台車輛 / ${excelSource.records.toLocaleString()} 筆紀錄</b>${nativeTable(['車號 ↕','駕駛 ↕','車輛狀態 ↕','手機號碼 ↕','車速(km/h) ↕','經緯度 ↕','最後紀錄時間 ↕'], nativeVehicles, state => state === '行駛中' ? 'run' : state.includes('怠速') ? 'idle' : 'lost')}</div></div></div>`;
  }
  function nativeVideoLive() {
    return `<div class="native-workspace"><div class="native-video-layout"><div class="native-video-grid"><div class="video-tile v1"><b>①</b><span>前鏡頭 · ABC-5310</span></div><div class="video-tile v2"><b>②</b><span>右側鏡頭</span></div><div class="video-tile v3"><b>③</b><span>左側鏡頭</span></div><div class="video-tile v4"><b>④</b><span>後鏡頭</span></div></div><div class="native-list-panel"><b>雙擊車輛即可查看即時影像</b>${nativeTable(['車號','駕駛','車輛狀態','手機號碼','車速(km/h)','經緯度','最後紀錄時間'], nativeVehicles.slice(0,4), state => state === '行駛中' ? 'run' : 'lost')}</div></div></div>`;
  }
  function nativeJourneyHierarchy() {
    return `<div class="native-workspace"><div class="journey-flow"><article><b>第一層</b><div><strong>單日車隊內所有車輛歷史軌跡列表</strong><span>車號、駕駛、累積里程數、行駛總時長</span></div></article><article><b>第二層</b><div><strong>單日單一車輛的所有軌跡列表</strong><span>每一行程的啟動與熄火時間、累積時長及起訖點</span></div></article><article><b>第三層</b><div><strong>單日單一車輛單一軌跡的各點位列表</strong><span>點位時間、位置、車輛狀態、觸發事件</span></div></article></div></div>`;
  }
  function nativeVideoArchive() {
    const rows = [['KLA-1111','144'],['KLA-1234','33'],['ABC-1234','7'],['SDC-1688','53'],['AAAB-123','34'],['KLA-2222','132'],['KLA-3333','32']];
    return `<div class="native-workspace native-video-archive"><div class="archive-grid"><div class="archive-empty"><span>請點選右側車輛列表，並擇一時段進行影像播放</span></div><aside><div class="native-filter"><button type="button" class="native-input" data-itraq-filter="vehicle">車號 (all)⌄</button><button type="button" class="native-input" data-itraq-filter="date">◫ 2020-11-11</button></div>${nativeTable(['車號','檔案數量'],rows)}</aside></div></div>`;
  }
  function nativeTaskTable() {
    return `<div class="native-workspace">${nativeFilter({actions:'<button type="button" class="native-action">＋ 新增任務</button><button type="button" class="native-action">⇧ 批量匯入</button>'})}<div class="native-tabs"><button type="button" class="on">依任務</button><button type="button">依駕駛</button></div>${nativeTable(['任務狀態 ↕','任務編號 ↕','進度 ↕','駕駛/手機號碼 ↕','車號 ↕','任務類型 ↕','下一站點 ↕','操作'], nativeTasks.map(r => [...r,nativeIconActions(['edit','✎','編輯任務'],['copy','▢','複製任務'],['refresh','♲','更新狀態'])]), state => ({'執行中':'running','調度中':'dispatch','已完成':'done','已中斷':'stopped','待執行':'pending'}[state]))}${nativePager()}</div>`;
  }
  function nativeMaintenance() {
    const rows = [['KLA-1111','--','尚未設定','尚未設定','--','--',nativeTextAction('設定','edit')],['KLA-1112','--','2023/02/12','25,262','9,732','--',nativeTextAction('查看','open')],['KLA-1113','KASE23','2023/02/12','25,262','9,732','定期保養',nativeTextAction('編輯','edit')],['KLA-1114','--','--','0','0','--',nativeTextAction('設定','edit')],['KLA-1115','KASE23','2023/05/02','456,215','9,732','定期保養',nativeTextAction('查看','open')]];
    return `<div class="native-workspace">${nativeFilter({date:'2020-11-11 - 2020-11-11'})}<div class="native-tabs"><button type="button" class="on" data-itraq-view="maintenance-cycle">車輛週期一覽</button><button type="button" data-itraq-page="8">預約資料</button><button type="button" data-itraq-view="work-order">工單資料</button></div>${nativeTable(['車號 ↕','工單編號 ↕','保修日期 ↕','總里程數 ↕','引擎運轉時數 ↕','保修項目 ↕','操作'],rows)}<div class="native-maint-cards"><div><b>前次保修值設定</b><span>保修日期 2022-06-08</span><span>保修總里程數 21,463 公里</span><span>保修引擎運轉時數 10 小時</span><button type="button" data-itraq-action="confirm-maintenance">確認</button></div><div><b>保修項目週期排程 - KLA-1111</b><span>煞車保養 10,000 → 預估 25,680</span><span>引擎運轉時數 200 → 預估 450</span></div></div></div>`;
  }
  function nativeAppointments() {
    const rows = [['已預約','原廠','KLA-1111','王曉明','2021/12/14','DDD123','大盛保修廠','全天候皆可','定期保養',nativeTextAction('查看','open')],['已預約','原廠','KLA-1111','王曉明','2021/12/01','DDD123','大盛保修廠','09:00-12:00','定期保養',nativeTextAction('查看','open')],['已進廠','原廠','KLA-1111','王曉明','2021/11/24','DDD123','大盛保修廠','09:00-12:00','其他',nativeTextAction('查看','open')],['已逾期','原廠','KLA-1111','王曉明','2021/10/14','DDD123','大盛保修廠','09:00-12:00','定期保養',nativeTextAction('查看','open')]];
    return `<div class="native-workspace">${nativeFilter({date:'2020-11-11 - 2020-11-11',actions:'<button type="button" class="native-action">⇩ 匯出資料</button><button type="button" class="native-action">◷ 預約原廠</button>'})}<div class="native-tabs"><button type="button" data-itraq-page="7">車輛週期一覽</button><button type="button" class="on">預約資料</button><button type="button" data-itraq-view="work-order">工單資料</button></div>${nativeTable(['狀態 ↕','類別 ↕','車號 ↕','聯絡人 ↕','預約日期 ↕','預約編號 ↕','服務廠 ↕','預計進廠時段 ↕','派工項目 ↕','操作'],rows, state => state === '已預約' ? 'pending' : state === '已進廠' ? 'running' : 'stopped')}${nativePager()}</div>`;
  }
  function nativeEvents() {
    const rows = [['事件類型 8','26,428','event[0..2].type','2025-01-01 ～ 2025-11-30'],['事件類型 11','20,457','event[0..2].type','2025-01-01 ～ 2025-11-30'],['事件類型 7','18,470','event[0..2].type','2025-01-01 ～ 2025-11-30'],['事件類型 13','13,549','event[0..2].type','2025-01-01 ～ 2025-11-30'],['事件類型 16','4,998','event[0..2].type','2025-01-01 ～ 2025-11-30'],['事件類型 20','4,025','event[0..2].type','2025-01-01 ～ 2025-11-30']];
    return `<div class="native-workspace">${nativeFilter({date:'2025-01-01 - 2025-11-30',actions:'<button type="button" class="native-action">⇩ 匯出報表</button>'})}<div class="native-list-panel"><b>Excel 事件欄位彙整 · ${excelSource.records.toLocaleString()} 筆行車紀錄</b>${nativeTable(['事件類型 ↕','發生筆數 ↕','來源欄位 ↕','統計期間 ↕'],rows)}${nativePager()}</div></div>`;
  }
  function nativeReport() {
    const bars = [85.2,14.1,.8];
    return `<div class="native-workspace report-page"><div class="report-head"><button type="button" class="native-input" data-itraq-filter="month">2025-01 ～ 2025-11</button><span>Excel 資料期間：${excelSource.period}</span><button type="button" class="native-action">⇩ 匯出月報</button></div><div class="report-kpis"><div><span>納管車輛</span><b>${excelSource.vehicles}台</b></div><div><span>行車紀錄</span><b>${excelSource.records.toLocaleString()}筆</b></div><div><span>行駛中</span><b>${excelSource.driving.toLocaleString()}筆</b></div><div><span>怠速</span><b>${excelSource.idling.toLocaleString()}筆</b></div><div><span>停車</span><b>${excelSource.parking.toLocaleString()}筆</b></div><div><span>超速紀錄</span><b>${excelSource.speeding.toLocaleString()}筆</b></div><div><span>資料來源</span><b>Excel</b></div></div><div class="report-grid"><article><h3>車輛狀態占比</h3><div class="native-bars">${bars.map((h,i)=>`<i style="height:${h}%" title="${['行駛中 85.2%','怠速 14.1%','停車 0.8%'][i]}"></i>`).join('')}</div><p>行駛中 85.2% · 怠速 14.1% · 停車 0.8%</p></article><article><h3>超速風險摘要</h3><div class="report-task"><b>${excelSource.speeding.toLocaleString()} 筆 GPS 速度高於路段限速</b><b>資料以 GPS 速度與 speedLimit 欄位比對</b><b>須再由車隊依路況與設備資料複核</b></div></article><article><h3>最新車況</h3><div class="report-maint"><b>${excelVehicleSnapshot[0].car} · ${excelVehicleSnapshot[0].mileage.toLocaleString()} km</b><b>${excelVehicleSnapshot[1].car} · ${excelVehicleSnapshot[1].mileage.toLocaleString()} km</b><b>${excelVehicleSnapshot[2].car} · ${excelVehicleSnapshot[2].mileage.toLocaleString()} km</b></div></article><article><h3>資料欄位</h3><div class="report-task"><b>車號、時間、狀態、GPS、里程、油耗、引擎時數</b><b>以及事件類型與事件發生時間</b><b>資料檔：${excelSource.file}</b></div></article></div></div>`;
  }
  function nativeVehiclesPage() {
    const rows = excelVehicleSnapshot.map(vehicle => [vehicle.car,vehicle.status,vehicle.time,vehicle.speed,vehicle.limit,vehicle.mileage.toLocaleString(),vehicle.fuel.toLocaleString(),vehicle.engine.toLocaleString(),vehicle.position,nativeIconActions(['edit','✎','編輯車輛'],['refresh','♲','重新納管'],['delete','▢','刪除車輛'])]);
    return `<div class="native-workspace">${nativeFilter({search:'搜尋車號／狀態／經緯度…',actions:'<button type="button" class="native-action">＋ 新增車輛</button>'})}${nativeTable(['車號 ↕','車輛狀態 ↕','最後紀錄時間 ↕','GPS速度 ↕','路段限速 ↕','總里程(km) ↕','總油耗(L) ↕','引擎時數 ↕','經緯度 ↕','操作'],rows)}${nativePager()}</div>`;
  }
  function nativeDriversPage() {
    const rows = [['0911-389-291','陳曉明','專案部','A102******','KLA-9312','80',nativeIconActions(['edit','✎','編輯駕駛'],['delete','▢','刪除駕駛'])],['0911-389-291','陳志明','專案部','A102******','KLA-9312','79',nativeIconActions(['edit','✎','編輯駕駛'],['delete','▢','刪除駕駛'])],['0911-389-291','陳志明','專案部','A102******','KLA-9312','73',nativeIconActions(['edit','✎','編輯駕駛'],['delete','▢','刪除駕駛'])],['0911-389-291','陳曉明','專案部','A102******','KLA-9312','87',nativeIconActions(['edit','✎','編輯駕駛'],['delete','▢','刪除駕駛'])],['0911-389-291','陳曉明','專案部','A102******','KLA-9312','88',nativeIconActions(['edit','✎','編輯駕駛'],['delete','▢','刪除駕駛'])],['0911-223-344','王曉明','研發部','A102******','KLA-1294','64',nativeIconActions(['edit','✎','編輯駕駛'],['delete','▢','刪除駕駛'])]];
    return `<div class="native-workspace">${nativeFilter({date:'2020-11',search:'搜尋手機號碼/姓名/車號…',actions:'<button type="button" class="native-action">▣ 管理行程</button><button type="button" class="native-action">＋ 新增駕駛</button>'})}${nativeTable(['手機號碼 ↕','姓名 ↕','歸屬部門 ↕','身分證字號 ↕','所屬車輛 ↕','駕駛成績 ↕','操作'],rows)}${nativePager()}</div>`;
  }
  function nativeManagedJourneys() {
    const rows = [['2022-01-01','13:40:02 - 15:12:12','待確認','數位大餅 A駕駛','任務配給 B駕駛','系統預設 B駕駛',nativeTextAction('儲存','save')],['2022-01-01','13:40:02 - 15:12:12','駕駛A','數位大餅 A駕駛','任務配給 A駕駛','系統預設 A駕駛',nativeTextAction('編輯','edit')],['2022-01-01','13:40:02 - 15:12:12','無駕駛','數位大餅','任務配給','系統預設',nativeTextAction('儲存','save')]];
    return `<div class="native-workspace">${nativeFilter({date:'2020-11',search:'搜尋手機號碼/姓名/車號…',actions:'<button type="button" class="native-action">▣ 結算成績</button>'})}<div class="journey-group"><h3>AAA-1111⌃</h3>${nativeTable(['日期 ↕','行程起訖時間 ↕','行程歸屬駕駛 ↕','備註 ↕','任務配給','系統預設','操作'],rows)}</div><div class="journey-group"><h3>AAA-1112⌃</h3>${nativeTable(['日期 ↕','行程起訖時間 ↕','行程歸屬駕駛 ↕','備註 ↕','任務配給','系統預設','操作'],rows.slice(1))}</div></div>`;
  }
  function nativeScore() {
    return `<div class="native-workspace score-page"><div class="score-head"><button type="button" class="native-input" data-itraq-filter="month">‹　2020-12　›</button><button type="button" class="native-action">⇩ 匯出成績單</button></div><div class="score-layout"><aside><h2>林興聯</h2><span>手機號碼 0900-000-000</span><span>部門 資車部</span><span>結算期間 12-01 ~ 12-31</span><hr><span>行駛總里程數 <b>123,456公里</b></span><span>引擎運轉總時數 <b>87小時</b></span><span>總油耗 <b>987公升</b></span><span>平均車速 <b>87.6 km/h</b></span><span>平均油耗 <b>12.4 km/L</b></span><span>事件發生次數 <b>678次</b></span></aside><article><h2>總成績 <b>100分</b></h2><div class="native-tabs"><button type="button" class="on">車速分析</button><button type="button">怠速分析</button><button type="button">油門分析</button><button type="button">急加減速分析</button><button type="button">轉速分析</button></div><div class="speed-pie"></div><p>各速度區間時間佔比 · 怠速總時間 10.9 分鐘 · 車速分析得分 3.8%</p></article></div></div>`;
  }
  function nativeFence() {
    const rows = [['豐盛','否','否','已到期',nativeIconActions(['edit','✎','編輯圍籬'],['delete','▢','刪除圍籬'])],['北部PDS','是','是','永久有效',nativeIconActions(['edit','✎','編輯圍籬'],['delete','▢','刪除圍籬'])],['北部PDS','是','是','2021-11-09',nativeIconActions(['edit','✎','編輯圍籬'],['delete','▢','刪除圍籬'])],['泛台','是','是','2021-11-09',nativeIconActions(['edit','✎','編輯圍籬'],['delete','▢','刪除圍籬'])],['台北港','是','是','已到期',nativeIconActions(['edit','✎','編輯圍籬'],['delete','▢','刪除圍籬'])],['泛台','否','否','2021-11-09',nativeIconActions(['edit','✎','編輯圍籬'],['delete','▢','刪除圍籬'])]];
    return `<div class="native-workspace"><div class="native-fence-layout"><div>${nativeMap()}</div><div><button type="button" class="native-action">＋ 新增圍籬</button>${nativeTable(['圍籬名稱 ↕','顯示','進出通知設定 ↕','時效性 ↕','操作'],rows)}</div></div></div>`;
  }
  function nativeNotification() {
    const rows = [['週期預警','DKP-5478 預計剩餘1,000公里，建議檢查定期的服務與保修狀況','前往預約','2021-11-04 14:32:12'],['保修結果','DKP-5478 已成功預約 2021-11-23 進廠保修','前往查看','2021-11-04 14:32:12'],['保修結果','DKP-5478 預約 2021-11-21 進廠保修','前往設定','2021-11-04 14:32:12'],['原廠工單','有 6 筆原廠工單，請於工單資料內完成設定保修週期','前往設定','2021-11-04 14:32:12']];
    return `<div class="native-workspace">${nativeFilter({date:'2020-11-11'})}<div class="native-tabs notification-tabs"><button type="button" class="on">全部</button><button type="button">事件通知</button><button type="button">任務通知</button><button type="button">圍籬通知</button><button type="button">語音通知</button><button type="button">納管通知</button><button type="button">平台通知</button><button type="button">保修通知</button><button type="button">駕駛成績</button><button type="button">影像通知</button></div>${nativeTable(['','通知類型','內容','操作','時間'],rows.map(row => ['♧',row[0],row[1],nativeTextAction(row[2]),row[3]]))}${nativePager()}</div>`;
  }
  function renderItraqNative(pageNo) {
    return ({2:nativeMonitor,3:nativeVideoLive,4:nativeJourneyHierarchy,5:nativeVideoArchive,6:nativeTaskTable,7:nativeMaintenance,8:nativeAppointments,9:nativeEvents,10:nativeReport,11:nativeVehiclesPage,12:nativeDriversPage,13:nativeManagedJourneys,14:nativeScore,15:nativeFence,16:nativeNotification}[pageNo] || nativeMonitor)();
  }
  function renderItraqWorkspace() {
    const pageIds = itraqSections[currentItraqSection] || itraqSections.monitor;
    const pages = pageIds.map(pageNo => manualPages.find(item => item.p === pageNo)).filter(Boolean);
    const page = pages.find(item => item.p === currentManualPage) || pages[0];
    screen.innerHTML = `<section class="itraq-native">${nativePageTitle(page.t, nativeSectionLabel(page.p))}${renderItraqNative(page.p)}</section>`;
  }
  function nativeForm(title, hint, confirmLabel='儲存') {
    showModal(`<h3>${title}</h3><p>${hint}</p><div class="native-modal-fields"><label>名稱／車號<input type="text" placeholder="請輸入資料"></label><label>備註<textarea placeholder="可補充說明（選填）"></textarea></label></div><div class="mb"><button class="btn gho" onclick="closeOv()">取消</button><button class="btn pri" onclick="closeOv();toast('${title}已送出','這是原型操作，資料不會覆蓋原始紀錄。','ok')">${confirmLabel}</button></div>`);
  }
  function nativeActionFeedback(label) {
    const text = label.replace(/[＋⇧⇩◷▣]/g, '').trim();
    if (/新增任務|新增車輛|新增駕駛|新增圍籬|預約原廠/.test(text)) { nativeForm(text, '請填寫必要資訊後送出；原型會保留原始資料並顯示操作回饋。', /預約/.test(text) ? '送出預約' : '新增'); return; }
    if (/管理行程/.test(text)) { renderItraqPage(13, 'fleet'); return; }
    if (/結算成績/.test(text)) { showModal(`<h3>結算駕駛成績</h3><p>僅在月內無待確認違反資料時，才能結算成績。原型會先送交主管覆核。</p><div class="mb"><button class="btn gho" onclick="closeOv()">取消</button><button class="btn pri" onclick="closeOv();toast('已送交成績覆核','主管確認後才會結算。','ok')">送交覆核</button></div>`); return; }
    if (/匯出/.test(text)) { toast('匯出已建立', `${text}已準備完成，原型不會下載或傳送外部資料。`, 'ok'); return; }
    toast('操作已接收', `${text || '此功能'}已完成原型操作。`, 'ok');
  }
  function nativeFilterDialog(kind, label) {
    const title = kind === 'department' ? '選擇部門' : kind === 'month' ? '選擇統計月份' : kind === 'vehicle' ? '選擇車號' : '選擇日期';
    showModal(`<h3>${title}</h3><p>目前條件：${label}</p><div class="native-modal-fields"><label>${title}<input type="text" value="${label.replace(/[◫⌄‹›]/g, '').trim()}"></label></div><div class="mb"><button class="btn gho" onclick="closeOv()">取消</button><button class="btn pri" onclick="closeOv();toast('篩選已套用','畫面已依選擇條件更新。','ok')">套用</button></div>`);
  }
  function updateNativePager(pager, target) {
    const numbers = [...pager.querySelectorAll('[data-itraq-page]')].filter(button => /^\d+$/.test(button.dataset.itraqPage));
    const current = Number((numbers.find(button => button.classList.contains('on')) || numbers[0]).dataset.itraqPage);
    const next = target === 'prev' ? Math.max(1, current - 1) : target === 'next' ? Math.min(numbers.length, current + 1) : Number(target);
    numbers.forEach(button => button.classList.toggle('on', Number(button.dataset.itraqPage) === next));
    toast(`已切換第 ${next} 頁`, '原型資料維持目前頁面示例。', 'ok');
  }
  function attachItraqInteractions() {
    screen.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !screen.contains(button) || button.classList.contains('itraq-web-tab')) return;
      const pager = button.closest('.native-pager');
      if (pager && button.dataset.itraqPage) { updateNativePager(pager, button.dataset.itraqPage); return; }
      if (button.dataset.itraqPage && /^\d+$/.test(button.dataset.itraqPage)) { renderItraqPage(Number(button.dataset.itraqPage), sectionForPage(Number(button.dataset.itraqPage))); return; }
      if (button.closest('.native-tabs')) {
        const tabbar = button.closest('.native-tabs');
        tabbar.querySelectorAll('button').forEach(item => item.classList.toggle('on', item === button));
        if (button.dataset.itraqView === 'work-order') { showModal(`<h3>工單資料</h3><p>原廠工單需先完成保修週期設定，才能納入週期排程。</p><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); return; }
        const scoreText = screen.querySelector('.score-layout article > p');
        if (scoreText) scoreText.textContent = `${button.textContent}已切換 · 依駕駛成績資料顯示該項風險趨勢。`;
        toast('檢視已切換', `目前顯示：${button.textContent}。`, 'ok');
        return;
      }
      if (button.closest('.native-map-switch')) { button.classList.toggle('on'); toast('地圖圖層已更新', `${button.textContent}顯示已${button.classList.contains('on') ? '開啟' : '關閉'}。`, 'ok'); return; }
      if (button.dataset.itraqFilter) { nativeFilterDialog(button.dataset.itraqFilter, button.textContent); return; }
      if (button.dataset.itraqAction) {
        const labels = { edit:'編輯資料', copy:'已複製任務', refresh:'已更新納管狀態', delete:'刪除資料', save:'已儲存行程', open:'已開啟通知', vehicle:'車輛即時資訊', fence:'電子圍籬資訊', 'confirm-maintenance':'保修值已確認', 'page-size':'每頁資料筆數' };
        const action = button.dataset.itraqAction;
        if (action === 'delete') { showModal(`<h3>刪除資料</h3><p>此原型不會直接刪除原始資料。確認後會送出刪除申請供主管覆核。</p><div class="mb"><button class="btn gho" onclick="closeOv()">取消</button><button class="btn dng" onclick="closeOv();toast('已送出刪除申請','原始資料未被刪除。','wn')">送出申請</button></div>`); return; }
        if (action === 'edit') { nativeForm('編輯資料', '請修改資料後送出；原型不會覆蓋原始紀錄。', '儲存變更'); return; }
        if (action === 'vehicle') { showModal(`<h3>車輛即時資訊</h3><p>683-M6 · 行駛中 · 70 km/h</p><p>可由此查看行駛狀態與安全事件摘要。</p><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); return; }
        if (action === 'fence') { showModal(`<h3>北部PDS 電子圍籬</h3><p>進出通知：已開啟；有效期限：永久有效。</p><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); return; }
        if (action === 'page-size') { button.textContent = button.textContent.includes('10') ? '每頁資料筆數: 20⌄' : '每頁資料筆數: 10⌄'; toast('每頁資料筆數已更新', button.textContent, 'ok'); return; }
        toast(labels[action] || '操作已完成', '原型操作已收到，原始資料維持不變。', action === 'delete' ? 'wn' : 'ok');
        return;
      }
      if (button.classList.contains('native-action')) { nativeActionFeedback(button.textContent); return; }
    });
    screen.addEventListener('input', event => {
      if (!event.target.matches('.native-search input')) return;
      const query = event.target.value.trim().toLowerCase();
      const workspace = event.target.closest('.native-workspace');
      workspace.querySelectorAll('.native-table tbody tr').forEach(row => { row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query); });
    });
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
    foot.insertAdjacentHTML('beforebegin', `<section><div class="sh"><h2 class="sm">iTRAQ WEB 功能</h2><span class="tag">監控、車務、保修與通知</span></div><div class="module-grid"><div class="module-chip"><b>監控地圖 / 車輛定位</b><span>位置、狀態與基本車輛資訊</span></div><div class="module-chip"><b>即時影像 / 軌跡回放</b><span>行車影像調閱與歷史軌跡</span></div><div class="module-chip"><b>任務 / 事件 / 通知</b><span>任務派發、異常事件與推播中心</span></div><div class="module-chip"><b>保修 / 車輛 / 駕駛</b><span>保修履歷、車輛資料與駕駛管理</span></div><div class="module-chip"><b>營運月報 / 駕駛成績</b><span>月報圖表與安全駕駛成績</span></div><div class="module-chip"><b>管理行程 / 圍籬</b><span>工作流程、電子圍籬與進出通知</span></div></div><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn pri sm" onclick="gotoTab('monitor')">開啟 iTRAQ WEB</button></div></section>`);
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
  window.openManualChecklist = function () { gotoTab('monitor'); };
  window.selectManualPage = function (page) { renderItraqPage(page, sectionForPage(page)); };
  window.openItraqPageMenu = function () {
    const pages = (itraqSections[currentItraqSection] || []).map(pageNo => manualPages.find(item => item.p === pageNo)).filter(Boolean);
    showModal(`<h3>切換功能</h3><div class="native-page-menu-list">${pages.map(page => `<button class="btn ${page.p === currentManualPage ? 'pri' : 'gho'} block" onclick="selectManualPage(${page.p});closeOv()">${page.t}</button>`).join('')}</div><div class="mb"><button class="btn gho" onclick="closeOv()">取消</button></div>`);
  };
  window.openItraqNotifications = function () {
    if (!SESSION || SESSION.role !== 'fleet') { toast('通知中心', '請由目前身份可見的通知頁面查看。', 'in'); return; }
    curTab = null;
    tabbar.querySelectorAll('button').forEach(button => button.classList.remove('on'));
    renderItraqPage(16, 'settings');
    screen.scrollTo({top:0,behavior:'smooth'});
  };
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

  attachItraqInteractions();

  TABS.fleet.splice(0, TABS.fleet.length,
    { id:'monitor', l:'即時監控', render:() => renderItraqPage(2, 'monitor') },
    { id:'history', l:'歷史車輛', render:() => renderItraqPage(4, 'history') },
    { id:'task', l:'任務派遣', render:() => renderItraqPage(6, 'task') },
    { id:'maintenance', l:'保修系統', render:() => renderItraqPage(7, 'maintenance') },
    { id:'data', l:'數據中心', render:() => renderItraqPage(9, 'data') },
    { id:'fleet', l:'車隊管理', render:() => renderItraqPage(11, 'fleet') },
    { id:'settings', l:'系統設定', render:() => renderItraqPage(16, 'settings') },
    { id:'decision', l:'管理決策', render:renderFleetTodo },
    { id:'people', l:'人力管理', render:renderPeopleDecision },
    { id:'competition', l:'安全競賽', render:renderFleetCompetition },
    { id:'ai', l:'AI 分析', render:renderFleetAnalytics }
  );
  TABS.lead.splice(0, TABS.lead.length,
    { id:'monitor', l:'即時監控', render:() => renderItraqPage(2, 'monitor') },
    { id:'history', l:'歷史車輛', render:() => renderItraqPage(4, 'history') },
    { id:'task', l:'任務派遣', render:() => renderItraqPage(6, 'task') },
    { id:'maintenance', l:'保修系統', render:() => renderItraqPage(7, 'maintenance') },
    { id:'data', l:'數據中心', render:() => renderItraqPage(9, 'data') },
    { id:'fleet', l:'車隊管理', render:() => renderItraqPage(11, 'fleet') },
    { id:'settings', l:'系統設定', render:() => renderItraqPage(16, 'settings') },
    { id:'kpi', l:'本區管理', render:renderLeadKpi },
    { id:'focus', l:'管理重點', render:renderLeadFocus },
    { id:'drivers', l:'駕駛', render:renderLeadDrivers },
    { id:'competition', l:'安全競賽', render:renderLeadCompetition }
  );
  TABS.driver.splice(3, 0, { id:'competition', l:'排名', render:renderDriverCompetition });
  TABS.driver.find(tab => tab.id === 'home').render = renderDriverHomeEnhanced;
  TABS.driver.find(tab => tab.id === 'task').render = renderDriverTaskEnhanced;
  TABS.driver.find(tab => tab.id === 'alert').render = renderDriverAlertsEnhanced;
  TABS.shipper.find(tab => tab.id === 'track').render = renderShipperTrackEnhanced;
  TABS.shipper.find(tab => tab.id === 'orders').render = renderShipperOrdersEnhanced;
})();

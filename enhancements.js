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
    if (/怠速/.test(driver.i) || region.idlePct >= 14) reasons.push('等候超過 90 秒熄火');
    if (/高引擎負載/.test(driver.i)) reasons.push('出車前確認車況與派車條件');
    if (/DTC/.test(driver.i)) reasons.push('完成保修人員的故障碼覆核');
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
        <div class="rankmain"><b>${region.name}車隊${region.id === highlightId ? ' · 我的車隊' : ''}</b><span>計算安全分 ${score} · 遙測風險紀錄率 ${region.anomaly}% · ${improve ? '距 70 分差 ' + improve + ' 分' : '已達安全獎勵門檻'}</span></div>
        <div class="rankscore" style="color:${scoreColor(score)}">${score}<small>安全分</small></div>
      </div>`;
    }).join('');
  }
  function competitionRules() {
    return `<div class="guardrail"><b>競賽護欄：</b>資料檔沒有駕駛姓名，系統以車號做私密個人名次。分數以超速、怠速、高引擎負載與 DTC 計算；團隊可比較、車號個別名次不公開。不得以分數直接加薪、扣薪或解雇。</div>`;
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
    2:[['納管車輛',`${window.HINO_EXCEL_DATA.meta.vehicles} 台`],['行車紀錄',`${window.HINO_EXCEL_DATA.meta.records.toLocaleString()} 筆`],['清單欄位','車號／狀態／速度／位置']],
    3:[['影像畫面','4 路模擬 DVR'],['車號','ABC-5310'],['資料狀態','來源未提供真實影像檔']],
    4:[['第一層','車號／駕駛／累積里程／總時長'],['第二層','啟動、熄火、累積時長、起訖點'],['第三層','點位時間、位置、車況、觸發事件']],
    5:[['資料期間',window.HINO_EXCEL_DATA.meta.period],['納管車輛',`${window.HINO_EXCEL_DATA.meta.vehicles} 台`],['影像檔','來源未提供']],
    6:[['資料期間',window.HINO_EXCEL_DATA.meta.period],['journeyCode','來源可追溯'],['任務／站點','來源未提供']],
    7:[['資料期間',window.HINO_EXCEL_DATA.meta.period],['保修工單','來源未提供'],['可用資料','DTC 與最後遙測時間']],
    8:[['預約資料','來源未提供'],['可建立項目','DTC 覆核需求'],['服務廠','待串接']],
    9:[['資料期間',window.HINO_EXCEL_DATA.meta.period],['事件來源','GPS、車況與 DTC 欄位'],['可用指標','超速／怠速／高引擎負載／DTC']],
    10:[['統計期間',window.HINO_EXCEL_DATA.meta.period],['行車紀錄',`${window.HINO_EXCEL_DATA.meta.records.toLocaleString()} 筆`],['費用／準時率','來源未提供']],
    11:[['納管車輛',`${window.HINO_EXCEL_DATA.meta.vehicles} 台`],['車號來源','carNum'],['車輛主檔','部分欄位待串接']],
    12:[['駕駛姓名／電話','來源未提供'],['可見車號',window.HINO_EXCEL_DATA.vehicleSnapshot[0].c],['可見成績','系統計算安全分']],
    13:[['journeyCode','來源提供'],['駕駛歸屬','來源未提供'],['行程狀態','以最後遙測狀態呈現']],
    14:[['車號',window.HINO_EXCEL_DATA.vehicleSnapshot[0].c],['計算安全分',`${window.HINO_EXCEL_DATA.vehicleSnapshot[0].s} 分`],['里程／油耗','原始計數器欄位待整合']],
    15:[['圍籬資料','來源未提供'],['可用位置','GPS 經緯度'],['進出規則','待串接']],
    16:[['資料期間',window.HINO_EXCEL_DATA.meta.period],['通知類型','遙測異常摘要'],['保修／影像通知','需串接來源']]
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
  // Desktop subpages belong to their iTRAQ header item; desktop reveals them on hover.
  window.HEADER_SUBPAGES = {
    monitor: [{ p:2, l:'監控地圖' }, { p:3, l:'即時影像' }],
    history: [{ p:4, l:'軌跡回放' }, { p:5, l:'影像調閱' }],
    maintenance: [{ p:7, l:'車輛週期' }, { p:8, l:'預約資料' }],
    data: [{ p:9, l:'事件列表' }, { p:10, l:'營運月報' }],
    fleet: [{ p:11, l:'車輛管理' }, { p:12, l:'駕駛管理' }, { p:13, l:'管理行程' }, { p:14, l:'駕駛成績' }, { p:15, l:'圍籬管理' }]
  };
  let currentManualPage = 2;
  let currentItraqSection = 'monitor';
  let currentReportMonth = Math.max(0, window.HINO_EXCEL_DATA.months.length - 1);
  function sectionForPage(pageNo) { return Object.keys(itraqSections).find(key => itraqSections[key].includes(pageNo)) || 'monitor'; }
  function renderItraqPage(pageNo, section) { currentManualPage = pageNo; currentItraqSection = section || sectionForPage(pageNo); renderItraqWorkspace(); }
  const excelSource = { file:window.HINO_EXCEL_DATA.meta.sourceFile, records:window.HINO_EXCEL_DATA.meta.records, vehicles:window.HINO_EXCEL_DATA.meta.vehicles, period:window.HINO_EXCEL_DATA.meta.period };
  let excelVehicleSnapshot = [
    { car:'ABC-5310', time:'2025-11-30 23:53:54', status:'停車', speed:0, limit:30, position:'121.283089, 25.086189', mileage:52356, fuel:11589, engine:3139.3 },
    { car:'ABC-6776', time:'2025-11-30 18:37:32', status:'停車', speed:0, limit:25, position:'121.073257, 24.778786', mileage:83474, fuel:36063.5, engine:3884.3 },
    { car:'ABC-7610', time:'2025-11-30 17:50:57', status:'停車', speed:0, limit:30, position:'121.549294, 23.861162', mileage:39098, fuel:18132.5, engine:3174.5 },
    { car:'ABC-7569', time:'2025-11-30 18:39:36', status:'停車', speed:0, limit:30, position:'120.313835, 23.101540', mileage:32244.1, fuel:4916.5, engine:878 },
    { car:'ABC-1999', time:'2025-11-21 18:07:11', status:'停車', speed:0, limit:50, position:'121.586815, 23.935158', mileage:20029.5, fuel:5555, engine:1560 },
    { car:'ABC-6325', time:'2025-11-21 17:00:13', status:'停車', speed:0, limit:30, position:'120.496475, 24.153843', mileage:28447.3, fuel:5156.5, engine:1119.8 }
  ];
  excelVehicleSnapshot = window.HINO_EXCEL_DATA.vehicleSnapshot.map(vehicle => ({
    car: vehicle.c, time: vehicle.last_time, status: vehicle.last_status, speed: vehicle.last_speed,
    limit: vehicle.last_limit, position: vehicle.position, mileage: 0, fuel: 0, engine: 0
  }));
  const nativeVehicles = excelVehicleSnapshot.map(vehicle => [vehicle.car,'—',vehicle.status,'—',vehicle.speed,vehicle.position,vehicle.time]);
  const telemetryVehicles = window.HINO_EXCEL_DATA.vehicleSnapshot;
  const maintenanceStorageKey = 'hino-maintenance-records-v1';
  let maintenanceRecords = {};
  try { maintenanceRecords = JSON.parse(localStorage.getItem(maintenanceStorageKey) || '{}'); } catch (error) { maintenanceRecords = {}; }
  function maintenanceRecord(car) { return maintenanceRecords[car] || {}; }
  function saveMaintenanceRecord(car, values) {
    maintenanceRecords[car] = { ...maintenanceRecord(car), ...values };
    try { localStorage.setItem(maintenanceStorageKey, JSON.stringify(maintenanceRecords)); } catch (error) { /* The current browser may block local persistence. */ }
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]); }
  function maintenanceValueLabel(value, unit='') { return value === undefined || value === '' ? '尚未設定' : `${Number(value).toLocaleString('zh-TW')}${unit}`; }
  const nativeTasks = telemetryVehicles.slice(0, 8).map(vehicle => [
    '可覆核', vehicle.journey, `${vehicle.journeys} 段`, '原始資料未提供', vehicle.c,
    'journeyCode 遙測', '來源未提供'
  ]);
  function nativeTable(headers, rows, tone) {
    return `<div class="native-table-wrap"><table class="native-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td${i === 0 && tone ? ` class="${tone(cell)}"` : ''}>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function nativeIconActions(...items) {
    return `<span class="native-row-actions">${items.map(([key, icon, label]) => `<button type="button" class="native-icon-action" data-itraq-action="${key}" aria-label="${label}" title="${label}">${icon}</button>`).join('')}</span>`;
  }
  function nativeTextAction(label, key='open') { return `<button type="button" class="native-text-action" data-itraq-action="${key}">${label}</button>`; }
  function nativeFilter({date=excelSource.period, search='搜尋車號／駕駛／姓名／車牌', actions='' } = {}) {
    return `<div class="native-filter"><button type="button" class="native-input" data-itraq-filter="date">◫&nbsp; ${date}</button><button type="button" class="native-input" data-itraq-filter="department">部門 (all)⌄</button><label class="native-search">⌕ <input value="" placeholder="${search}" aria-label="${search}"></label>${actions}</div>`;
  }
  function nativePager() { return `<div class="native-pager"><button type="button" class="native-page-size" data-itraq-action="page-size">每頁資料筆數: 10⌄</button><span><button type="button" data-itraq-page="prev">‹</button><button type="button" class="on" data-itraq-page="1">1</button><button type="button" data-itraq-page="2">2</button><button type="button" data-itraq-page="3">3</button><button type="button" data-itraq-page="4">4</button><button type="button" data-itraq-page="next">›</button></span></div>`; }
  function nativePageTitle(title, trail) {
    return `<div class="native-breadcrumb"><span class="native-crumb-text">${trail || '車隊管理'} <i>›</i> ${title}</span></div>`;
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
  let nativeLeafletMap;
  let nativeLeafletMarkers = [];
  function nativeMap(mapId='native-live-map') {
    return `<div class="native-map-shell"><div id="${mapId}" class="native-map" role="application" aria-label="車輛最後 GPS 位置地圖"></div><p class="native-map-caption">底圖 © OpenStreetMap contributors；標記為 各車最後 GPS 紀錄，並非即時位置。</p></div>`;
  }
  function telemetryCoordinate(vehicle) {
    const [longitude, latitude] = String(vehicle.position || '').split(',').map(value => Number(value.trim()));
    return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 20 && latitude <= 27 && longitude >= 118 && longitude <= 123 ? [latitude, longitude] : null;
  }
  function markerColor(status) { return status === '行駛中' ? '#72a82a' : status.includes('怠速') ? '#eaa529' : '#ce5d59'; }
  function markerTooltip(vehicle, includeSpeed) { return `${vehicle.c}${includeSpeed ? ` · ${vehicle.last_speed} km/h` : ''}`; }
  function refreshNativeMapMarkers() {
    if (!nativeLeafletMap) return;
    const showLabels = Boolean(document.querySelector('[data-map-layer="vehicle"].on'));
    const showSpeed = Boolean(document.querySelector('[data-map-layer="speed"].on'));
    nativeLeafletMarkers.forEach(({ marker, vehicle }) => {
      marker.unbindTooltip();
      if (showLabels || showSpeed) marker.bindTooltip(markerTooltip(vehicle, showSpeed), { direction:'top', offset:[0, -8], opacity:.94, permanent:showLabels });
    });
  }
  function initializeNativeMap(mapId) {
    const target = document.getElementById(mapId);
    if (!target) return;
    if (!window.L) {
      target.innerHTML = `<div class="native-map-error">地圖元件未載入，請確認網路連線後重新整理。</div>`;
      return;
    }
    if (nativeLeafletMap) nativeLeafletMap.remove();
    nativeLeafletMarkers = [];
    nativeLeafletMap = window.L.map(target, { zoomControl:true, scrollWheelZoom:true, attributionControl:true });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(nativeLeafletMap);
    const bounds = [];
    telemetryVehicles.forEach(vehicle => {
      const coordinate = telemetryCoordinate(vehicle);
      if (!coordinate) return;
      bounds.push(coordinate);
      const marker = window.L.circleMarker(coordinate, {
        radius: 8, color:'#fff', weight:2, fillColor:markerColor(vehicle.last_status), fillOpacity:1
      }).addTo(nativeLeafletMap);
      marker.bindPopup(`<b>${vehicle.c}</b><br>車輛狀態：${vehicle.last_status}<br>車速：${vehicle.last_speed} km/h<br>最後紀錄：${vehicle.last_time}<br>座標：${vehicle.position}`);
      nativeLeafletMarkers.push({ marker, vehicle });
    });
    if (bounds.length > 1) nativeLeafletMap.fitBounds(bounds, { padding:[28, 28], maxZoom:9 });
    else if (bounds.length) nativeLeafletMap.setView(bounds[0], 10);
    else nativeLeafletMap.setView([23.7, 121], 7);
    refreshNativeMapMarkers();
    requestAnimationFrame(() => nativeLeafletMap && nativeLeafletMap.invalidateSize());
  }
  function nativeMonitor() {
    return `<div class="native-workspace"><div class="native-monitor-layout"><div><div class="native-map-switch"><button type="button" class="on" data-map-layer="vehicle">車號</button><button type="button" data-map-layer="driver" data-map-unavailable="駕駛姓名">駕駛</button><button type="button" data-map-layer="speed">速度</button><button type="button" data-map-layer="fence" data-map-unavailable="電子圍籬">電子圍籬</button></div>${nativeMap()}</div><div class="native-list-panel"><b>資料：${excelSource.vehicles} 台車輛 / ${excelSource.records.toLocaleString()} 筆紀錄</b>${nativeTable(['車號 ↕','駕駛 ↕','車輛狀態 ↕','手機號碼 ↕','車速(km/h) ↕','經緯度 ↕','最後紀錄時間 ↕'], nativeVehicles, state => state === '行駛中' ? 'run' : state.includes('怠速') ? 'idle' : 'lost')}</div></div></div>`;
  }
  function nativeVideoLive() {
    const dvrImage = 'assets/simulated-dvr/fleet-dvr-mosaic-v1.png';
    return `<div class="native-workspace"><div class="native-video-layout"><div class="native-video-grid"><div class="video-tile v1"><img src="${dvrImage}" alt="模擬 DVR 前鏡頭影像"><b>模擬 DVR · ①</b><span>前鏡頭 · ABC-5310</span></div><div class="video-tile v2"><img src="${dvrImage}" alt="模擬 DVR 右側鏡頭影像"><b>模擬 DVR · ②</b><span>右側鏡頭</span></div><div class="video-tile v3"><img src="${dvrImage}" alt="模擬 DVR 左側鏡頭影像"><b>模擬 DVR · ③</b><span>左側鏡頭</span></div><div class="video-tile v4"><img src="${dvrImage}" alt="模擬 DVR 後鏡頭影像"><b>模擬 DVR · ④</b><span>後鏡頭</span></div></div><div class="native-list-panel"><b>雙擊車輛即可查看即時影像</b>${nativeTable(['車號','駕駛','車輛狀態','手機號碼','車速(km/h)','經緯度','最後紀錄時間'], nativeVehicles.slice(0,4), state => state === '行駛中' ? 'run' : 'lost')}</div></div></div>`;
  }
  function nativeJourneyHierarchy() {
    return `<div class="native-workspace"><div class="journey-flow"><article><b>第一層</b><div><strong>單日車隊內所有車輛歷史軌跡列表</strong><span>車號、駕駛、累積里程數、行駛總時長</span></div></article><article><b>第二層</b><div><strong>單日單一車輛的所有軌跡列表</strong><span>每一行程的啟動與熄火時間、累積時長及起訖點</span></div></article><article><b>第三層</b><div><strong>單日單一車輛單一軌跡的各點位列表</strong><span>點位時間、位置、車輛狀態、觸發事件</span></div></article></div></div>`;
  }
  function nativeVideoArchive() {
    const rows = telemetryVehicles.map(vehicle => [vehicle.c,'來源未提供影像檔']);
    return `<div class="native-workspace native-video-archive"><div class="archive-grid"><div class="archive-empty"><span>來源僅含遙測資料；影像檔需由 DVR 平台串接後才可調閱</span></div><aside><div class="native-filter"><button type="button" class="native-input" data-itraq-filter="vehicle">車號 (all)⌄</button><button type="button" class="native-input" data-itraq-filter="date">◫ ${excelSource.period}</button></div>${nativeTable(['車號','影像資料'],rows)}</aside></div></div>`;
  }
  function nativeTaskTable() {
    return `<div class="native-workspace">${nativeFilter({actions:'<button type="button" class="native-action">＋ 新增任務</button><button type="button" class="native-action">⇧ 批量匯入</button>'})}<div class="native-tabs"><button type="button" class="on">依任務</button><button type="button">依駕駛</button></div>${nativeTable(['任務狀態 ↕','任務編號 ↕','進度 ↕','駕駛/手機號碼 ↕','車號 ↕','任務類型 ↕','下一站點 ↕','操作'], nativeTasks.map(r => [...r,nativeIconActions(['edit','✎','編輯任務'],['copy','▢','複製任務'],['refresh','♲','更新狀態'])]), state => ({'執行中':'running','調度中':'dispatch','已完成':'done','已中斷':'stopped','待執行':'pending'}[state]))}${nativePager()}</div>`;
  }
  function nativeMaintenance() {
    const valueButton = (vehicle, label, action='maintenance-values') => `<button type="button" class="native-maint-unset" data-itraq-action="${action}" data-vehicle="${vehicle.c}">${label}</button>`;
    const rows = telemetryVehicles.slice(0, 8).map(vehicle => {
      const record = maintenanceRecord(vehicle.c);
      return [
        vehicle.c,
        escapeHtml(record.workOrder || '—'),
        valueButton(vehicle, record.date || '尚未設定'),
        valueButton(vehicle, maintenanceValueLabel(record.mileage, ' km')),
        valueButton(vehicle, maintenanceValueLabel(record.engineHours, ' h')),
        valueButton(vehicle, record.item || '尚未設定', 'maintenance-items'),
        nativeIconActions(
          ['book-maintenance','◷','預約原廠保修'],
          ['maintenance-schedule','▣','查看保修週期排程'],
          ['edit-work-order','✎','編輯工單']
        )
      ];
    });
    return `<div class="native-workspace native-maintenance-workspace">${nativeFilter({search:'搜尋車號／工單編號／保修項目'})}<div class="native-tabs"><button type="button" class="on" data-itraq-view="maintenance-cycle">車輛週期一覽</button><button type="button" data-itraq-page="8">預約資料</button><button type="button" data-itraq-view="work-order">工單資料</button></div><h3 class="native-list-title">近一次保修紀錄</h3>${nativeTable(['車號 ↕','工單編號 ↕','保修日期 ↕','總里程數 ↕','引擎運轉時數 ↕','保修項目 ↕','操作'],rows)}${nativePager()}</div>`;
  }
  function maintenanceDialog(action, car) {
    const vehicle = telemetryVehicles.find(item => item.c === car);
    const lastRecord = vehicle ? vehicle.last_time : '來源未提供';
    const record = maintenanceRecord(car);
    const sourceNote = `<div class="source-note"><b>資料狀態：</b>${car} 為 來源車號；最近遙測紀錄為 ${lastRecord}。來源未提供保修日期、里程、引擎時數、工單或保修項目，以下內容須由保修人員輸入，不會覆寫原始遙測資料。</div>`;
    const dismiss = `<button class="btn gho" onclick="closeOv()">取消</button>`;
    if (action === 'maintenance-values') {
      showModal(`<h3>前次保修值設定 — ${car}</h3><p class="modal-alert">請完成保修值設定後，再建立週期排程。</p>${sourceNote}<div class="native-modal-fields maintenance-value-fields" data-maintenance-values><label>保修日期<input name="date" type="date" value="${record.date || ''}" required></label><label>保修總里程數<input name="mileage" type="number" min="0" value="${record.mileage || ''}" placeholder="請依保修單輸入" required><small>公里</small></label><label>保修引擎運轉時數<input name="engineHours" type="number" min="0" value="${record.engineHours || ''}" placeholder="請依保修單輸入" required><small>小時</small></label></div><div class="mb">${dismiss}<button class="btn pri" onclick="saveMaintenanceValues('${car}')">確認</button></div>`);
      return;
    }
    if (action === 'maintenance-schedule') {
      const rows = [[record.item || '尚未設定','尚未設定','—',record.mileage ? `${maintenanceValueLabel(record.mileage, ' km')}／${maintenanceValueLabel(record.engineHours, ' h')}` : '—','來源未提供','待設定']];
      showModal(`<h3>保修項目週期排程 — ${car}</h3>${sourceNote}<div class="maintenance-schedule-table">${nativeTable(['保修項目','採用週期','週期值','近一次保修數值','當下數值','預估下次保修數值'],rows)}</div><div class="mb"><button class="btn pri" onclick="closeOv()">確定</button></div>`);
      return;
    }
    if (action === 'maintenance-items') {
      showModal(`<h3>請設定保修項目 — ${car}</h3><p class="modal-alert">設定後請依保修單補齊週期與前次保修值。</p>${sourceNote}<div class="native-modal-fields" data-maintenance-items><label>選擇保修項目<select name="item" required><option value="">請選擇保修項目</option><option${record.item === '煞車保養' ? ' selected' : ''}>煞車保養</option><option${record.item === '輪胎保養' ? ' selected' : ''}>輪胎保養</option><option${record.item === '其它' ? ' selected' : ''}>其它</option></select></label></div><div class="mb">${dismiss}<button class="btn pri" onclick="saveMaintenanceItem('${car}')">確認</button></div>`);
      return;
    }
    if (action === 'book-maintenance') {
      showModal(`<h3>預約原廠保修 — ${car}</h3>${sourceNote}<div class="native-modal-fields" data-maintenance-booking><label>預約日期<input name="date" type="date" required></label><label>服務廠<input name="serviceCenter" type="text" placeholder="請輸入原廠／服務廠" required></label><label>保修說明<textarea name="detail" placeholder="請輸入保修項目或檢修原因" required></textarea></label></div><div class="mb">${dismiss}<button class="btn pri" onclick="saveMaintenanceBooking('${car}')">送出預約</button></div>`);
      return;
    }
    if (action === 'edit-work-order') {
      showModal(`<h3>編輯工單 — ${car}</h3>${sourceNote}<div class="native-modal-fields" data-work-order><label>工單編號<input name="workOrder" type="text" value="${escapeHtml(record.workOrder || '')}" placeholder="請輸入工單編號" required></label><label>工單說明<textarea name="workOrderNote" placeholder="請輸入檢修內容" required>${escapeHtml(record.workOrderNote || '')}</textarea></label></div><div class="mb">${dismiss}<button class="btn pri" onclick="saveWorkOrder('${car}')">儲存</button></div>`);
    }
  }
  function modalValues(selector) {
    const container = document.querySelector(`#modal ${selector}`);
    if (!container) return null;
    const fields = [...container.querySelectorAll('[name]')];
    if (fields.some(field => !field.reportValidity())) return null;
    return Object.fromEntries(fields.map(field => [field.name, field.value.trim()]));
  }
  function refreshMaintenancePage(message) {
    closeOv();
    renderItraqPage(7, 'maintenance');
    toast(message, '已更新目前瀏覽器的保修資料；遙測資料未被修改。', 'ok');
  }
  window.saveMaintenanceValues = function (car) {
    const values = modalValues('[data-maintenance-values]');
    if (!values) return;
    saveMaintenanceRecord(car, values);
    refreshMaintenancePage('前次保修值已儲存');
  };
  window.saveMaintenanceItem = function (car) {
    const values = modalValues('[data-maintenance-items]');
    if (!values) return;
    saveMaintenanceRecord(car, values);
    refreshMaintenancePage('保修項目已儲存');
  };
  window.saveMaintenanceBooking = function (car) {
    const values = modalValues('[data-maintenance-booking]');
    if (!values) return;
    saveMaintenanceRecord(car, { booking: values });
    closeOv();
    renderItraqPage(8, 'maintenance');
    toast('原廠保修需求已送出', '預約資料已列入待服務廠確認清單。', 'ok');
  };
  window.saveWorkOrder = function (car) {
    const values = modalValues('[data-work-order]');
    if (!values) return;
    saveMaintenanceRecord(car, values);
    refreshMaintenancePage('工單資料已儲存');
  };
  function nativeAppointments() {
    const bookings = Object.entries(maintenanceRecords).filter(([, record]) => record.booking).map(([car, record]) => ['待服務廠確認',escapeHtml(record.item || '原廠保修'),car,'使用者輸入',record.booking.date,'—',escapeHtml(record.booking.serviceCenter),'待確認',escapeHtml(record.booking.detail),nativeTextAction('查看需求','open')]);
    const detected = telemetryVehicles.filter(vehicle => vehicle.dtc_count).slice(0, 6).map(vehicle => ['待人工確認','DTC 遙測',vehicle.c,'原始資料未提供','—','—','待串接','—',`DTC ${vehicle.dtc_count} 筆`,nativeTextAction('建立需求','open')]);
    const rows = [...bookings, ...detected];
    return `<div class="native-workspace">${nativeFilter({actions:'<button type="button" class="native-action">⇩ 匯出資料</button><button type="button" class="native-action">◷ 建立預約需求</button>'})}<div class="native-tabs"><button type="button" data-itraq-page="7">車輛週期一覽</button><button type="button" class="on">預約資料</button><button type="button" data-itraq-view="work-order">工單資料</button></div><div class="source-note">來源未提供原廠、服務廠、聯絡人或預約日期；使用者送出的預約會顯示在此清單，DTC 車輛則維持待串接狀態。</div>${nativeTable(['狀態 ↕','類別 ↕','車號 ↕','聯絡人 ↕','預約日期 ↕','預約編號 ↕','服務廠 ↕','預計進廠時段 ↕','派工項目 ↕','操作'],rows, state => state === '待人工確認' ? 'pending' : '')}${nativePager()}</div>`;
  }
  function nativeEvents() {
    const sum = field => telemetryVehicles.reduce((total, vehicle) => total + (Number(vehicle[field]) || 0), 0);
    const rows = [['GPS 超速',sum('overspeed_count').toLocaleString(),'gps.speed > gps.speedLimit',excelSource.period],['怠速',sum('idle_count').toLocaleString(),'carStatus = 2',excelSource.period],['高引擎負載',sum('high_load_count').toLocaleString(),'can.engine.engineLoad ≥ 90',excelSource.period],['DTC',sum('dtc_count').toLocaleString(),'event[*].info.dtcCodes[0]',excelSource.period]];
    return `<div class="native-workspace">${nativeFilter({date:'2025-01-01 - 2025-11-30',actions:'<button type="button" class="native-action">⇩ 匯出報表</button>'})}<div class="native-list-panel"><b>事件欄位彙整 · ${excelSource.records.toLocaleString()} 筆行車紀錄</b>${nativeTable(['事件類型 ↕','發生筆數 ↕','來源欄位 ↕','統計期間 ↕'],rows)}${nativePager()}</div></div>`;
  }
  function nativeReport() {
    const metrics = Object.fromEntries(window.HINO_EXCEL_DATA.metrics.map(metric => [metric.key, metric.data]));
    const month = currentReportMonth;
    const monthLabel = window.HINO_EXCEL_DATA.months[month];
    const value = key => Number(metrics[key]?.[month] || 0);
    const fmt = number => Number(number).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
    const barChart = (values, color, suffix, title) => {
      const max = Math.max(...values, 1), width = 720, height = 188, pad = { l: 35, r: 12, t: 16, b: 30 };
      const graphW = width - pad.l - pad.r, graphH = height - pad.t - pad.b, step = graphW / values.length;
      const grid = [0, .25, .5, .75, 1].map(ratio => `<line x1="${pad.l}" x2="${width-pad.r}" y1="${pad.t+graphH*(1-ratio)}" y2="${pad.t+graphH*(1-ratio)}" class="mr-grid"/>`).join('');
      const columns = values.map((item, index) => { const h = Math.max(2, graphH * item / max), x = pad.l + index * step + step * .24, y = pad.t + graphH - h; return `<g><title>${window.HINO_EXCEL_DATA.months[index]}：${fmt(item)}${suffix}</title><rect x="${x}" y="${y}" width="${Math.max(5,step*.52)}" height="${h}" rx="2" fill="${color}"/><text x="${pad.l+index*step+step/2}" y="${height-9}" text-anchor="middle">${index+1}</text></g>`; }).join('');
      return `<div class="mr-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">${grid}<text x="${pad.l}" y="12" class="mr-unit">${suffix}</text>${columns}</svg><div class="mr-legend"><span><i style="background:${color}"></i>${title}</span><b>${monthLabel}：${fmt(values[month])}${suffix}</b></div></div>`;
    };
    const comboChart = () => {
      const speed = metrics.speed, load = metrics.load, fuel = metrics.fuel, maxBars = Math.max(...speed, ...load, 1), maxFuel = Math.max(...fuel, 1), width = 720, height = 188, pad = { l: 35, r: 18, t: 16, b: 30 }, graphW = width-pad.l-pad.r, graphH = height-pad.t-pad.b, step = graphW / speed.length;
      const grid = [0,.25,.5,.75,1].map(ratio => `<line x1="${pad.l}" x2="${width-pad.r}" y1="${pad.t+graphH*(1-ratio)}" y2="${pad.t+graphH*(1-ratio)}" class="mr-grid"/>`).join('');
      const bars = speed.map((item,index) => { const x=pad.l+index*step+step*.13, sw=Math.max(3,step*.23), sh=Math.max(2,graphH*item/maxBars), lh=Math.max(2,graphH*load[index]/maxBars); return `<g><title>${window.HINO_EXCEL_DATA.months[index]}：超速 ${fmt(item)} 筆、高引擎負載 ${fmt(load[index])} 筆、百公里油耗 ${fmt(fuel[index])} L</title><rect x="${x}" y="${pad.t+graphH-sh}" width="${sw}" height="${sh}" rx="2" fill="#7ec6ca"/><rect x="${x+sw+2}" y="${pad.t+graphH-lh}" width="${sw}" height="${lh}" rx="2" fill="#f2b4bd"/><text x="${pad.l+index*step+step/2}" y="${height-9}" text-anchor="middle">${index+1}</text></g>`; }).join('');
      const line = fuel.map((item,index) => `${pad.l+index*step+step/2},${pad.t+graphH-(item/maxFuel)*graphH}`).join(' ');
      return `<div class="mr-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="每月超速、高引擎負載與油耗趨勢">${grid}${bars}<polyline points="${line}" class="mr-line"/>${fuel.map((item,index)=>`<circle cx="${pad.l+index*step+step/2}" cy="${pad.t+graphH-(item/maxFuel)*graphH}" r="3" class="mr-dot"/>`).join('')}</svg><div class="mr-legend"><span><i class="mr-a"></i>超速</span><span><i class="mr-b"></i>高引擎負載</span><span><i class="mr-c"></i>百公里油耗</span><b>${monthLabel}：${fmt(value('fuel'))} L/100km</b></div></div>`;
    };
    const actualMaintenance = telemetryVehicles.filter(vehicle => vehicle.dtc_count > 0).length;
    return `<div class="native-workspace report-page monthly-report"><div class="mr-toolbar"><div class="mr-month"><button type="button" aria-label="上個月份" data-report-month="-1">‹</button><b>2025-${String(month+1).padStart(2,'0')}</b><button type="button" aria-label="下個月份" data-report-month="1">›</button></div><span>統計期間：${monthLabel}（資料期間 ${excelSource.period}）</span><button type="button" class="native-action" data-itraq-action="report-export">⇩ 匯出月報</button></div><div class="mr-sections"><article class="mr-panel mr-mobility"><h3>車輛移動率</h3><div class="mr-summary"><div><i>◷</i><span>計算安全分</span><b>${fmt(value('safety'))} 分</b></div><div><i>◫</i><span>怠速佔比</span><b>${fmt(value('idle'))}%</b></div><div><i>▣</i><span>高引擎負載</span><b>${fmt(value('load'))} 筆</b></div></div>${barChart(metrics.safety, '#61bfc2', ' 分', '每月計算安全分')}</article><article class="mr-panel mr-drive"><h3>車輛行駛數據</h3><div class="mr-summary mr-summary-four"><div><i>⌁</i><span>超速紀錄</span><b>${fmt(value('speed'))} 筆</b></div><div><i>◌</i><span>高引擎負載</span><b>${fmt(value('load'))} 筆</b></div><div><i>△</i><span>百公里油耗</span><b>${fmt(value('fuel'))} L</b></div><div><i>▧</i><span>DTC</span><b>${fmt(value('dtc'))} 筆</b></div></div>${comboChart()}</article><article class="mr-panel mr-maintenance"><h3>保養維修概況</h3><div class="mr-maint-body"><div class="mr-empty-donut"><b>待串接</b><span>工單／保養費</span></div><div><div class="mr-maint-stat"><i>▣</i><span>有 DTC 的車號</span><b>${actualMaintenance} 台</b></div><div class="mr-maint-stat"><i>◫</i><span>原廠工單／保養項目</span><b>來源未提供</b></div><div class="mr-maint-stat"><i>＄</i><span>保養花費</span><b>來源未提供</b></div></div></div><p class="mr-note">來源可提供 DTC 作為覆核候選，但未提供保養項目、筆數、費用與工單結果。</p></article><article class="mr-panel mr-task"><h3>任務執行概況</h3><div class="mr-summary mr-summary-three"><div><i>▤</i><span>journeyCode</span><b>${fmt(window.HINO_EXCEL_DATA.aggregate.journeys)} 個</b></div><div><i>✓</i><span>任務準時達成率</span><b>來源未提供</b></div><div><i>↔</i><span>平均延誤天數</span><b>來源未提供</b></div></div><div class="mr-task-empty"><b>任務、站點與 預估到達時間 欄位尚未串接</b><span>目前可用 journeyCode 追溯車輛遙測，但不能推估任務執行率或準時率。</span><button type="button" class="native-text-action" data-itraq-action="report-task-request">建立任務資料串接需求</button></div></article></div><div class="mr-foot">月報圖表使用 月結遙測：超速、怠速、高引擎負載、DTC、計算安全分與百公里油耗。保修及任務資料不在來源中。</div></div>`;
  }
  function nativeVehiclesPage() {
    const rows = excelVehicleSnapshot.map(vehicle => [vehicle.car,vehicle.status,vehicle.time,vehicle.speed,vehicle.limit,vehicle.mileage.toLocaleString(),vehicle.fuel.toLocaleString(),vehicle.engine.toLocaleString(),vehicle.position,nativeIconActions(['edit','✎','編輯車輛'],['refresh','♲','重新納管'],['delete','▢','刪除車輛'])]);
    return `<div class="native-workspace">${nativeFilter({search:'搜尋車號／狀態／經緯度…',actions:'<button type="button" class="native-action">＋ 新增車輛</button>'})}${nativeTable(['車號 ↕','車輛狀態 ↕','最後紀錄時間 ↕','GPS速度 ↕','路段限速 ↕','總里程(km) ↕','總油耗(L) ↕','引擎時數 ↕','經緯度 ↕','操作'],rows)}${nativePager()}</div>`;
  }
  function nativeDriversPage() {
    const rows = telemetryVehicles.map(vehicle => ['原始資料未提供','原始資料未提供',`${vehicle.region}區`,'原始資料未提供',vehicle.c,vehicle.s,nativeIconActions(['edit','✎','補齊駕駛資料'],['delete','▢','移除綁定'])]);
    return `<div class="native-workspace">${nativeFilter({search:'搜尋手機號碼/姓名/車號…',actions:'<button type="button" class="native-action">▣ 管理行程</button><button type="button" class="native-action">＋ 新增駕駛</button>'})}<div class="source-note">來源未含司機姓名、電話、身分證或實際車輛綁定；本頁僅以車號與計算安全分呈現待補資料。</div>${nativeTable(['手機號碼 ↕','姓名 ↕','歸屬區域 ↕','身分證字號 ↕','對應車號 ↕','計算安全分 ↕','操作'],rows)}${nativePager()}</div>`;
  }
  function nativeManagedJourneys() {
    const rowsFor = vehicle => [[vehicle.last_time.slice(0,10),`${vehicle.last_time.slice(11)}（最後遙測）`,'原始資料未提供',`journeyCode ${vehicle.journey}`,'原始資料未提供','原始資料未提供',nativeTextAction('建立對照','save')]];
    const [first, second] = telemetryVehicles;
    return `<div class="native-workspace">${nativeFilter({search:'搜尋手機號碼/姓名/車號…',actions:'<button type="button" class="native-action">▣ 結算成績</button>'})}<div class="source-note">來源提供 journeyCode 與車號，但沒有駕駛歸屬、任務配給或系統預設資料。</div><div class="journey-group"><h3>${first.c}⌃</h3>${nativeTable(['日期 ↕','最後遙測時間 ↕','行程歸屬駕駛 ↕','備註 ↕','任務配給','系統預設','操作'],rowsFor(first))}</div><div class="journey-group"><h3>${second.c}⌃</h3>${nativeTable(['日期 ↕','最後遙測時間 ↕','行程歸屬駕駛 ↕','備註 ↕','任務配給','系統預設','操作'],rowsFor(second))}</div></div>`;
  }
  function nativeScore() {
    const vehicle = telemetryVehicles[0];
    return `<div class="native-workspace score-page"><div class="score-head"><button type="button" class="native-input" data-itraq-filter="month">${excelSource.period}</button><button type="button" class="native-action">⇩ 匯出成績單</button></div><div class="score-layout"><aside><h2>${vehicle.c}</h2><span>駕駛姓名 原始資料未提供</span><span>歸屬區域 ${vehicle.region}區</span><span>結算期間 ${excelSource.period}</span><hr><span>journeyCode 數 <b>${vehicle.journeys}</b></span><span>超速紀錄 <b>${vehicle.overspeed_count.toLocaleString()} 筆</b></span><span>怠速佔比 <b>${vehicle.idle_pct}%</b></span><span>高引擎負載 <b>${vehicle.high_load_count.toLocaleString()} 筆</b></span><span>DTC <b>${vehicle.dtc_count} 筆</b></span><span>計算安全分 <b>${vehicle.s}</b></span></aside><article><h2>計算安全分 <b>${vehicle.s}分</b></h2><div class="native-tabs"><button type="button" class="on">超速分析</button><button type="button">怠速分析</button><button type="button">高引擎負載</button><button type="button">DTC</button></div><div class="speed-pie"></div><p>分數由超速率、怠速率、高引擎負載率與 DTC 紀錄加權計算；非原廠駕駛成績。</p></article></div></div>`;
  }
  function nativeFence() {
    const rows = [['電子圍籬資料','—','—','來源未提供',nativeIconActions(['edit','✎','建立串接需求'])]];
    return `<div class="native-workspace"><div class="native-fence-layout"><div>${nativeMap('native-fence-map')}</div><div><button type="button" class="native-action">＋ 新增圍籬</button><div class="source-note">此底圖使用 車輛最後 GPS 位置；來源沒有圍籬名稱、範圍與進出規則，需另行設定。</div>${nativeTable(['圍籬名稱 ↕','顯示','進出通知設定 ↕','時效性 ↕','操作'],rows)}</div></div></div>`;
  }
  function nativeNotification() {
    const rows = [...telemetryVehicles].sort((a,b) => b.s - a.s).slice(0,4).map(vehicle => ['遙測資料提醒',`${vehicle.c}：${vehicle.i}；請人工覆核路況與車況。`,'查看遙測',vehicle.last_time]);
    return `<div class="native-workspace">${nativeFilter()}<div class="native-tabs notification-tabs"><button type="button" class="on">全部</button><button type="button">事件通知</button><button type="button">任務通知</button><button type="button">圍籬通知</button><button type="button">語音通知</button><button type="button">納管通知</button><button type="button">平台通知</button><button type="button">保修通知</button><button type="button">駕駛成績</button><button type="button">影像通知</button></div>${nativeTable(['','通知類型','內容','操作','時間'],rows.map(row => ['♧',row[0],row[1],nativeTextAction(row[2]),row[3]]))}${nativePager()}</div>`;
  }
  function renderItraqNative(pageNo) {
    return ({2:nativeMonitor,3:nativeVideoLive,4:nativeJourneyHierarchy,5:nativeVideoArchive,6:nativeTaskTable,7:nativeMaintenance,8:nativeAppointments,9:nativeEvents,10:nativeReport,11:nativeVehiclesPage,12:nativeDriversPage,13:nativeManagedJourneys,14:nativeScore,15:nativeFence,16:nativeNotification}[pageNo] || nativeMonitor)();
  }
  function renderItraqWorkspace() {
    const pageIds = itraqSections[currentItraqSection] || itraqSections.monitor;
    const pages = pageIds.map(pageNo => manualPages.find(item => item.p === pageNo)).filter(Boolean);
    const page = pages.find(item => item.p === currentManualPage) || pages[0];
    if (nativeLeafletMap) { nativeLeafletMap.remove(); nativeLeafletMap = undefined; nativeLeafletMarkers = []; }
    screen.innerHTML = `<section class="itraq-native">${nativePageTitle(page.t, nativeSectionLabel(page.p))}${renderItraqNative(page.p)}</section>`;
    if (page.p === 2) initializeNativeMap('native-live-map');
    if (page.p === 15) initializeNativeMap('native-fence-map');
  }
  function nativeForm(title, hint, confirmLabel='儲存') {
    showModal(`<h3>${title}</h3><p>${hint}</p><div class="native-modal-fields"><label>名稱／車號<input type="text" placeholder="請輸入資料"></label><label>備註<textarea placeholder="可補充說明（選填）"></textarea></label></div><div class="mb"><button class="btn gho" onclick="closeOv()">取消</button><button class="btn pri" onclick="closeOv();toast('${title}已送出','已完成送出流程；既有紀錄維持不變。','ok')">${confirmLabel}</button></div>`);
  }
  function nativeActionFeedback(label) {
    const text = label.replace(/[＋⇧⇩◷▣]/g, '').trim();
    if (/新增任務|新增車輛|新增駕駛|新增圍籬|預約原廠/.test(text)) { nativeForm(text, '請填寫必要資訊後送出；系統會保留原始資料並顯示處理回饋。', /預約/.test(text) ? '送出預約' : '新增'); return; }
    if (/管理行程/.test(text)) { renderItraqPage(13, 'fleet'); return; }
    if (/結算成績/.test(text)) { showModal(`<h3>結算駕駛成績</h3><p>僅在月內無待確認違反資料時，才能結算成績。系統會先送交主管覆核。</p><div class="mb"><button class="btn gho" onclick="closeOv()">取消</button><button class="btn pri" onclick="closeOv();toast('已送交成績覆核','主管確認後才會結算。','ok')">送交覆核</button></div>`); return; }
    if (/匯出/.test(text)) { toast('匯出已建立', `${text}已準備完成，資料不會傳送至外部服務。`, 'ok'); return; }
    toast('操作已接收', `${text || '此功能'}已完成處理。`, 'ok');
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
    toast(`已切換第 ${next} 頁`, '目前顯示相同資料集的下一頁檢視。', 'ok');
  }
  function attachItraqInteractions() {
    screen.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !screen.contains(button) || button.classList.contains('itraq-web-tab')) return;
      if (button.dataset.reportMonth) {
        const next = currentReportMonth + Number(button.dataset.reportMonth);
        currentReportMonth = Math.max(0, Math.min(window.HINO_EXCEL_DATA.months.length - 1, next));
        renderItraqPage(10, 'data');
        return;
      }
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
      if (button.closest('.native-map-switch')) {
        const unavailable = button.dataset.mapUnavailable;
        if (unavailable) { toast(`${unavailable}無法顯示`, `來源未提供${unavailable}欄位，地圖不會假造此圖層。`, 'in'); return; }
        button.classList.toggle('on');
        refreshNativeMapMarkers();
        toast('地圖圖層已更新', `${button.textContent}顯示已${button.classList.contains('on') ? '開啟' : '關閉'}。`, 'ok');
        return;
      }
      if (button.dataset.itraqFilter) { nativeFilterDialog(button.dataset.itraqFilter, button.textContent); return; }
      if (button.dataset.itraqAction) {
        const labels = { edit:'編輯資料', copy:'已複製任務', refresh:'已更新納管狀態', delete:'刪除資料', save:'已儲存行程', open:'已開啟通知', vehicle:'車輛即時資訊', fence:'電子圍籬資訊', 'confirm-maintenance':'保修值已確認', 'page-size':'每頁資料筆數', 'report-task-request':'任務資料串接需求' };
        const action = button.dataset.itraqAction;
        if (['maintenance-values','maintenance-schedule','maintenance-items','book-maintenance','edit-work-order'].includes(action)) {
          maintenanceDialog(action, button.dataset.vehicle);
          return;
        }
        if (action === 'report-export') {
          const reportMonth = currentReportMonth;
          const rows = [['月份','計算安全分','超速紀錄','怠速佔比','高引擎負載','DTC','百公里油耗']].concat(window.HINO_EXCEL_DATA.months.map((label, index) => {
            const metrics = Object.fromEntries(window.HINO_EXCEL_DATA.metrics.map(metric => [metric.key, metric.data]));
            return [label, metrics.safety[index], metrics.speed[index], metrics.idle[index], metrics.load[index], metrics.dtc[index], metrics.fuel[index]];
          }));
          const csv = '\ufeff' + rows.map(row => row.join(',')).join('\n');
          const link = document.createElement('a');
          link.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
          link.download = `iTRAQ-營運月報-2025-${String(reportMonth + 1).padStart(2,'0')}.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
          toast('月報已匯出', `已下載 ${window.HINO_EXCEL_DATA.months[reportMonth]} 的 遙測月報 CSV。`, 'ok');
          return;
        }
        if (action === 'delete') { showModal(`<h3>刪除資料</h3><p>系統不會直接刪除原始資料。確認後會送出刪除申請供主管覆核。</p><div class="mb"><button class="btn gho" onclick="closeOv()">取消</button><button class="btn dng" onclick="closeOv();toast('已送出刪除申請','原始資料未被刪除。','wn')">送出申請</button></div>`); return; }
        if (action === 'edit') { nativeForm('編輯資料', '請修改資料後送出；系統不會覆蓋原始紀錄。', '儲存變更'); return; }
        if (action === 'vehicle') { showModal(`<h3>車輛即時資訊</h3><p>683-M6 · 行駛中 · 70 km/h</p><p>可由此查看行駛狀態與安全事件摘要。</p><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); return; }
        if (action === 'fence') { showModal(`<h3>北部PDS 電子圍籬</h3><p>進出通知：已開啟；有效期限：永久有效。</p><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); return; }
        if (action === 'page-size') { button.textContent = button.textContent.includes('10') ? '每頁資料筆數: 20⌄' : '每頁資料筆數: 10⌄'; toast('每頁資料筆數已更新', button.textContent, 'ok'); return; }
        toast(labels[action] || '操作已完成', '操作已收到，原始資料維持不變。', action === 'delete' ? 'wn' : 'ok');
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
    const ranking = teamRanks();
    const winner = ranking[0];
    const focus = ranking.at(-1);
    const source = window.HINO_EXCEL_DATA.meta;
    screen.innerHTML = `
      <section class="competition-hero"><div class="eyebrow">SAFETY LEAGUE · EXCEL 期間資料</div><h2>把可追溯的車聯網資料變成團隊改善目標</h2><p>以 ${source.period} 的超速、怠速、高引擎負載與 DTC 計算；資料檔沒有駕駛姓名，因此個人排名以車號呈現並維持私密。</p><div class="hero-actions"><button class="btn sm" onclick="openCompetitionRules()">查看計分規則</button></div></section>
      <section><div class="sh"><h2>車隊安全聯賽</h2><span class="newbadge">公開至團隊層級</span></div><div class="subt">依 月結遙測計算分排序；此分數為系統計算指標，非官方駕駛成績。</div><div class="ranklist">${teamRankRows()}</div></section>
      <section class="office-grid"><div class="next-gain"><strong>目前第一名：${winner.name} ${currentTeamScore(winner)} 分</strong><p>此結果來自 遙測欄位；獎勵機制需由公司另外制定並經人資核准。</p></div><div class="next-gain"><strong>${focus.name}優先改善超速與怠速</strong><p>計算分 ${currentTeamScore(focus)} 分；改善前請先覆核車況、路況與派車情境。</p></div></section>
      <section>${competitionRules()}</section><div class="foot">資料來源：${source.sourceFile} · 團隊排行公開、車號個別名次僅限授權範圍</div>`;
  }
  function renderLeadCompetition() {
    const region = myRegion();
    const teamRank = teamRanks().findIndex(item => item.id === region.id) + 1;
    const score = currentTeamScore(region);
    screen.innerHTML = `
      <section class="competition-hero"><div class="eyebrow">${region.name}車隊 · 安全聯賽</div><h2>目前第 ${teamRank} 名，計算安全分 ${score}</h2><p>可看各車隊名次；來源沒有駕駛姓名，個別資料以車號呈現且僅限您的管理範圍。</p><div class="hero-actions"><button class="btn sm ghost" onclick="gotoTab('drivers')">安排資料覆核</button></div></section>
      <section><div class="sh"><h2>車隊排行</h2><span class="tag">團隊資料可比較</span></div><div class="ranklist">${teamRankRows(region.id)}</div></section>
      <section><div class="decision-card emphasis"><h3>本區下一步</h3><p>先覆核超速、怠速、高引擎負載與 DTC 記錄，再安排提醒或保修。請不要公開車號末段名次，也不要把計算分數直接用於人事處分。</p><div class="acts"><button class="btn pri sm" onclick="act('已排入本區遙測資料覆核會議。','ok')">安排資料覆核</button></div></div></section>
      <section>${competitionRules()}</section><div class="foot">總負責人視角 · ${region.name}管理範圍</div>`;
  }
  function renderDriverCompetition() {
    const { region, driver } = (() => { const x = myDriver(); return { region: x.r, driver: x.d }; })();
    const plan = improvementPlan(driver, region);
    const prize = driver.s >= 70 ? '已達系統設定的 70 分改善門檻' : `再 ${Math.max(0, 70 - driver.s)} 分可達系統設定的 70 分改善門檻`;
    screen.innerHTML = `
      <section class="competition-hero"><div class="eyebrow">MY SAFE DRIVE · 私密榜單</div><h2>我的車號名次：第 ${plan.now} / ${region.drivers.length}</h2><p>原始資料沒有駕駛姓名；系統以綁定車號顯示個人名次，且不顯示其他車號分數。</p><div class="hero-actions"><button class="btn sm" onclick="openDriverSafetyPlan()">查看改善計畫</button></div></section>
      <section><div class="private-note"><b>隱私保護：</b>你只看得到自己的車號排名、計算分數與下一步；團隊只看整體成績。</div></section>
      <section><div class="sh"><h2>照做後可前進幾名</h2></div><div class="next-gain"><strong>完成這 3 件事，預估 +${plan.gain} 分${plan.forward ? '、前進 ' + plan.forward + ' 名' : ''}</strong><p>改善預估供你設定目標；最終入榜前會排除車況、路況與派工因素，並提供申訴管道。</p><ul class="mini-checks">${plan.reasons.map(item => `<li>${item}</li>`).join('')}</ul><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn pri sm" onclick="openDriverSafetyPlan()">看我的改善步驟</button><button class="btn gho sm" onclick="playDriverSafetyAudio()">播放安全語音</button></div></div></section>
      <section><div class="decision-card emphasis"><h3>改善，不是人事處分</h3><p>${prize}。任何獎勵方案需另經公司與人資核准；不以危險趕工、接更多單或壓縮休息換分數。</p></div></section>
      <section>${competitionRules()}</section><div class="foot">車隊駕駛視角 · 個人資料僅本人可見</div>`;
  }
  function renderPeopleDecision() {
    const source = window.HINO_EXCEL_DATA.meta;
    const workload = regions.map(region => ({
      region,
      journeys: ordersByRegion[region.id],
      vehicles: region.drivers.length,
      perVehicle: Math.round(ordersByRegion[region.id] / region.drivers.length)
    })).sort((a, b) => b.perVehicle - a.perVehicle);
    const highest = workload[0];
    screen.innerHTML = `
      <section class="competition-hero"><div class="eyebrow">PEOPLE DECISION CENTER</div><h2>先補齊人資資料，才做人力決策</h2><p>目前 來源僅有車聯網遙測，沒有駕駛姓名、工時、出勤、薪酬、職級、招募或訂單資料；系統不會據此推導招募、加薪、裁員或個人績效。</p><div class="hero-actions"><button class="btn sm" onclick="openWorkforceGuardrail()">查看資料需求</button></div></section>
      <section class="office-grid">
        <div class="decision-card emphasis"><h3>可用的量能訊號</h3><div class="decision-metric"><span>${highest.region.name}每車歷史行程</span><b>${highest.perVehicle}</b></div><p>來源為 ${source.period} 的 ${window.HINO_EXCEL_DATA.aggregate.journeys.toLocaleString()} 個 journeyCode，僅能作為車輛調度與營運覆核的線索，不能代表人均工作量。</p><div class="acts"><button class="btn pri sm" onclick="gotoTab('competition')">查看車隊遙測</button></div></div>
        <div class="decision-card emphasis"><h3>安全改善資料</h3><div class="decision-metric"><span>可比較單位</span><b>${source.vehicles} 台車</b></div><p>計算安全分只使用超速、怠速、高引擎負載與 DTC 紀錄；原始檔沒有安全帶、疲勞、急煞、駕駛姓名或出勤資料。</p><div class="acts"><button class="btn pri sm" onclick="gotoTab('competition')">查看車隊排名</button></div></div>
        <div class="decision-card warning"><h3>招募／加薪／裁員：資料不足</h3><p>進行人資決策前，需串接人員主檔、班表／工時、出勤、薪酬、職級、駕照／訓練及真實訂單量，並經人資與法遵覆核。</p><div class="acts"><button class="btn warnb sm" onclick="openWorkforceGuardrail()">查看覆核流程</button></div></div>
        <div class="decision-card danger"><h3>保護閘門</h3><p>系統禁止以車聯網分數自動加薪、扣薪、裁員或解約；任何個人處置均需人為調查、改善期、申訴與人資核准。</p></div>
      </section>
      <section>${competitionRules()}</section><div class="foot">資料來源：${source.sourceFile} · 人資欄位未提供</div>`;
  }
  const executiveDecisionStorageKey = 'hino-owner-decisions-v1';
  let executiveDecisionState = {};
  try { executiveDecisionState = JSON.parse(localStorage.getItem(executiveDecisionStorageKey) || '{}'); } catch (error) { executiveDecisionState = {}; }
  const workforceReviewStorageKey = 'hino-workforce-review-v1';
  let workforceReviewState = {};
  try { workforceReviewState = JSON.parse(localStorage.getItem(workforceReviewStorageKey) || '{}'); } catch (error) { workforceReviewState = {}; }
  function topTelemetry(field, count=1) { return [...telemetryVehicles].sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0)).slice(0, count); }
  function workforceRisk(vehicle) {
    return Number(vehicle.overspeed_pct || 0) * 2 + Number(vehicle.idle_pct || 0) + Number(vehicle.high_load_pct || 0) + Math.min(20, Number(vehicle.dtc_count || 0) / 10);
  }
  function workforceCandidates(kind) {
    const vehicles = [...telemetryVehicles];
    if (kind === 'recognition') return vehicles.sort((a, b) => Number(b.s || 0) - Number(a.s || 0)).slice(0, 3).map(vehicle => ({
      car:vehicle.c,
      reason:`安全分 ${vehicle.s}；超速率 ${vehicle.overspeed_pct}%；DTC ${vehicle.dtc_count} 筆`
    }));
    return vehicles.sort((a, b) => workforceRisk(b) - workforceRisk(a)).slice(0, 3).map(vehicle => ({
      car:vehicle.c,
      reason:`超速率 ${vehicle.overspeed_pct}%；怠速 ${vehicle.idle_pct}%；DTC ${vehicle.dtc_count} 筆`
    }));
  }
  function workforceReviewBadge(kind) {
    const state = workforceReviewState[kind];
    return state ? `<span class="executive-status done">已送人資 · ${state.createdAt}</span>` : '<span class="executive-status open">待建立覆核</span>';
  }
  function executiveDecisionDefinitions() {
    const speed = topTelemetry('overspeed_count')[0];
    const idle = topTelemetry('idle_pct')[0];
    const dtc = topTelemetry('dtc_count')[0];
    const regionName = vehicle => (regions.find(region => region.id === vehicle.region) || {}).name || '所屬區域';
    return {
      speed: {
        region: regionName(speed), title:`交辦 ${regionName(speed)} 總負責人覆核 ${speed.c}`,
        brief:`核准 ${regionName(speed)} 安全覆核`,
        signal:`超速 ${speed.overspeed_count.toLocaleString()} 筆；高引擎負載 ${speed.high_load_count.toLocaleString()} 筆`,
        ask:'請在 24 小時內回覆限速資料、路況、車況與派車情境的覆核結果，再決定是否需要保修、調度調整或安全提醒。',
        evidence:[['車號',speed.c],['超速率',`${speed.overspeed_pct}%`],['高引擎負載率',`${speed.high_load_pct}%`],['最後紀錄',speed.last_time]]
      },
      maintenance: {
        region: regionName(dtc), title:`交辦 ${regionName(dtc)} 總負責人處理保修優先序`,
        brief:`核准 ${regionName(dtc)} 保修覆核`,
        signal:`${dtc.c} 有 DTC ${dtc.dtc_count} 筆；${idle.c} 怠速佔比 ${idle.idle_pct}%`,
        ask:'請確認故障碼、車況與停等原因；若需要停派、進廠或調度替代，才上呈老闆核准。',
        evidence:[['DTC 優先車號',`${dtc.c} · ${dtc.dtc_count} 筆`],['怠速優先車號',`${idle.c} · ${idle.idle_pct}%`],['DTC 最後紀錄',dtc.last_time],['怠速車最後紀錄',idle.last_time]]
      }
    };
  }
  function executiveDecisionStatus(key) {
    const state = executiveDecisionState[key];
    return state ? `<span class="executive-status done">已交辦 · ${state.createdAt}</span>` : '<span class="executive-status open">待您決定</span>';
  }
  function renderExecutiveBrief() {
    const source = window.HINO_EXCEL_DATA.meta;
    const decisions = executiveDecisionDefinitions();
    const pending = Object.keys(decisions).filter(key => !executiveDecisionState[key]).length;
    const ranking = teamRanks();
    const latest = source.lastRecord || source.period;
    const sixQuadrants = ranking.flatMap(region => [
      { label:`${region.name}安全分`, value:`${currentTeamScore(region)} 分`, fill:currentTeamScore(region), tone:'score' },
      { label:`${region.name}低風險率`, value:`${Math.max(0, 100 - Number(region.anomaly || 0))}%`, fill:Math.max(0, 100 - Number(region.anomaly || 0)), tone:'risk' }
    ]).slice(0, 6).map(item => `<div class="decision-quadrant ${item.tone}" style="--quadrant-fill:${Math.min(100, item.fill)}%"><span>${item.label}</span><b>${item.value}</b><i></i></div>`).join('');
    const recognition = workforceCandidates('recognition');
    const support = workforceCandidates('support');
    const decisionRow = (key, decision, tone) => `<div class="executive-decision-row ${tone}"><div><b>${decision.brief}</b><span>${decision.signal}</span></div>${executiveDecisionStatus(key)}<button class="btn ${executiveDecisionState[key] ? 'gho' : 'pri'} sm" onclick="openExecutiveDecision('${key}')">${executiveDecisionState[key] ? '查看交辦' : '確認交辦'}</button></div>`;
    screen.innerHTML = `
      <section class="decision-command"><div><span>車隊管理</span><h2>${pending ? `今日有 ${pending} 項待決事項` : '今日待決事項均已交辦'}</h2><p>最後資料：${latest} · 管理者只需處理下列需核准或需追蹤的工作。</p></div><button class="btn gho sm" onclick="openExecutiveReadGuide()">判讀原則</button></section>
      <section class="decision-actions"><div class="sh"><h2>現在要決定</h2><span class="num" style="background:${pending ? 'var(--warn)' : 'var(--good)'}">${pending}</span></div>${decisionRow('speed', decisions.speed, 'urgent')}${decisionRow('maintenance', decisions.maintenance, 'warning')}</section>
      <section class="executive-operating-grid">
        <article class="executive-panel competition"><div class="panel-title"><div><span>安全競賽</span><h3>各區安全與風險比較</h3></div><button class="btn gho sm" onclick="openExecutiveCompetition()">完整名次</button></div><div class="decision-six-grid">${sixQuadrants}</div><p class="panel-note">安全分越高、低風險率越高越好；團隊排名公開，個別車號名次僅限授權範圍。</p></article>
        <article class="executive-panel people"><div class="panel-title"><div><span>人力覆核</span><h3>獎勵與改善名單</h3></div><button class="btn gho sm" onclick="openWorkforceGuardrail()">決策條件</button></div><div class="workforce-queues"><div><div class="workforce-row"><b>獎勵／留任覆核</b>${workforceReviewBadge('recognition')}</div><p>車號 ${recognition.map(item => item.car).join('、')}</p><button class="btn gho sm" onclick="openWorkforceReview('recognition')">查看原因與送覆核</button></div><div><div class="workforce-row"><b>改善與人資審查</b>${workforceReviewBadge('support')}</div><p>車號 ${support.map(item => item.car).join('、')}</p><button class="btn gho sm" onclick="openWorkforceReview('support')">查看原因與送覆核</button></div></div><p class="panel-note">來源未提供駕駛姓名、工時與薪資；上述以車號遙測篩出覆核優先序，需先由人資比對人員並補齊資料。</p></article>
        <article class="executive-panel ai"><div class="panel-title"><div><span>AI 行動建議</span><h3>先問清楚，再做決定</h3></div><button class="btn gho sm" onclick="openAIChat()">詢問 AI</button></div><div class="ai-summary-lines"><span>${decisions.speed.region}：覆核限速、路況、車況與派車情境。</span><span>${decisions.maintenance.region}：確認故障碼、停等原因與保修優先序。</span></div><p class="panel-note">AI 協助整理事實與覆核問題；保修、調度與人事均需管理者確認後才會執行。</p></article>
      </section>
      <div class="foot">資料期間：${source.period} · 本頁僅顯示可採取管理動作的摘要。</div>`;
  }
  window.openWorkforceReview = function (kind) {
    const isRecognition = kind === 'recognition';
    const candidates = workforceCandidates(kind);
    const title = isRecognition ? '獎勵／留任覆核' : '改善與人資審查';
    const state = workforceReviewState[kind];
    showModal(`<h3>${title}</h3><p>${isRecognition ? '以下車號具有較佳安全遙測表現，請先與人資比對人員，再合併出勤、績效、職能、年資與同工同酬資料覆核。' : '以下車號有較多安全／車況訊號，請先確認車況、路況、派車、訓練與工時；必要時建立改善支持與人資個案審查。'}</p><div class="workforce-modal-list">${candidates.map(item => `<div><b>${item.car}</b><span>${item.reason}</span></div>`).join('')}</div><div class="guardrail">系統未取得駕駛姓名、薪資、出勤或勞動資料。這是覆核名單，不是自動加薪、汰換或裁員決定。</div><div class="mb"><button class="btn gho" onclick="closeOv()">關閉</button>${state ? `<button class="btn pri" onclick="closeOv()">已送人資覆核</button>` : `<button class="btn pri" onclick="recordWorkforceReview('${kind}')">建立覆核案件</button>`}</div>`);
  };
  window.recordWorkforceReview = function (kind) {
    workforceReviewState[kind] = { createdAt:new Date().toLocaleString('zh-TW', { hour:'2-digit', minute:'2-digit' }) };
    try { localStorage.setItem(workforceReviewStorageKey, JSON.stringify(workforceReviewState)); } catch (error) { /* Keep the current-session status if persistence is blocked. */ }
    closeOv();
    renderExecutiveBrief();
    toast('已建立人資覆核案件', kind === 'recognition' ? '請人資比對人員主檔，補齊薪酬與績效資料。' : '請總負責人先完成原因覆核與改善支持，再送人資個案審查。', 'ok');
  };
  window.openExecutiveCompetition = function () {
    showModal(`<h3>團隊安全競賽</h3><p>以超速、怠速、高引擎負載與 DTC 計算安全分。團隊名次可比較；個別車號名次不公開。</p><div class="ranklist">${teamRankRows()}</div>${competitionRules()}<div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`);
  };
  window.openExecutiveReadGuide = function () {
    const decisions = executiveDecisionDefinitions();
    showModal(`<h3>這些資料怎麼讀？</h3><p>老闆不必逐筆看遙測。系統只將可追溯的訊號轉成「誰要覆核、覆核什麼、何時回覆」。</p><div class="brief-read-guide"><div><b>① 安全／車況</b><span>超速、高引擎負載、怠速與 DTC 先標出異常車輛，不直接判定駕駛責任。</span></div><div><b>② 管理交辦</b><span>${decisions.speed.region}與${decisions.maintenance.region}總負責人各有一張覆核單；確認路況、車況與派車情境後才升級處理。</span></div><div><b>③ 人事護欄</b><span>資料沒有工時、出勤、薪資、職級與訂單量，所以不顯示招募、加薪、裁員結論。</span></div></div><div class="guardrail">完整地圖、報表和原始車號清單仍可在原 iTRAQ 頁面查看；首頁只保留能改變管理行動的結論。</div><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`);
  };
  window.openExecutiveEvidence = function (key) {
    const decision = executiveDecisionDefinitions()[key];
    showModal(`<h3>${decision.title}｜資料佐證</h3><div class="native-table-wrap"><table class="native-table"><tbody>${decision.evidence.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join('')}</tbody></table></div><div class="guardrail">這些是待覆核訊號；須先確認限速、車況、路況與派車情境，不可直接推論為駕駛個人責任。</div><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`);
  };
  window.openExecutiveDecision = function (key) {
    const decision = executiveDecisionDefinitions()[key];
    const state = executiveDecisionState[key];
    showModal(`<h3>${state ? '交辦內容' : '下達覆核'}｜${decision.region}</h3><p>${decision.ask}</p><div class="source-note"><b>交辦對象：</b>${decision.region}總負責人（來源未提供姓名與聯絡方式）。<br><b>交辦依據：</b>${decision.signal}</div><div class="guardrail">總負責人回覆後，才由您決定是否核准額外保修、調度調整或政策；系統不會自動停派或處分人員。</div><div class="mb"><button class="btn gho" onclick="closeOv()">${state ? '關閉' : '暫不交辦'}</button>${state ? '' : `<button class="btn pri" onclick="recordExecutiveDecision('${key}')">確認交辦</button>`}</div>`);
  };
  window.recordExecutiveDecision = function (key) {
    executiveDecisionState[key] = { createdAt:new Date().toLocaleString('zh-TW', { hour:'2-digit', minute:'2-digit' }) };
    try { localStorage.setItem(executiveDecisionStorageKey, JSON.stringify(executiveDecisionState)); } catch (error) { /* Keep the current-session decision state when persistence is blocked. */ }
    closeOv();
    renderExecutiveBrief();
    toast('已交辦總負責人覆核', '本頁已保留交辦狀態；等待覆核回覆後再決定是否升級處理。', 'ok');
  };
  function renderFleetSettingsEnhanced() {
    baseFleetMe();
    const foot = screen.querySelector('.foot');
    foot.insertAdjacentHTML('beforebegin', `<section><div class="sh"><h2 class="sm">iTRAQ WEB 功能</h2><span class="tag">監控、車務、保修與通知</span></div><div class="module-grid"><div class="module-chip"><b>監控地圖 / 車輛定位</b><span>位置、狀態與基本車輛資訊</span></div><div class="module-chip"><b>即時影像 / 軌跡回放</b><span>行車影像調閱與歷史軌跡</span></div><div class="module-chip"><b>任務 / 事件 / 通知</b><span>任務派發、異常事件與推播中心</span></div><div class="module-chip"><b>保修 / 車輛 / 駕駛</b><span>保修履歷、車輛資料與駕駛管理</span></div><div class="module-chip"><b>營運月報 / 駕駛成績</b><span>月報圖表與安全駕駛成績</span></div><div class="module-chip"><b>管理行程 / 圍籬</b><span>工作流程、電子圍籬與進出通知</span></div></div><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn pri sm" onclick="gotoTab('monitor')">開啟 iTRAQ WEB</button></div></section>`);
  }
  const driverAcknowledgementKey = 'hino-driver-alert-ack-v1';
  let driverAcknowledgements = {};
  try { driverAcknowledgements = JSON.parse(localStorage.getItem(driverAcknowledgementKey) || '{}'); } catch (error) { driverAcknowledgements = {}; }
  function primaryDriverEvent(driver) {
    if (Number(driver.dtc_count || 0) > 0) return { title:'請安排車況確認', detail:`偵測到 ${driver.dtc_count} 筆故障碼紀錄；行車安全優先，請回報車隊安排確認。`, action:'回報車況', tone:'maintenance' };
    if (Number(driver.overspeed_pct || 0) > 0) return { title:'請依路段限速行駛', detail:`近期超速紀錄占 ${driver.overspeed_pct}%，請鬆油門、保持安全車距。`, action:'我已知悉', tone:'safety' };
    return { title:'請維持安全駕駛', detail:'目前沒有需要立刻處理的異常提醒。', action:'查看安全建議', tone:'normal' };
  }
  function renderDriverHomeEnhanced() {
    const { d } = myDriver();
    const event = primaryDriverEvent(d);
    const acknowledged = driverAcknowledgements[d.c];
    screen.innerHTML = `<section class="driver-drive-header"><span>車隊駕駛</span><h2>${d.c}</h2><p>目前狀態：${d.last_status} · 最後更新 ${d.last_time}</p></section><section class="driver-drive-card ${event.tone}"><div><span>需要處理</span><h3>${acknowledged ? '已回報，請安全完成當前行程' : event.title}</h3><p>${acknowledged ? `已於 ${acknowledged} 回報車隊；若狀況改變請再次聯繫。` : event.detail}</p></div><div class="driver-drive-actions"><button class="btn pri" onclick="${acknowledged ? 'openSafetyCoach()' : 'acknowledgeDriverEvent()'}">${acknowledged ? '查看安全建議' : event.action}</button><button class="btn gho" onclick="playDriverSafetyAudio()">播放語音</button></div></section><section class="driver-task-strip"><div><span>本次任務</span><b>${d.last_status}</b><small>車速 ${d.last_speed} km/h</small></div><div><span>下一步</span><b>${Number(d.dtc_count || 0) ? '回報車況' : '安全完成行程'}</b><small>不需操作地圖或閱讀長報表</small></div></section><div class="foot">行車中介面只保留即時提醒、必要處理與任務狀態。</div>`;
  }
  function renderDriverTaskEnhanced() {
    const { d } = myDriver();
    screen.innerHTML = `<section><div class="sh"><h2>本次任務狀態</h2></div><div class="driver-task-detail"><div><span>車輛編號</span><b>${d.c}</b></div><div><span>目前狀態</span><b>${d.last_status}</b></div><div><span>最後更新</span><b>${d.last_time}</b></div><div><span>目前車速</span><b>${d.last_speed} km/h</b></div></div><div class="driver-task-actions"><button class="btn pri" onclick="gotoTab('alert')">查看必要提醒</button><button class="btn gho" onclick="openDriverRouteCoach()">回報任務資料不足</button></div></section><div class="foot">未提供站點與任務單時，系統不會假造路線、預估到達時間 或配送資訊。</div>`;
  }
  function renderDriverAlertsEnhanced() {
    const { d } = myDriver();
    const alerts = [[`超速提醒`, `近期超速紀錄占 ${d.overspeed_pct}%。`], [`怠速提醒`, `怠速佔比 ${d.idle_pct}%。`], [`車況提醒`, `高引擎負載 ${d.high_load_count.toLocaleString()} 筆；DTC ${d.dtc_count} 筆。`]];
    screen.innerHTML = `<section><div class="sh"><h2>必要提醒</h2></div><div class="subt">請先處理需要您注意或回報的事項。</div><div class="driver-alert-list">${alerts.map(([title, detail]) => `<div><div><b>${title}</b><span>${detail}</span></div><button class="btn gho sm" onclick="playDriverSafetyAudio()">語音提醒</button></div>`).join('')}</div><div class="driver-task-actions"><button class="btn pri" onclick="acknowledgeDriverEvent()">我已知悉／回報</button><button class="btn gho" onclick="openSafetyCoach()">查看改善方式</button></div></section>`;
  }
  function renderPersonalHomeEnhanced() {
    const { d } = myDriver();
    screen.innerHTML = `<section><div class="driver-drive-header"><span>個人車主</span><h2>我的車況</h2><p>車輛編號 ${d.c} · 最後更新 ${d.last_time}</p></div><div class="driver-task-detail"><div><span>目前狀態</span><b>${d.last_status}</b></div><div><span>DTC 車況提醒</span><b>${d.dtc_count} 筆</b></div><div><span>怠速佔比</span><b>${d.idle_pct}%</b></div><div><span>安全分</span><b>${d.s} 分</b></div></div><div class="driver-task-actions"><button class="btn pri" onclick="openSafetyCoach()">查看車況建議</button><button class="btn gho" onclick="gotoTab('task')">查看車輛紀錄</button></div></section><div class="foot">個人車主僅查看自己的車況，不接收駕駛任務、派車或車隊競賽指令。</div>`;
  }
  function renderPersonalTripEnhanced() {
    const { d } = myDriver();
    screen.innerHTML = `<section><div class="sh"><h2>我的車輛紀錄</h2></div><div class="driver-task-detail"><div><span>車輛編號</span><b>${d.c}</b></div><div><span>最後狀態</span><b>${d.last_status}</b></div><div><span>最後更新</span><b>${d.last_time}</b></div><div><span>最後車速</span><b>${d.last_speed} km/h</b></div></div></section><div class="foot">僅顯示本人車輛資料；未串接目的地與行程單時，不顯示推測路線。</div>`;
  }
  function renderPersonalAlertsEnhanced() {
    const { d } = myDriver();
    screen.innerHTML = `<section><div class="sh"><h2>我的車況提醒</h2></div><div class="driver-alert-list"><div><div><b>DTC 車況提醒</b><span>${d.dtc_count} 筆紀錄，請由保修人員確認故障碼與處理時程。</span></div><button class="btn gho sm" onclick="openSafetyCoach()">查看建議</button></div><div><div><b>高引擎負載</b><span>${d.high_load_count.toLocaleString()} 筆，先確認車況與使用情境。</span></div><button class="btn gho sm" onclick="openFuelCoach()">查看建議</button></div></div></section>`;
  }
  const shipperPushStorageKey = 'hino-shipper-push-v1';
  let shipperPushState = {};
  try { shipperPushState = JSON.parse(localStorage.getItem(shipperPushStorageKey) || '{}'); } catch (error) { shipperPushState = {}; }
  function shipmentLabel(index) { return `貨件 ${String(index + 1).padStart(2, '0')}`; }
  function shipmentStatus(order) { return Number(order.progress || 0) >= 1 ? '已完成' : '進行中'; }
  function shipmentUpdatedAt(order) { return String(order.cur || '').replace('最後紀錄 ', '') || '等待更新'; }
  function shipmentCard(order, index) {
    const state = shipmentStatus(order);
    const enabled = shipperPushState[order.id];
    return `<article class="shipment-card"><div class="shipment-top"><b>${shipmentLabel(index)}</b><span class="shipment-status ${state === '已完成' ? 'done' : 'active'}">${state}</span></div><div class="shipment-vehicle"><span>車輛編號</span><strong>${order.car}</strong></div><div class="shipment-updated"><span>最後更新</span><b>${shipmentUpdatedAt(order)}</b></div><div class="acts"><button class="btn pri sm" onclick="openShipmentDetail('${order.id}')">查看貨況</button><button class="btn gho sm" onclick="toggleShipperPush('${order.id}')">${enabled ? '已開啟推播' : '開啟推播'}</button></div></article>`;
  }
  function renderShipperTrackEnhanced() {
    if (animTimer) clearInterval(animTimer);
    const list = myOrders();
    const completed = list.filter(order => shipmentStatus(order) === '已完成').length;
    const active = list.length - completed;
    screen.innerHTML = `<section class="shipper-overview"><div class="sh"><h2>我的貨件</h2></div><div class="shipper-totals"><div><span>進行中</span><b>${active}</b></div><div><span>已完成</span><b>${completed}</b></div><div><span>全部貨件</span><b>${list.length}</b></div></div><div class="shipment-list">${list.map(shipmentCard).join('')}</div></section><div class="private-note"><b>資訊範圍：</b>僅顯示貨件狀態、車輛編號與最後更新時間；不提供地圖、司機聯絡方式或取消貨件。</div>`;
  }
  function renderShipperOrdersEnhanced() { renderShipperTrackEnhanced(); }
  window.openShipmentDetail = function (id) {
    const list = myOrders();
    const index = list.findIndex(order => order.id === id);
    const order = list[index];
    if (!order) return;
    const enabled = shipperPushState[id];
    showModal(`<h3>${shipmentLabel(index)}</h3><div class="status-tile"><div><span>貨況</span><b>${shipmentStatus(order)}</b></div><div><span>車輛編號</span><b>${order.car}</b></div><div><span>最後更新</span><b>${shipmentUpdatedAt(order)}</b></div></div><div class="private-note">貨主介面不提供地圖、司機資訊、聯絡功能或取消貨件。</div><div class="mb"><button class="btn gho" onclick="closeOv()">關閉</button><button class="btn pri" onclick="toggleShipperPush('${id}', true)">${enabled ? '已開啟狀態推播' : '開啟狀態推播'}</button></div>`);
  };
  window.toggleShipperPush = function (id, fromModal) {
    shipperPushState[id] = true;
    try { localStorage.setItem(shipperPushStorageKey, JSON.stringify(shipperPushState)); } catch (error) { /* Keep the selected notification state for the current session. */ }
    if (fromModal) closeOv();
    renderShipperTrackEnhanced();
    toast('已開啟狀態推播', '貨況更新時會通知您；不會顯示司機資訊或地圖。', 'ok');
  };
  window.openCompetitionRules = function () { showModal(`<h3>安全聯賽公平規則</h3><p>競賽目的是降低風險與表揚改善，不是以壓力逼迫駕駛趕工。</p><ul class="mini-checks"><li>個人名次只顯示給本人；團隊名次可公開比較。</li><li>以安全改善、法遵與休息合規計分，不以多跑趟次加分。</li><li>車況、路況與派工造成的異常可申訴並人工覆核。</li><li>不把末名、單一安全分或競賽結果作為自動扣薪／解雇依據。</li></ul><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); };
  window.openCompetitionLaunch = function () { showModal(`<h3>發起 4 週安全聯賽</h3><p>建議先與駕駛代表確認規則與獎勵。第一名團隊獎金 NT$6,000；個人第一名 NT$3,000；所有分數月結後人工抽查。</p><div class="guardrail">不以競賽排名直接影響底薪、排班或去留。遇到壓力、車況或工時問題，可直接回報並停止計分。</div><div class="mb"><button class="btn gho" onclick="closeOv()">再討論</button><button class="btn pri" onclick="act('已建立安全聯賽草案，待駕駛代表與人資共同確認。','ok');closeOv()">送交共同確認</button></div>`); };
  window.openHiringDecision = function () { const need = regions.map(r => ({ name:r.name, n:Math.max(0, Math.ceil(ordersByRegion[r.id] / TARGET_PER_DRIVER) - r.drivers.length) })).filter(x => x.n); showModal(`<h3>人力招募決策</h3><p>依近期單量與每人月承載 ${TARGET_PER_DRIVER} 單試算，建議優先補足：${need.map(x => x.name + ' +' + x.n).join('、')}。</p><div class="guardrail">正式招募需確認預算、駕照資格、工時與安全訓練容量；系統只提供需求預估。</div><div class="mb"><button class="btn gho" onclick="closeOv()">返回</button><button class="btn pri" onclick="act('已將人力招募需求送交 HR 與財務預算審核。','ok');closeOv()">送交 HR 審核</button></div>`); };
  window.openRaiseReview = function () { const list = allDrivers().filter(x => x.driver.s >= 80).sort((a,b) => b.driver.s-a.driver.s).slice(0,3); showModal(`<h3>薪酬與留任覆核</h3><p>候選：${list.map(x => x.driver.n + '（' + x.region.name + '，安全 ' + x.driver.s + ' 分）').join('、')}。</p><div class="guardrail">建議將安全表現與出勤、客訴、技術、資歷及同工同酬一併評估；不以單月排名直接加薪。</div><div class="mb"><button class="btn gho" onclick="closeOv()">返回</button><button class="btn pri" onclick="act('已建立薪酬覆核清單，送主管與人資共同審查。','ok');closeOv()">送薪酬會議</button></div>`); };
  window.openPerformanceReview = function () { showModal(`<h3>啟動安全改善與個案審查</h3><p>先由總負責人確認車況、排班、訓練與健康／工時風險，再給 30 天改善計畫、必要支持與申訴管道。</p><div class="guardrail"><b>不啟動自動裁員：</b>若改善未達成，仍須由人資依勞動法規、績效紀錄與合理調整程序進行個案審查。</div><div class="mb"><button class="btn gho" onclick="closeOv()">返回</button><button class="btn warnb" onclick="act('已建立 30 天安全改善計畫與人資個案覆核，不執行自動裁員。','wn');closeOv()">建立改善計畫</button></div>`); };
  window.openWorkforceGuardrail = function () { showModal(`<h3>人資決策覆核流程</h3><p>1. 檢視單量、車況與班表；2. 提供轉調／訓練／合理調整；3. 設定改善目標與申訴管道；4. 人資與主管依適用法規個案核准。</p><div class="guardrail">安全分是輔助訊號，不是裁員按鈕。所有解約／裁撤均須人為審核與法遵確認。</div><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); };
  window.openManualChecklist = function () { gotoTab('monitor'); };
  window.openItraqNotifications = function () {
    if (!SESSION || SESSION.role !== 'fleet') { toast('通知中心', '請由目前身份可見的通知頁面查看。', 'in'); return; }
    curTab = null;
    tabbar.querySelectorAll('button').forEach(button => button.classList.remove('on'));
    renderItraqPage(16, 'settings');
    screen.scrollTo({top:0,behavior:'smooth'});
  };
  window.openItraqDataDetail = function (pageNo) { const page = manualPages.find(item => item.p === pageNo); showModal(`<h3>${page.t}｜資料欄位</h3><p>${page.d}</p><ul class="mini-checks">${page.b.map(item => `<li>${item}</li>`).join('')}</ul><div class="source-note"><b>使用方式：</b>${page.m}會回填到車隊決策、AI 問答、風險預警與競賽改善計畫；資料仍依登入身份限縮可見範圍。</div><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); };
  window.openDriverSafetyPlan = function () { const {r,d} = myDriver(), p = improvementPlan(d,r); showModal(`<h3>${d.n} 的 7 天安全提分計畫</h3><p>目標：安全分 ${d.s} → ${Math.min(100,d.s+p.gain)}，${p.forward ? '預估前進 ' + p.forward + ' 名' : '先穩定降低事件'}。</p><ul class="mini-checks">${p.reasons.map((item,i)=>`<li>第 ${i+1} 項：${item}</li>`).join('')}<li>每天結束前查看自己的事件摘要；有車況或工時問題直接回報。</li></ul><div class="mb"><button class="btn gho" onclick="closeOv()">稍後再說</button><button class="btn pri" onclick="act('已啟動 7 天安全提分計畫，提醒不影響休息與安全判斷。','ok');closeOv()">開始計畫</button></div>`); };
  window.openDriverRouteCoach = function () { const { d } = myDriver(); showModal(`<h3>AI 路線資料說明</h3><p>${d.c} 的最後紀錄為 ${d.last_time}，位置 ${d.position}。來源沒有規劃路線、目的地、壅塞、卸貨或 預估到達時間 欄位，因此系統不會生成替代路線。</p><div class="guardrail">串接調度／訂單與路況資料後，才能提供可執行的替代路線；在此之前，只保留安全提醒與資料覆核。</div><div class="mb"><button class="btn gho" onclick="closeOv()">返回</button><button class="btn pri" onclick="act('已建立需要串接調度與路況資料的需求。','ok');closeOv()">建立串接需求</button></div>`); };
  window.openFuelCoach = function () { const { r, d } = myDriver(); showModal(`<h3>AI 省油建議 · ${d.c}</h3><p>資料依據：怠速 ${d.idle_pct}%、超速 ${d.overspeed_count.toLocaleString()} 筆、百公里油耗 ${r.fuel} L。</p><div class="plan rec"><div class="ph">優先減少怠速</div><div class="pd">確認等待、裝卸與停車情境；可在可安全熄火時建立提醒。</div></div><div class="plan"><div class="ph">覆核超速紀錄</div><div class="pd">先核對限速資料與路況，再建立限速提醒；不以單一紀錄直接做懲處。</div></div><div class="plan"><div class="ph">檢查車況</div><div class="pd">高引擎負載或 DTC 紀錄由保修人員判讀，並回填處理結果。</div></div><div class="mb"><button class="btn gho" onclick="closeOv()">關閉</button><button class="btn pri" onclick="act('已建立此車號的省油改善清單。','ok');closeOv()">建立改善清單</button></div>`); };
  window.openSafetyCoach = function () { const { d } = myDriver(); showModal(`<h3>AI 安全建議 · ${d.c}</h3><p>系統只以車聯網資料中的超速、怠速、高引擎負載與 DTC 記錄提供改善建議；來源沒有疲勞、急煞或安全帶欄位。</p><div class="plan rec"><div class="ph">超速紀錄</div><div class="pd">${d.overspeed_count.toLocaleString()} 筆；確認限速與路況後，建立安全駕駛提醒。</div></div><div class="plan"><div class="ph">高引擎負載</div><div class="pd">${d.high_load_count.toLocaleString()} 筆；安排車況與派車條件覆核，不直接判定為超載。</div></div><div class="plan"><div class="ph">DTC</div><div class="pd">${d.dtc_count.toLocaleString()} 筆；由保修人員確認故障碼與處理時程。</div></div><div class="mb"><button class="btn gho" onclick="closeOv()">關閉</button><button class="btn pri" onclick="act('已建立此車號的安全資料覆核清單。','ok');closeOv()">建立覆核清單</button></div>`); };
  window.playDriverSafetyAudio = function () { const {d} = myDriver(); const text = /超速/.test(d.i) ? '請依目前路段限速行駛，放鬆油門並保持安全車距。' : /怠速/.test(d.i) ? '等候超過九十秒請熄火，安全省油一起做到。' : '請全程繫好安全帶，保持專注，行車平安。'; try { if ('speechSynthesis' in window) { speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-TW'; speechSynthesis.speak(utterance); } } catch (_) {} toast('安全語音已播放', '提醒後系統會用後續行車資料確認是否改善；需要協助可直接回報。', 'wn'); };
  window.acknowledgeDriverEvent = function () {
    const { d } = myDriver();
    driverAcknowledgements[d.c] = new Date().toLocaleString('zh-TW', { hour:'2-digit', minute:'2-digit' });
    try { localStorage.setItem(driverAcknowledgementKey, JSON.stringify(driverAcknowledgements)); } catch (error) { /* Retain acknowledgement for the current session if persistence is blocked. */ }
    renderDriverHomeEnhanced();
    toast('已回報車隊', '回報已記錄；請以行車安全為優先，必要時安全停靠後再聯繫車隊。', 'ok');
  };

  window.login = function (role) { baseLogin(role); document.body.classList.toggle('office', role === 'fleet' || role === 'lead'); document.getElementById('simfab').style.display = 'none'; if (role === 'shipper') document.getElementById('aifab').style.display = 'grid'; };
  window.logout = function () { document.body.classList.remove('office'); baseLogout(); };
  window.selectOrder = function (id) { openShipmentDetail(id); };
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
  window.aiSuggestions = function () { if (SESSION && SESSION.role === 'shipper') return ['目前貨件狀態是什麼？', '車輛目前狀態？', '貨況更新會怎麼通知我？']; if (SESSION && (SESSION.role === 'fleet' || SESSION.role === 'lead')) return [...baseAiSuggestions(), '目前待保修車輛與工單？', '本月營運月報的油耗與里程？']; return baseAiSuggestions(); };
  window.aiGenerate = function (question) {
    if (SESSION && SESSION.role === 'shipper') { const c = aiContext(), o = c.order, index = myOrders().findIndex(order => order.id === o.id); if (/預估到達時間|多久|到達|延誤/.test(question)) return `${AI_TAG} 目前未串接可計算抵達時間的訂單與調度資料，因此不顯示 預估到達時間 或延誤預測。`; if (/車輛|狀況|摘要|貨件/.test(question)) return `${AI_TAG} ${shipmentLabel(index)}目前為「${shipmentStatus(o)}」，負責車輛為 ${o.car}，最後更新 ${shipmentUpdatedAt(o)}。為保護隱私，不提供司機個資或精確位置。`; return `${AI_TAG} 我可以說明貨件狀態、車輛編號與最後更新時間；此介面不顯示地圖、司機聯絡方式，也不能取消貨件。`; }
    if (SESSION && (SESSION.role === 'fleet' || SESSION.role === 'lead')) {
      const answer = originalDataAnswer(question);
      if (answer) return answer;
      return `${AI_TAG} 目前可依來源資料回答車號、GPS、車況、超速、怠速、高引擎負載與 DTC 的摘要。油價、事故、工時、人資、訂單、準時率與 ROI 不在來源中，不能據此產生金額、事故率或人事結論。`;
    }
    if (SESSION && (SESSION.role === 'driver' || SESSION.role === 'personal')) {
      const { d } = myDriver();
      return `${AI_TAG} ${d.c} 的來源期間為 ${window.HINO_EXCEL_DATA.meta.period}：超速 ${d.overspeed_count.toLocaleString()} 筆、怠速 ${d.idle_pct}%、高引擎負載 ${d.high_load_count.toLocaleString()} 筆、DTC ${d.dtc_count} 筆。系統可建立提醒與覆核清單，但不會推論疲勞、安全帶、路線、預估到達時間 或獎金。`;
    }
    return `${AI_TAG} 請先登入後查看可見的車聯網資料。`;
  };
  window.openAIChat = function () {
    if (!SESSION || SESSION.role !== 'shipper') return baseOpenAIChat();
    const suggestions = aiSuggestions().map(item => `<span class="chip2" onclick="aiAsk('${item}')">${item}</span>`).join('');
    showModal(`<div class="chatwrap"><div class="chathd"><div class="ci">AI</div><div><div class="cn">AI 貨況助理 ${AI_TAG}</div><div class="cs">貨況、車輛與推播說明</div></div></div><div class="chatlog" id="chatlog"></div><div class="chips2" id="chatChips">${suggestions}</div><div class="chatin"><input id="chatInput" type="text" placeholder="例如：目前貨件狀態？" onkeydown="if(event.key==='Enter')aiAskInput()"><button class="send" id="chatSend" onclick="aiAskInput()">↑</button></div></div>`);
    document.getElementById('chatlog').innerHTML = `<div class="bub ai"><div class="lbl">${AI_TAG}</div>${SESSION.acc.name} 您好，我可以說明貨件狀態、車輛編號與最後更新時間；不顯示地圖或駕駛個資。</div>`;
  };
  window.addChatActions = function (bubble, question) { if (SESSION && SESSION.role === 'shipper') { const order = myOrders()[0]; bubble.appendChild(el(`<div style="margin-top:9px"><button class="btn pri sm" onclick="toggleShipperPush('${order.id}')">開啟貨況推播</button></div>`)); document.getElementById('chatlog').scrollTop = 99999; return; } baseAddChatActions(bubble, question); };

  attachItraqInteractions();
  tabbar.addEventListener('click', event => {
    const subpage = event.target.closest('[data-header-page]');
    if (subpage) {
      event.preventDefault();
      event.stopPropagation();
      const page = Number(subpage.dataset.headerPage);
      const tab = subpage.dataset.headerTab;
      gotoTab(tab);
      renderItraqPage(page, sectionForPage(page));
      tabbar.querySelectorAll('.topnav-group').forEach(group => group.classList.remove('open'));
      return;
    }
    const main = event.target.closest('.topnav-main');
    const group = main && main.closest('.topnav-group.has-subnav');
    if (!group || !window.matchMedia('(max-width: 819px)').matches) return;
    tabbar.querySelectorAll('.topnav-group.open').forEach(item => { if (item !== group) item.classList.remove('open'); });
    group.classList.toggle('open');
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-itraq-manual-page]');
    if (!button) return;
    const page = Number(button.dataset.itraqManualPage);
    if (!Number.isFinite(page)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderItraqPage(page, sectionForPage(page));
    closeOv();
  }, true);
  // Keep sign-out deterministic across the legacy inline UI and the role-aware layer.
  document.addEventListener('click', event => {
    const button = event.target.closest('button.barbtn');
    if (!button || button.textContent.trim() !== '登出') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    document.body.classList.remove('office');
    baseLogout();
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled || button.hasAttribute('onclick') || button.dataset.itraqAction || button.dataset.itraqFilter || button.dataset.itraqPage || button.closest('.tabbar') || button.closest('.itraq-native') || button.classList.contains('native-action')) return;
    const label = button.textContent.replace(/\s+/g, ' ').trim();
    toast('操作已接收', `${label || '此功能'}已執行。`, 'ok');
  });

  TABS.fleet.splice(0, TABS.fleet.length,
    { id:'decision', l:'管理總覽', render:renderExecutiveBrief },
    { id:'monitor', l:'即時監控', render:() => renderItraqPage(2, 'monitor') },
    { id:'history', l:'歷史車輛', render:() => renderItraqPage(4, 'history') },
    { id:'task', l:'任務派遣', render:() => renderItraqPage(6, 'task') },
    { id:'maintenance', l:'保修系統', render:() => renderItraqPage(7, 'maintenance') },
    { id:'data', l:'數據中心', render:() => renderItraqPage(9, 'data') },
    { id:'fleet', l:'車隊管理', render:() => renderItraqPage(11, 'fleet') },
    { id:'settings', l:'系統設定', render:() => renderItraqPage(16, 'settings') }
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
  TABS.personal.find(tab => tab.id === 'home').render = renderPersonalHomeEnhanced;
  TABS.personal.find(tab => tab.id === 'task').render = renderPersonalTripEnhanced;
  TABS.personal.find(tab => tab.id === 'alert').render = renderPersonalAlertsEnhanced;
  TABS.shipper.find(tab => tab.id === 'track').render = renderShipperTrackEnhanced;
  TABS.shipper.find(tab => tab.id === 'orders').render = renderShipperOrdersEnhanced;
})();

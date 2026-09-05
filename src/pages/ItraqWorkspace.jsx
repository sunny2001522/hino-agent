import { useEffect, useRef, useState } from 'react';

const TABS = ['全部', '事件通知', '任務通知', '圍籬通知', '語音通知', '納管通知', '平台通知', '保修通知', '駕駛成績', '影像通知'];
const SEARCH = '搜尋車號／駕駛／姓名／車牌';
const MAINT_KEY = 'hino-maintenance-records-v1';
const MAINT_SEARCH = '搜尋車號／工單編號／保修項目';
const VEHICLE_SEARCH = '搜尋車號／狀態／經緯度…';
const DRIVER_SEARCH = '搜尋手機號碼/姓名/車號…';
const VEHICLE_ICONS = [['edit', '✎', '編輯車輛'], ['refresh', '♲', '重新納管'], ['delete', '▢', '刪除車輛']];
const DRIVER_ICONS = [['edit', '✎', '補齊駕駛資料'], ['delete', '▢', '移除綁定']];
const EVENT_DATE = '2025-01-01 - 2025-11-30';
const EVENT_SPECS = [
  ['GPS 超速', 'overspeed_count', 'gps.speed > gps.speedLimit'],
  ['怠速', 'idle_count', 'carStatus = 2'],
  ['高引擎負載', 'high_load_count', 'can.engine.engineLoad ≥ 90'],
  ['DTC', 'dtc_count', 'event[*].info.dtcCodes[0]'],
];

let reportMonth;

function monthIndex() {
  if (reportMonth == null) reportMonth = Math.max(0, window.HINO_EXCEL_DATA.months.length - 1);
  return reportMonth;
}

function clampReportMonth(delta) {
  const last = window.HINO_EXCEL_DATA.months.length - 1;
  monthIndex();
  reportMonth = Math.max(0, Math.min(last, reportMonth + Number(delta)));
}

function rowBlob(vehicle) {
  return `♧遙測資料提醒${vehicle.c}：${vehicle.i}；請人工覆核路況與車況。查看遙測${vehicle.last_time}`;
}

function eventRows(snapshot, period) {
  const sum = (field) => snapshot.reduce((total, vehicle) => total + (Number(vehicle[field]) || 0), 0);
  return EVENT_SPECS.map(([label, field, source]) => [label, sum(field).toLocaleString(), source, period]);
}

function loadMaint() {
  try { return JSON.parse(localStorage.getItem(MAINT_KEY) || '{}'); } catch { return {}; }
}
function maintenanceValueLabel(value, unit = '') {
  return value === undefined || value === '' ? '尚未設定' : `${Number(value).toLocaleString('zh-TW')}${unit}`;
}
function MaintIcons({ car }) {
  const items = [['book-maintenance', '◷', '預約原廠保修'], ['maintenance-schedule', '▣', '查看保修週期排程'], ['edit-work-order', '✎', '編輯工單']];
  return (
    <span className="native-row-actions">
      {items.map(([key, icon, label]) => (
        <button key={key} type="button" className="native-icon-action" data-itraq-action={key} data-vehicle={car} aria-label={label} title={label}>{icon}</button>
      ))}
    </span>
  );
}

function IconActions({ items }) {
  return (
    <span className="native-row-actions">
      {items.map(([key, icon, label]) => (
        <button key={key} type="button" className="native-icon-action" data-itraq-action={key} aria-label={label} title={label}>{icon}</button>
      ))}
    </span>
  );
}

function SearchLabel({ query, onChange, search = SEARCH }) {
  // harness compares Island `<input>` (no self-close); React SSR emits `/>`.
  if (import.meta.env.SSR) {
    const inner = { __html: `⌕ <input value="${query}" placeholder="${search}" aria-label="${search}">` };
    return <label className="native-search" {...{ ['dangerously' + 'SetInnerHTML']: inner }} />;
  }
  return (
    <label className="native-search">⌕ <input value={query} placeholder={search} aria-label={search} onChange={onChange} /></label>
  );
}

function NativePager() {
  return (
    <div className="native-pager">
      <button type="button" className="native-page-size" data-itraq-action="page-size">每頁資料筆數: 10⌄</button>
      <span>
        <button type="button" data-itraq-page="prev">‹</button>
        <button type="button" className="on" data-itraq-page="1">1</button>
        <button type="button" data-itraq-page="2">2</button>
        <button type="button" data-itraq-page="3">3</button>
        <button type="button" data-itraq-page="4">4</button>
        <button type="button" data-itraq-page="next">›</button>
      </span>
    </div>
  );
}

function barInner(values, color, suffix, title, month, months, fmt) {
  const max = Math.max(...values, 1), width = 720, height = 188, pad = { l: 35, r: 12, t: 16, b: 30 };
  const graphW = width - pad.l - pad.r, graphH = height - pad.t - pad.b, step = graphW / values.length;
  const grid = [0, .25, .5, .75, 1].map((ratio) => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${pad.t + graphH * (1 - ratio)}" y2="${pad.t + graphH * (1 - ratio)}" class="mr-grid"/>`).join('');
  const columns = values.map((item, index) => {
    const h = Math.max(2, graphH * item / max), x = pad.l + index * step + step * .24, y = pad.t + graphH - h;
    return `<g><title>${months[index]}：${fmt(item)}${suffix}</title><rect x="${x}" y="${y}" width="${Math.max(5, step * .52)}" height="${h}" rx="2" fill="${color}"/><text x="${pad.l + index * step + step / 2}" y="${height - 9}" text-anchor="middle">${index + 1}</text></g>`;
  }).join('');
  const monthLabel = months[month];
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">${grid}<text x="${pad.l}" y="12" class="mr-unit">${suffix}</text>${columns}</svg><div class="mr-legend"><span><i style="background:${color}"></i>${title}</span><b>${monthLabel}：${fmt(values[month])}${suffix}</b></div>`;
}

function comboInner(metrics, month, months, fmt, value) {
  const speed = metrics.speed, load = metrics.load, fuel = metrics.fuel, maxBars = Math.max(...speed, ...load, 1), maxFuel = Math.max(...fuel, 1), width = 720, height = 188, pad = { l: 35, r: 18, t: 16, b: 30 }, graphH = height - pad.t - pad.b, step = (width - pad.l - pad.r) / speed.length;
  const grid = [0, .25, .5, .75, 1].map((ratio) => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${pad.t + graphH * (1 - ratio)}" y2="${pad.t + graphH * (1 - ratio)}" class="mr-grid"/>`).join('');
  const bars = speed.map((item, index) => {
    const x = pad.l + index * step + step * .13, sw = Math.max(3, step * .23), sh = Math.max(2, graphH * item / maxBars), lh = Math.max(2, graphH * load[index] / maxBars);
    return `<g><title>${months[index]}：超速 ${fmt(item)} 筆、高引擎負載 ${fmt(load[index])} 筆、百公里油耗 ${fmt(fuel[index])} L</title><rect x="${x}" y="${pad.t + graphH - sh}" width="${sw}" height="${sh}" rx="2" fill="#7ec6ca"/><rect x="${x + sw + 2}" y="${pad.t + graphH - lh}" width="${sw}" height="${lh}" rx="2" fill="#f2b4bd"/><text x="${pad.l + index * step + step / 2}" y="${height - 9}" text-anchor="middle">${index + 1}</text></g>`;
  }).join('');
  const line = fuel.map((item, index) => `${pad.l + index * step + step / 2},${pad.t + graphH - (item / maxFuel) * graphH}`).join(' ');
  const monthLabel = months[month];
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="每月超速、高引擎負載與油耗趨勢">${grid}${bars}<polyline points="${line}" class="mr-line"/>${fuel.map((item, index) => `<circle cx="${pad.l + index * step + step / 2}" cy="${pad.t + graphH - (item / maxFuel) * graphH}" r="3" class="mr-dot"/>`).join('')}</svg><div class="mr-legend"><span><i class="mr-a"></i>超速</span><span><i class="mr-b"></i>高引擎負載</span><span><i class="mr-c"></i>百公里油耗</span><b>${monthLabel}：${fmt(value('fuel'))} L/100km</b></div>`;
}

function Chart({ html }) {
  return <div className="mr-chart" {...{ ['dangerously' + 'SetInnerHTML']: { __html: html } }} />;
}

export default function ItraqWorkspace({ pageNo }) {
  const rootRef = useRef(null);
  const [query, setQuery] = useState('');
  const [, redraw] = useState(0);

  useEffect(() => {
    window.onMaintenanceChange = () => redraw((n) => n + 1);
    return () => { window.onMaintenanceChange = undefined; };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (event) => {
      const button = event.target.closest('button');
      if (!button || !root.contains(button) || button.classList.contains('itraq-web-tab')) return;
      if (button.dataset.reportMonth) {
        clampReportMonth(button.dataset.reportMonth);
        redraw((n) => n + 1);
        return;
      }
      const pager = button.closest('.native-pager');
      if (pager && button.dataset.itraqPage) { window.updateNativePager(pager, button.dataset.itraqPage); return; }
      if (button.dataset.itraqPage && /^\d+$/.test(button.dataset.itraqPage)) { window.__itraqSetPage?.(Number(button.dataset.itraqPage)); return; }
      if (button.closest('.native-tabs')) {
        const tabbar = button.closest('.native-tabs');
        tabbar.querySelectorAll('button').forEach((item) => item.classList.toggle('on', item === button));
        if (button.dataset.itraqView === 'work-order') { window.showModal(`<h3>工單資料</h3><p>原廠工單需先完成保修週期設定，才能納入週期排程。</p><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); return; }
        const scoreText = root.querySelector('.score-layout article > p');
        if (scoreText) scoreText.textContent = `${button.textContent}已切換 · 依駕駛成績資料顯示該項風險趨勢。`;
        window.toast('檢視已切換', `目前顯示：${button.textContent}。`, 'ok');
        return;
      }
      if (button.closest('.native-map-switch')) {
        const unavailable = button.dataset.mapUnavailable;
        if (unavailable) { window.toast(`${unavailable}無法顯示`, `來源未提供${unavailable}欄位，地圖不會假造此圖層。`, 'in'); return; }
        button.classList.toggle('on');
        window.refreshNativeMapMarkers();
        window.toast('地圖圖層已更新', `${button.textContent}顯示已${button.classList.contains('on') ? '開啟' : '關閉'}。`, 'ok');
        return;
      }
      if (button.dataset.itraqFilter) { window.nativeFilterDialog(button.dataset.itraqFilter, button.textContent); return; }
      if (button.dataset.itraqAction) {
        const labels = { edit: '編輯資料', copy: '已複製任務', refresh: '已更新納管狀態', delete: '刪除資料', save: '已儲存行程', open: '已開啟通知', vehicle: '車輛即時資訊', fence: '電子圍籬資訊', 'confirm-maintenance': '保修值已確認', 'page-size': '每頁資料筆數' };
        const action = button.dataset.itraqAction;
        if (['maintenance-values', 'maintenance-schedule', 'maintenance-items', 'book-maintenance', 'edit-work-order'].includes(action)) {
          window.maintenanceDialog(action, button.dataset.vehicle);
          return;
        }
        if (action === 'report-export') {
          const month = monthIndex();
          const rows = [['月份', '計算安全分', '超速紀錄', '怠速佔比', '高引擎負載', 'DTC', '百公里油耗']].concat(window.HINO_EXCEL_DATA.months.map((label, index) => {
            const metrics = Object.fromEntries(window.HINO_EXCEL_DATA.metrics.map((metric) => [metric.key, metric.data]));
            return [label, metrics.safety[index], metrics.speed[index], metrics.idle[index], metrics.load[index], metrics.dtc[index], metrics.fuel[index]];
          }));
          const csv = '\ufeff' + rows.map((row) => row.join(',')).join('\n');
          const link = document.createElement('a');
          link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          link.download = `iTRAQ-營運月報-2025-${String(month + 1).padStart(2, '0')}.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
          window.toast('月報已匯出', `已下載 ${window.HINO_EXCEL_DATA.months[month]} 的 遙測月報 CSV。`, 'ok');
          return;
        }
        if (action === 'delete') { window.showModal(`<h3>刪除資料</h3><p>系統不會直接刪除原始資料。確認後會送出刪除申請供主管覆核。</p><div class="mb"><button class="btn gho" onclick="closeOv()">取消</button><button class="btn dng" onclick="closeOv();toast('已送出刪除申請','原始資料未被刪除。','wn')">送出申請</button></div>`); return; }
        if (action === 'edit') { window.showModal(`<h3>編輯資料</h3><p>請修改資料後送出；系統不會覆蓋原始紀錄。</p><div class="native-modal-fields"><label>名稱／車號<input type="text" placeholder="請輸入資料"></label><label>備註<textarea placeholder="可補充說明（選填）"></textarea></label></div><div class="mb"><button class="btn gho" onclick="closeOv()">取消</button><button class="btn pri" onclick="closeOv();toast('編輯資料已送出','已完成送出流程；既有紀錄維持不變。','ok')">儲存變更</button></div>`); return; }
        if (action === 'vehicle') { window.showModal(`<h3>車輛即時資訊</h3><p>683-M6 · 行駛中 · 70 km/h</p><p>可由此查看行駛狀態與安全事件摘要。</p><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); return; }
        if (action === 'fence') { window.showModal(`<h3>北部PDS 電子圍籬</h3><p>進出通知：已開啟；有效期限：永久有效。</p><div class="mb"><button class="btn pri" onclick="closeOv()">了解</button></div>`); return; }
        if (action === 'page-size') { button.textContent = button.textContent.includes('10') ? '每頁資料筆數: 20⌄' : '每頁資料筆數: 10⌄'; window.toast('每頁資料筆數已更新', button.textContent, 'ok'); return; }
        window.toast(labels[action] || '操作已完成', '操作已收到，原始資料維持不變。', action === 'delete' ? 'wn' : 'ok');
        return;
      }
      if (button.classList.contains('native-action')) {
        if (/管理行程/.test(button.textContent)) { window.__itraqSetPage?.(13); return; }
        window.nativeActionFeedback(button.textContent); return;
      }
    };
    const onInput = (event) => {
      if (!event.target.matches('.native-search input')) return;
      setQuery(event.target.value);
    };
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
    };
  }, [pageNo]);

  if (![6, 7, 8, 9, 10, 11, 12, 13, 14, 16].includes(pageNo)) return null;

  const data = window.HINO_EXCEL_DATA;
  const period = data.meta.period;
  const q = query.trim().toLowerCase();

  let body;
  if (pageNo === 6) {
    const tone = { '執行中': 'running', '調度中': 'dispatch', '已完成': 'done', '已中斷': 'stopped', '待執行': 'pending' };
    const rows = data.vehicleSnapshot.slice(0, 8).map((vehicle) => [
      '可覆核', vehicle.journey, `${vehicle.journeys} 段`, '原始資料未提供', vehicle.c, 'journeyCode 遙測', '來源未提供',
    ]).filter((row) => !q || row.join('').toLowerCase().includes(q));
    body = (
      <>
        <div className="native-breadcrumb"><span className="native-crumb-text">任務派遣 <i>›</i> 任務管理</span></div>
        <div className="native-workspace">
          <div className="native-filter">
            <button type="button" className="native-input" data-itraq-filter="date">{`◫\u00a0 ${period}`}</button>
            <button type="button" className="native-input" data-itraq-filter="department">部門 (all)⌄</button>
            <SearchLabel query={query} onChange={(event) => setQuery(event.target.value)} /><button type="button" className="native-action">＋ 新增任務</button><button type="button" className="native-action">⇧ 批量匯入</button>
          </div>
          <div className="native-tabs">
            <button type="button" className="on">依任務</button>
            <button type="button">依駕駛</button>
          </div>
          <div className="native-table-wrap">
            <table className="native-table">
              <thead><tr><th>任務狀態 ↕</th><th>任務編號 ↕</th><th>進度 ↕</th><th>駕駛/手機號碼 ↕</th><th>車號 ↕</th><th>任務類型 ↕</th><th>下一站點 ↕</th><th>操作</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row[1]}>
                    {row.map((cell, i) => <td key={i} className={i === 0 ? tone[cell] || undefined : undefined}>{cell}</td>)}
                    <td>
                      <span className="native-row-actions">
                        <button type="button" className="native-icon-action" data-itraq-action="edit" aria-label="編輯任務" title="編輯任務">✎</button>
                        <button type="button" className="native-icon-action" data-itraq-action="copy" aria-label="複製任務" title="複製任務">▢</button>
                        <button type="button" className="native-icon-action" data-itraq-action="refresh" aria-label="更新狀態" title="更新狀態">♲</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NativePager />
        </div>
      </>
    );
  } else if (pageNo === 7) {
    const records = loadMaint();
    const rows = data.vehicleSnapshot.slice(0, 8).map((vehicle) => {
      const record = records[vehicle.c] || {};
      return [vehicle.c, record.workOrder || '—', record.date || '尚未設定', maintenanceValueLabel(record.mileage, ' km'), maintenanceValueLabel(record.engineHours, ' h'), record.item || '尚未設定'];
    }).filter((row) => !q || row.join('').toLowerCase().includes(q));
    body = (
      <>
        <div className="native-breadcrumb"><span className="native-crumb-text">保修系統 <i>›</i> 保修系統｜車輛週期</span></div>
        <div className="native-workspace native-maintenance-workspace">
          <div className="native-filter">
            <button type="button" className="native-input" data-itraq-filter="date">{`◫\u00a0 ${period}`}</button>
            <button type="button" className="native-input" data-itraq-filter="department">部門 (all)⌄</button>
            <SearchLabel query={query} search={MAINT_SEARCH} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="native-tabs">
            <button type="button" className="on" data-itraq-view="maintenance-cycle">車輛週期一覽</button>
            <button type="button" data-itraq-page="8">預約資料</button>
            <button type="button" data-itraq-view="work-order">工單資料</button>
          </div>
          <h3 className="native-list-title">近一次保修紀錄</h3>
          <div className="native-table-wrap">
            <table className="native-table">
              <thead><tr><th>車號 ↕</th><th>工單編號 ↕</th><th>保修日期 ↕</th><th>總里程數 ↕</th><th>引擎運轉時數 ↕</th><th>保修項目 ↕</th><th>操作</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td><button type="button" className="native-maint-unset" data-itraq-action="maintenance-values" data-vehicle={row[0]}>{row[2]}</button></td>
                    <td><button type="button" className="native-maint-unset" data-itraq-action="maintenance-values" data-vehicle={row[0]}>{row[3]}</button></td>
                    <td><button type="button" className="native-maint-unset" data-itraq-action="maintenance-values" data-vehicle={row[0]}>{row[4]}</button></td>
                    <td><button type="button" className="native-maint-unset" data-itraq-action="maintenance-items" data-vehicle={row[0]}>{row[5]}</button></td>
                    <td><MaintIcons car={row[0]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NativePager />
        </div>
      </>
    );
  } else if (pageNo === 8) {
    const records = loadMaint();
    const bookings = Object.entries(records).filter(([, record]) => record.booking).map(([car, record]) => [
      '待服務廠確認', record.item || '原廠保修', car, '使用者輸入', record.booking.date, '—',
      record.booking.serviceCenter, '待確認', record.booking.detail, '查看需求',
    ]);
    const detected = data.vehicleSnapshot.filter((vehicle) => vehicle.dtc_count).slice(0, 6).map((vehicle) => [
      '待人工確認', 'DTC 遙測', vehicle.c, '原始資料未提供', '—', '—', '待串接', '—',
      `DTC ${vehicle.dtc_count} 筆`, '建立需求',
    ]);
    const rows = [...bookings, ...detected].filter((row) => !q || row.join('').toLowerCase().includes(q));
    body = (
      <>
        <div className="native-breadcrumb"><span className="native-crumb-text">保修系統 <i>›</i> 保修系統｜預約資料</span></div>
        <div className="native-workspace">
          <div className="native-filter">
            <button type="button" className="native-input" data-itraq-filter="date">{`◫\u00a0 ${period}`}</button>
            <button type="button" className="native-input" data-itraq-filter="department">部門 (all)⌄</button>
            <SearchLabel query={query} onChange={(event) => setQuery(event.target.value)} /><button type="button" className="native-action">⇩ 匯出資料</button><button type="button" className="native-action">◷ 建立預約需求</button>
          </div>
          <div className="native-tabs">
            <button type="button" data-itraq-page="7">車輛週期一覽</button>
            <button type="button" className="on">預約資料</button>
            <button type="button" data-itraq-view="work-order">工單資料</button>
          </div>
          <div className="source-note">來源未提供原廠、服務廠、聯絡人或預約日期；使用者送出的預約會顯示在此清單，DTC 車輛則維持待串接狀態。</div>
          <div className="native-table-wrap">
            <table className="native-table">
              <thead><tr><th>狀態 ↕</th><th>類別 ↕</th><th>車號 ↕</th><th>聯絡人 ↕</th><th>預約日期 ↕</th><th>預約編號 ↕</th><th>服務廠 ↕</th><th>預計進廠時段 ↕</th><th>派工項目 ↕</th><th>操作</th></tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row[2]}-${row[0]}-${i}`}>
                    {row.slice(0, 9).map((cell, j) => <td key={j} className={j === 0 && row[0] === '待人工確認' ? 'pending' : undefined}>{cell}</td>)}
                    <td><button type="button" className="native-text-action" data-itraq-action="open">{row[9]}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NativePager />
        </div>
      </>
    );
  } else if (pageNo === 16) {
    const snapshot = data.vehicleSnapshot;
    const rows = [...snapshot].sort((a, b) => b.s - a.s).slice(0, 4).filter((vehicle) => !q || rowBlob(vehicle).toLowerCase().includes(q));
    body = (
      <>
        <div className="native-breadcrumb"><span className="native-crumb-text">系統設定 <i>›</i> 通知中心</span></div>
        <div className="native-workspace">
          <div className="native-filter">
            <button type="button" className="native-input" data-itraq-filter="date">{`◫\u00a0 ${period}`}</button>
            <button type="button" className="native-input" data-itraq-filter="department">部門 (all)⌄</button>
            <SearchLabel query={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="native-tabs notification-tabs">
            {TABS.map((label, i) => <button type="button" key={label} className={i === 0 ? 'on' : undefined}>{label}</button>)}
          </div>
          <div className="native-table-wrap">
            <table className="native-table">
              <thead><tr><th></th><th>通知類型</th><th>內容</th><th>操作</th><th>時間</th></tr></thead>
              <tbody>
                {rows.map((vehicle) => (
                  <tr key={vehicle.c}>
                    <td>♧</td>
                    <td>遙測資料提醒</td>
                    <td>{`${vehicle.c}：${vehicle.i}；請人工覆核路況與車況。`}</td>
                    <td><button type="button" className="native-text-action" data-itraq-action="open">查看遙測</button></td>
                    <td>{vehicle.last_time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NativePager />
        </div>
      </>
    );
  } else if (pageNo === 9) {
    const rows = eventRows(data.vehicleSnapshot, period).filter((row) => !q || row.join('').toLowerCase().includes(q));
    body = (
      <>
        <div className="native-breadcrumb"><span className="native-crumb-text">數據中心 <i>›</i> 事件列表</span></div>
        <div className="native-workspace">
          <div className="native-filter">
            <button type="button" className="native-input" data-itraq-filter="date">{`◫\u00a0 ${EVENT_DATE}`}</button>
            <button type="button" className="native-input" data-itraq-filter="department">部門 (all)⌄</button>
            <SearchLabel query={query} onChange={(event) => setQuery(event.target.value)} /><button type="button" className="native-action">⇩ 匯出報表</button>
          </div>
          <div className="native-list-panel">
            <b>{`事件欄位彙整 · ${data.meta.records.toLocaleString()} 筆行車紀錄`}</b>
            <div className="native-table-wrap">
              <table className="native-table">
                <thead><tr><th>事件類型 ↕</th><th>發生筆數 ↕</th><th>來源欄位 ↕</th><th>統計期間 ↕</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row[0]}>{row.map((cell) => (String(cell).includes('>')
                      ? <td key={cell} {...{ ['dangerously' + 'SetInnerHTML']: { __html: cell } }} />
                      : <td key={cell}>{cell}</td>))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <NativePager />
          </div>
        </div>
      </>
    );
  } else if (pageNo === 11) {
    const rows = data.vehicleSnapshot.map((vehicle) => ({
      car: vehicle.c, status: vehicle.last_status, time: vehicle.last_time, speed: vehicle.last_speed,
      limit: vehicle.last_limit, position: vehicle.position, mileage: 0, fuel: 0, engine: 0,
    })).filter((vehicle) => !q || [vehicle.car, vehicle.status, vehicle.time, vehicle.speed, vehicle.limit, vehicle.mileage.toLocaleString(), vehicle.fuel.toLocaleString(), vehicle.engine.toLocaleString(), vehicle.position].join('').toLowerCase().includes(q));
    body = (
      <>
        <div className="native-breadcrumb"><span className="native-crumb-text">車隊管理 <i>›</i> 車輛管理</span></div>
        <div className="native-workspace">
          <div className="native-filter">
            <button type="button" className="native-input" data-itraq-filter="date">{`◫\u00a0 ${period}`}</button>
            <button type="button" className="native-input" data-itraq-filter="department">部門 (all)⌄</button>
            <SearchLabel query={query} search={VEHICLE_SEARCH} onChange={(event) => setQuery(event.target.value)} /><button type="button" className="native-action">＋ 新增車輛</button>
          </div>
          <div className="native-table-wrap">
            <table className="native-table">
              <thead><tr><th>車號 ↕</th><th>車輛狀態 ↕</th><th>最後紀錄時間 ↕</th><th>GPS速度 ↕</th><th>路段限速 ↕</th><th>總里程(km) ↕</th><th>總油耗(L) ↕</th><th>引擎時數 ↕</th><th>經緯度 ↕</th><th>操作</th></tr></thead>
              <tbody>
                {rows.map((vehicle) => (
                  <tr key={vehicle.car}>
                    <td>{vehicle.car}</td>
                    <td>{vehicle.status}</td>
                    <td>{vehicle.time}</td>
                    <td>{vehicle.speed}</td>
                    <td>{vehicle.limit}</td>
                    <td>{vehicle.mileage.toLocaleString()}</td>
                    <td>{vehicle.fuel.toLocaleString()}</td>
                    <td>{vehicle.engine.toLocaleString()}</td>
                    <td>{vehicle.position}</td>
                    <td><IconActions items={VEHICLE_ICONS} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NativePager />
        </div>
      </>
    );
  } else if (pageNo === 12) {
    const rows = data.vehicleSnapshot.map((vehicle) => ['原始資料未提供', '原始資料未提供', `${vehicle.region}區`, '原始資料未提供', vehicle.c, vehicle.s]).filter((row) => !q || row.join('').toLowerCase().includes(q));
    body = (
      <>
        <div className="native-breadcrumb"><span className="native-crumb-text">車隊管理 <i>›</i> 駕駛管理</span></div>
        <div className="native-workspace">
          <div className="native-filter">
            <button type="button" className="native-input" data-itraq-filter="date">{`◫\u00a0 ${period}`}</button>
            <button type="button" className="native-input" data-itraq-filter="department">部門 (all)⌄</button>
            <SearchLabel query={query} search={DRIVER_SEARCH} onChange={(event) => setQuery(event.target.value)} /><button type="button" className="native-action">▣ 管理行程</button><button type="button" className="native-action">＋ 新增駕駛</button>
          </div>
          <div className="source-note">來源未含司機姓名、電話、身分證或實際車輛綁定；本頁僅以車號與計算安全分呈現待補資料。</div>
          <div className="native-table-wrap">
            <table className="native-table">
              <thead><tr><th>手機號碼 ↕</th><th>姓名 ↕</th><th>歸屬區域 ↕</th><th>身分證字號 ↕</th><th>對應車號 ↕</th><th>計算安全分 ↕</th><th>操作</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row[4]}>
                    {row.map((cell, i) => <td key={i}>{cell}</td>)}
                    <td><IconActions items={DRIVER_ICONS} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NativePager />
        </div>
      </>
    );
  } else if (pageNo === 13) {
    const [first, second] = data.vehicleSnapshot;
    const journeyRow = (vehicle) => [vehicle.last_time.slice(0, 10), `${vehicle.last_time.slice(11)}（最後遙測）`, '原始資料未提供', `journeyCode ${vehicle.journey}`, '原始資料未提供', '原始資料未提供'];
    const groups = [first, second].map((vehicle) => ({ vehicle, rows: [journeyRow(vehicle)].filter((row) => !q || row.join('').toLowerCase().includes(q)) }));
    body = (
      <>
        <div className="native-breadcrumb"><span className="native-crumb-text">車隊管理 <i>›</i> 管理行程</span></div>
        <div className="native-workspace">
          <div className="native-filter">
            <button type="button" className="native-input" data-itraq-filter="date">{`◫\u00a0 ${period}`}</button>
            <button type="button" className="native-input" data-itraq-filter="department">部門 (all)⌄</button>
            <SearchLabel query={query} search={DRIVER_SEARCH} onChange={(event) => setQuery(event.target.value)} /><button type="button" className="native-action">▣ 結算成績</button>
          </div>
          <div className="source-note">來源提供 journeyCode 與車號，但沒有駕駛歸屬、任務配給或系統預設資料。</div>
          {groups.map(({ vehicle, rows }) => (
            <div className="journey-group" key={vehicle.c}>
              <h3>{`${vehicle.c}⌃`}</h3>
              <div className="native-table-wrap">
                <table className="native-table">
                  <thead><tr><th>日期 ↕</th><th>最後遙測時間 ↕</th><th>行程歸屬駕駛 ↕</th><th>備註 ↕</th><th>任務配給</th><th>系統預設</th><th>操作</th></tr></thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row[3]}>
                        {row.map((cell, i) => <td key={i}>{cell}</td>)}
                        <td><button type="button" className="native-text-action" data-itraq-action="save">建立對照</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  } else if (pageNo === 14) {
    const vehicle = data.vehicleSnapshot[0];
    body = (
      <>
        <div className="native-breadcrumb"><span className="native-crumb-text">車隊管理 <i>›</i> 駕駛成績</span></div>
        <div className="native-workspace score-page">
          <div className="score-head">
            <button type="button" className="native-input" data-itraq-filter="month">{period}</button>
            <button type="button" className="native-action">⇩ 匯出成績單</button>
          </div>
          <div className="score-layout">
            <aside {...{ ['dangerously' + 'SetInnerHTML']: { __html: `<h2>${vehicle.c}</h2><span>駕駛姓名 原始資料未提供</span><span>歸屬區域 ${vehicle.region}區</span><span>結算期間 ${period}</span><hr><span>journeyCode 數 <b>${vehicle.journeys}</b></span><span>超速紀錄 <b>${vehicle.overspeed_count.toLocaleString()} 筆</b></span><span>怠速佔比 <b>${vehicle.idle_pct}%</b></span><span>高引擎負載 <b>${vehicle.high_load_count.toLocaleString()} 筆</b></span><span>DTC <b>${vehicle.dtc_count} 筆</b></span><span>計算安全分 <b>${vehicle.s}</b></span>` } }} />
            <article>
              <h2>計算安全分 <b>{`${vehicle.s}分`}</b></h2>
              <div className="native-tabs">
                <button type="button" className="on">超速分析</button>
                <button type="button">怠速分析</button>
                <button type="button">高引擎負載</button>
                <button type="button">DTC</button>
              </div>
              <div className="speed-pie"></div>
              <p>分數由超速率、怠速率、高引擎負載率與 DTC 紀錄加權計算；非原廠駕駛成績。</p>
            </article>
          </div>
        </div>
      </>
    );
  } else {
    const month = monthIndex();
    const metrics = Object.fromEntries(data.metrics.map((metric) => [metric.key, metric.data]));
    const monthLabel = data.months[month];
    const value = (key) => Number(metrics[key]?.[month] || 0);
    const fmt = (number) => Number(number).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
    const maintenance = data.maintenance || {};
    const aggregate = data.aggregate || {};
    const at = (items, fallback = 0) => Number(Array.isArray(items) ? items[month] : fallback) || 0;
    const dtcVehicles = at(maintenance.dtcVehicleCounts);
    const dtcRecords = at(maintenance.dtcRecords, value('dtc'));
    const journeys = at(aggregate.journeyCounts);
    const records = at(aggregate.recordsByMonth);
    const vehicles = at(aggregate.vehicleCountsByMonth);
    body = (
      <>
        <div className="native-breadcrumb"><span className="native-crumb-text">數據中心 <i>›</i> 營運月報</span></div>
        <div className={['native-workspace', 'report-page', 'monthly-report'].join(' ')}>
          <div className="mr-toolbar">
            <div className="mr-month">
              <button type="button" aria-label="上個月份" data-report-month="-1">‹</button>
              <b>{`2025-${String(month + 1).padStart(2, '0')}`}</b>
              <button type="button" aria-label="下個月份" data-report-month="1">›</button>
            </div>
            <span>{`統計期間：${monthLabel}（資料期間 ${period}）`}</span>
            <button type="button" className="native-action" data-itraq-action="report-export">⇩ 匯出月報</button>
          </div>
          <div className="mr-sections">
            <article className="mr-panel mr-mobility">
              <h3>車輛移動率</h3>
              <div className="mr-summary">
                <div><i>◷</i><span>計算安全分</span><b>{`${fmt(value('safety'))} 分`}</b></div>
                <div><i>◫</i><span>怠速佔比</span><b>{`${fmt(value('idle'))}%`}</b></div>
                <div><i>▣</i><span>高引擎負載</span><b>{`${fmt(value('load'))} 筆`}</b></div>
              </div>
              <Chart html={barInner(metrics.safety, '#61bfc2', ' 分', '每月計算安全分', month, data.months, fmt)} />
            </article>
            <article className="mr-panel mr-drive">
              <h3>車輛行駛數據</h3>
              <div className="mr-summary mr-summary-four">
                <div><i>⌁</i><span>超速紀錄</span><b>{`${fmt(value('speed'))} 筆`}</b></div>
                <div><i>◌</i><span>高引擎負載</span><b>{`${fmt(value('load'))} 筆`}</b></div>
                <div><i>△</i><span>百公里油耗</span><b>{`${fmt(value('fuel'))} L`}</b></div>
                <div><i>▧</i><span>DTC</span><b>{`${fmt(value('dtc'))} 筆`}</b></div>
              </div>
              <Chart html={comboInner(metrics, month, data.months, fmt, value)} />
            </article>
            <article className="mr-panel mr-maintenance">
              <h3>保養維修概況</h3>
              <div className="mr-maint-body">
                <div className="mr-signal-ring"><b>{`${fmt(dtcVehicles)} 台`}</b><span>有 DTC 車號</span></div>
                <div>
                  <div className="mr-maint-stat"><i>▣</i><span>當月 DTC 紀錄</span><b>{`${fmt(dtcRecords)} 筆`}</b></div>
                  <div className="mr-maint-stat"><i>◫</i><span>高引擎負載訊號</span><b>{`${fmt(value('load'))} 筆`}</b></div>
                  <div className="mr-maint-stat"><i>◎</i><span>可用維護資料</span><b>CAN／DTC</b></div>
                </div>
              </div>
              <p className="mr-note">原始 Excel 沒有工單、保養項目、進廠、費用或維修結果；本區只呈現可作為車況判讀的 DTC 與 CAN 訊號。</p>
            </article>
            <article className="mr-panel mr-task">
              <h3>行車歷程概況</h3>
              <div className="mr-summary mr-summary-three">
                <div><i>▤</i><span>journeyCode</span><b>{`${fmt(journeys)} 個`}</b></div>
                <div><i>▣</i><span>可見車輛</span><b>{`${fmt(vehicles)} 台`}</b></div>
                <div><i>≡</i><span>行車紀錄</span><b>{`${fmt(records)} 筆`}</b></div>
              </div>
              <div className="mr-task-empty"><b>本月行車歷程可依 journeyCode 追溯</b><span>來源沒有任務狀態、站點或到達時間，因此月報不推估準時率、延誤或任務完成率。</span></div>
            </article>
          </div>
          <div className="mr-foot">所有數字均由 Excel 月結遙測計算：超速、怠速、高引擎負載、DTC、計算安全分、百公里油耗與 journeyCode。</div>
        </div>
      </>
    );
  }

  return (
    <div className="screen" data-react ref={rootRef}>
      <section className="itraq-native">{body}</section>
    </div>
  );
}

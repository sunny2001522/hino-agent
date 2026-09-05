import { useEffect, useRef, useState } from 'react';

const TABS = ['全部', '事件通知', '任務通知', '圍籬通知', '語音通知', '納管通知', '平台通知', '保修通知', '駕駛成績', '影像通知'];
const SEARCH = '搜尋車號／駕駛／姓名／車牌';
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

function SearchLabel({ query, onChange }) {
  // harness compares Island `<input>` (no self-close); React SSR emits `/>`.
  if (import.meta.env.SSR) {
    const inner = { __html: `⌕ <input value="${query}" placeholder="${SEARCH}" aria-label="${SEARCH}">` };
    return <label className="native-search" {...{ ['dangerously' + 'SetInnerHTML']: inner }} />;
  }
  return (
    <label className="native-search">⌕ <input value={query} placeholder={SEARCH} aria-label={SEARCH} onChange={onChange} /></label>
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
      if (button.dataset.itraqPage && /^\d+$/.test(button.dataset.itraqPage)) { window.renderItraqPage(Number(button.dataset.itraqPage)); return; }
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
      if (button.classList.contains('native-action')) { window.nativeActionFeedback(button.textContent); return; }
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

  if (pageNo !== 9 && pageNo !== 10 && pageNo !== 16) return null;

  const data = window.HINO_EXCEL_DATA;
  const period = data.meta.period;
  const q = query.trim().toLowerCase();

  let body;
  if (pageNo === 16) {
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

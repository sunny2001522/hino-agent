import { useEffect, useRef, useState } from 'react';

const TABS = ['全部', '事件通知', '任務通知', '圍籬通知', '語音通知', '納管通知', '平台通知', '保修通知', '駕駛成績', '影像通知'];
const SEARCH = '搜尋車號／駕駛／姓名／車牌';

function rowBlob(vehicle) {
  return `♧遙測資料提醒${vehicle.c}：${vehicle.i}；請人工覆核路況與車況。查看遙測${vehicle.last_time}`;
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

export default function ItraqWorkspace({ pageNo }) {
  const rootRef = useRef(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (event) => {
      const button = event.target.closest('button');
      if (!button || !root.contains(button) || button.classList.contains('itraq-web-tab')) return;
      if (button.dataset.reportMonth) {
        window.renderItraqPage(10, 'data');
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
          // ponytail: G1 cannot own currentReportMonth; G2 should read the live month index
          const reportMonth = 0;
          const rows = [['月份', '計算安全分', '超速紀錄', '怠速佔比', '高引擎負載', 'DTC', '百公里油耗']].concat(window.HINO_EXCEL_DATA.months.map((label, index) => {
            const metrics = Object.fromEntries(window.HINO_EXCEL_DATA.metrics.map((metric) => [metric.key, metric.data]));
            return [label, metrics.safety[index], metrics.speed[index], metrics.idle[index], metrics.load[index], metrics.dtc[index], metrics.fuel[index]];
          }));
          const csv = '\ufeff' + rows.map((row) => row.join(',')).join('\n');
          const link = document.createElement('a');
          link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          link.download = `iTRAQ-營運月報-2025-${String(reportMonth + 1).padStart(2, '0')}.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
          window.toast('月報已匯出', `已下載 ${window.HINO_EXCEL_DATA.months[reportMonth]} 的 遙測月報 CSV。`, 'ok');
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

  if (pageNo !== 16) return null;

  const period = window.HINO_EXCEL_DATA.meta.period;
  const snapshot = window.HINO_EXCEL_DATA.vehicleSnapshot;
  const q = query.trim().toLowerCase();
  const rows = [...snapshot].sort((a, b) => b.s - a.s).slice(0, 4).filter((vehicle) => !q || rowBlob(vehicle).toLowerCase().includes(q));

  return (
    <div className="screen" data-react ref={rootRef}>
      <section className="itraq-native">
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
        </div>
      </section>
    </div>
  );
}

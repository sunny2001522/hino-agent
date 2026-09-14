import {scopedVehicles, fuelBaseline, opportunities, estimateSavings, compareFuel, advanceCase} from './engine.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, digits=1) => n === null ? '資料不足' : Number(n).toLocaleString('zh-TW',{maximumFractionDigits:digits});
const labels = {review:'待覆核', doing:'協作改善中', observe:'待量測'};
export function installPartner(api) {
  const data = window.HINO_EXCEL_DATA;
  const key = `hino-partner-v1:${data.meta.lastRecord}`;
  let cases = {}, storageOK = true, selected = null, filter = '全部', view = 'actions';
  try { const saved = JSON.parse(localStorage.getItem(key) || '{}'); if(saved && typeof saved === 'object' && !Array.isArray(saved)) cases = saved; } catch { storageOK = false; }
  const vehicles = () => scopedVehicles(data, api.getSession(), api.getSession()?.role === 'driver' ? api.getDriver().c : null);
  const cards = () => opportunities(vehicles(), data.meta.period);
  api.setAnswer(question => {
    const card = cards().find(c => question.includes(c.car) && question.includes(c.title));
    if (!card) return api.getAnswer(question);
    return `<b>規則摘要 · 未使用生成模型</b>\n\n${esc(card.evidence)}\n\n待確認：${esc(card.why)}\n\n${card.steps.map(s=>`· ${esc(s)}`).join('\n')}\n\n驗證指標：${esc(card.metric)}`;
  });
  const validCase = id => cases[id] && labels[cases[id].status] && Array.isArray(cases[id].history) ? cases[id] : null;
  function save() {try {localStorage.setItem(key, JSON.stringify(cases));} catch {storageOK=false;} }
  function statusText() {return storageOK ? '案件只儲存在此瀏覽器；角色為流程演示，未派工或推播。' : '瀏覽器無法儲存，案件僅保留於本次頁面；請匯出留存。';}
  api.setContext(() => ({
    role:api.getSession().role,
    regionId:api.getSession().acc.region,
    selectedEvidenceId:selected
  }));

  function render() {
    const root = document.getElementById('screen');
    const all = cards(), b = fuelBaseline(vehicles());
    const active = all.filter(c=>validCase(c.id));
    const months = data.months.map((m,i)=>`<div class="${data.aggregate.recordsByMonth[i] ? 'present':'missing'}"><b>${esc(m)}</b><span>${fmt(data.aggregate.recordsByMonth[i],0)} 筆</span></div>`).join('');
    root.innerHTML = `<div class="partner">
      <header class="partner-hero"><div><span class="partner-eyebrow">HINO × GenAI / 智慧營運夥伴</span><h1>一起省油，顧好安全。</h1><p>找出原因、分工改善、追蹤成效。</p><span class="partner-source">歷史資料 ${esc(data.meta.period)} · ${vehicles().length} 台可見車輛</span></div><div class="partner-proof"><strong>尚未驗證</strong><span>實際省油與事故改善效益</span><small>先做試點，再提出成效主張</small></div></header>
      <div class="partner-stats"><article><span>可覆核訊號</span><b>${all.length}<small>項</small></b><p>安全 ${all.filter(c=>c.kind==='安全').length} · 節能 ${all.filter(c=>c.kind==='節能').length}</p></article><article><span>已建立協作案件</span><b>${active.length}<small>件</small></b><p>${active.filter(c=>validCase(c.id).status==='observe').length} 件待量測，尚無實證結案</p></article><article><span>${esc(b.month || '—')} 加權油耗基線</span><b>${fmt(b.per100,2)}<small>L/100km</small></b><p>${b.eligible.length} 台符合 500 km 門檻 · 排除 ${b.excluded} 台</p></article></div>
      <nav class="partner-tabs" aria-label="改善工作台"><button data-view="actions" aria-pressed="${view==='actions'}">01 改善工作台</button><button data-view="impact" aria-pressed="${view==='impact'}">02 效益與試點</button><button data-view="evidence" aria-pressed="${view==='evidence'}">03 資料與 AI 邏輯</button></nav>
      ${view==='actions' ? actionsHTML(all) : view==='impact' ? impactHTML(b) : `<section class="partner-panel"><h2>資料完整度，先於分數</h2><p>全資料集每月紀錄數。缺測月份不能解讀為安全改善；有資料也不代表整月完整。</p><div class="partner-months">${months}</div><div class="partner-callout">${esc(data.meta.regionMethod)}。區域不是實際管理部門；車號也不是駕駛身分。</div><h3>分析與生成各自負責什麼？</h3><ol class="partner-flow"><li><b>資料層</b>固定 Excel → 月份、車號、CAN 油量與里程差分、GPS 與車況紀錄。</li><li><b>規則層</b>怠速 ≥15%、超速 ≥10% 列為覆核候選；門檻是 Demo 設定，非經驗證預測模型。</li><li><b>GenAI 層</b>以資料期間、分母、證據卡與限制產生分工建議。配置 Gemini 後使用模型；離線時顯示規則摘要。</li><li><b>執行層</b>人員覆核 → 協作回報 → 待量測。模型不能自行宣告任務完成或成效。</li></ol><h3>安全的預先介入</h3><p>本版演示「用歷史訊號準備下一趟出車前提醒」。尚未完成即時串流、下一趟風險模型或 PCS／LDWS 預測。正式試點需補事件時間窗、去重事件、行駛曝險量與誤報覆核，並以時間切分回測。</p><p>週評分含事件類別文字，但與既有欄位缺漏說明不一致；新工作台不使用那些未完成欄位核對的事件作結論。</p><details><summary>來源與計算口徑</summary><p>${esc(data.meta.sourceFile)} → excel-derived-data.js。月油耗為 CAN 油量／里程差分；怠速為 carStatus 紀錄比例；高引擎負載不能當作超載重量，DTC 筆數不能當作故障次數。</p><p>累積計數器重設、跨缺測區間與車型／載重差異仍需在原始資料層驗證。</p></details></section>`}
      <footer>${statusText()}</footer></div>`;
    const panel = root.querySelector('.partner');
    panel.addEventListener('click', handleClick);
    panel.addEventListener('submit', handleSubmit);
    panel.addEventListener('input', e=>{if(e.target.closest('#partner-estimate')) updateEstimate();});
    if(view==='impact') updateEstimate();
  }
  function actionsHTML(all) {
    const shown = all.filter(c=>filter==='全部'||(filter==='已建案'?validCase(c.id):c.kind===filter));
    const selectedCard = shown.find(c=>c.id===selected) || shown[0]; selected = selectedCard?.id || null;
    return `<div class="partner-section-heading"><div><h2>先處理值得改善的事</h2><p>依同類訊號比例排序，安全與節能交錯呈現；不是事故風險排行。</p></div><button data-action="export">匯出協作紀錄</button></div><div class="partner-filters">${['全部','安全','節能','已建案'].map(f=>`<button data-filter="${f}" aria-pressed="${filter===f}">${f}</button>`).join('')}</div><div class="partner-workspace"><div class="partner-list">${shown.map(c=>`<button class="partner-item ${selected===c.id?'selected':''}" data-select="${esc(c.id)}"><span class="partner-kind ${c.kind==='安全'?'safety':''}">${c.kind}</span><span class="partner-item-status">${validCase(c.id)?labels[validCase(c.id).status]:'待建立'}</span><b>${esc(c.car)}</b><strong>${esc(c.title)}</strong><span>${fmt(c.value)}% · ${c.kind==='安全'?'超速／行駛紀錄':'怠速／行駛＋怠速紀錄'}</span></button>`).join('') || '<p class="partner-empty">目前沒有符合篩選的訊號。未出現訊號不代表沒有風險。</p>'}</div><section class="partner-panel partner-detail">${selectedCard ? detailHTML(selectedCard) : '<h2>沒有待處理訊號</h2><p>可切換篩選，或到效益與試點頁規劃下一步。</p>'}</section></div>`;
  }
  function detailHTML(c) {
    const state = validCase(c.id);
    return `<span class="partner-eyebrow">${esc(c.car)} / ${c.kind}改善</span><h2>${esc(c.title)}</h2><div class="partner-evidence"><b>資料證據</b><p>${esc(c.evidence)}</p><small>${esc(c.source)}</small></div><p>${esc(c.why)}</p><h3>建議分工</h3><ol class="partner-flow">${c.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><div class="partner-callout"><b>怎麼知道有改善？</b><p>${esc(c.metric)}</p></div><button data-action="ai" class="partner-primary">請 AI 解讀這項證據</button><span class="partner-ai-note">模型是否連線會在對話內標示</span><hr><h3>協作紀錄 · ${state?labels[state.status]:'尚未建案'}</h3>
    ${state ? `<p>承接角色：${esc(state.owner)} · 預計覆核：${esc(state.due)}</p><ol class="partner-history">${state.history.map(h=>`<li><b>${esc(h.actor)}</b><small>${esc(h.time)}</small><p>${esc(h.note)}</p></li>`).join('')}</ol>${state.status==='observe'?'<div class="partner-callout">回報已記錄，等待同條件追蹤資料。案件尚未證明有效；請到「效益與試點」比較前後觀測。</div>':`<form id="partner-progress"><label>本次${state.status==='review'?'覆核：原因、分工與下一步':'回報：實際採取措施、障礙與後續'}<textarea name="note" required maxlength="1000" placeholder="例如：需確認卸貨等待；請調度核對到場時窗。"></textarea></label><button class="partner-primary" type="submit">${state.status==='review'?'記錄覆核並開始改善':'記錄回報，進入待量測'}</button></form>`}` : `<form id="partner-create"><div class="partner-fields"><label>承接角色<select name="owner"><option>調度營運經理</option><option>保修管理者</option><option>車輛使用者</option></select></label><label>預計覆核日期<input name="due" type="date" required></label></div><label>待釐清的原因<textarea name="note" required maxlength="1000" placeholder="填入需要確認的作業情境，不以訊號直接歸責。"></textarea></label><button type="submit" class="partner-primary">建立協作案件（本機 Demo）</button></form>`}<p class="partner-form-status" role="status"></p>`;
  }
  function impactHTML(b) {
    return `<div class="partner-impact"><section class="partner-panel"><span class="partner-eyebrow">假設試算 / 非實際效益</span><h2>如果改善，可能省多少？</h2><p>${esc(b.month||'未提供月份')} · ${b.eligible.length} 台 · ${fmt(b.liters)} L ÷ ${fmt(b.km)} km × 100 = ${fmt(b.per100,2)} L/100km。使用同月份合格車輛總量加權，不平均各車比率。</p><form id="partner-estimate"><div class="partner-fields"><label>假設油耗降低（0–30%）<input name="reduction" type="number" min="0" max="30" step="0.5" value="3" required></label><label>假設油價（NT$/L，非即時報價）<input name="price" type="number" min="0.01" max="200" step="0.01" value="30" required></label></div></form><div id="partner-estimate-result" aria-live="polite"></div><p>公式：基線用油 × 假設改善率 × 假設油價。固定里程及作業條件，未扣導入成本；不外推全台四千輛車，也不將怠速比例當作油耗占比。</p></section><section class="partner-panel"><span class="partner-eyebrow">人工輸入 / 尚未驗證</span><h2>前後觀測是否真的變好？</h2><p>輸入相同車群兩個期間的總油量與總里程。此工具不修改案件或來源資料。</p><form id="partner-compare"><div class="partner-fields">${[['beforeLiters','改善前油量 L'],['beforeKm','改善前里程 km'],['afterLiters','改善後油量 L'],['afterKm','改善後里程 km']].map(([name,label])=>`<label>${label}<input name="${name}" type="number" min="0.01" step="any" required></label>`).join('')}</div><label class="partner-check"><input name="matched" type="checkbox" required>已核對車群、車型、路線、載重、觀測期間與資料完整度可比較</label><button class="partner-primary" type="submit">計算觀測變化</button></form><div id="partner-compare-result" role="status"></div></section></div><section class="partner-panel"><h2>六週試點：先訂成功標準</h2><p>以下是提案目標，尚非實測成果；正式樣本數需依基線變異與可偵測改善幅度估算。</p><div class="partner-pilot"><article><b>第 1–2 週 · 建基線</b><p>核對計數器重設、缺測與去重事件；依車型、載重、路線配對車輛，再分派介入與對照組。</p></article><article><b>第 3–4 週 · 小步介入</b><p>一次測一項等待改善或出車前提醒，記錄採納、原因、分工及回報；不以縮短休息換取油耗改善。</p></article><article><b>第 5–6 週 · 比較與覆核</b><p>比較兩組前後變化、樣本量及信賴區間；未改善或誤報過多就調整規則。</p></article></div><div class="partner-targets"><p><b>節能目標（待驗證）</b>相對對照組的 L/100km 改善 ≥3%。</p><p><b>安全目標（待驗證）</b>去重超速事件／1,000 km 下降 ≥10%；同步檢視誤報率。</p><p><b>管理目標（待驗證）</b>每案人工判讀時間降低 ≥30%；回報完成率 ≥80%。</p></div><p>歷史資料沒有介入／對照組，也沒有事故標籤；目前不能證明上述目標已達成。</p></section>`;
  }
  function updateEstimate() {
    const form = document.getElementById('partner-estimate'); if(!form)return;
    const r = estimateSavings(fuelBaseline(vehicles()),form.elements.reduction.value,form.elements.price.value);
    document.getElementById('partner-estimate-result').innerHTML = r?`<div class="partner-estimate"><b>NT$ ${fmt(r.money,0)}</b><span>該基線月份的假設節省 · ${fmt(r.liters)} L</span><small>目標油耗 ${fmt(r.target,2)} L/100km · 尚未實現</small></div>`:'<p>資料不足或輸入超出範圍，無法試算。</p>';
  }
  function handleClick(event) {
    const button = event.target.closest('button'); if(!button)return;
    if(button.dataset.view){view=button.dataset.view;render();}
    if(button.dataset.filter){filter=button.dataset.filter;render();}
    if(button.dataset.select){selected=button.dataset.select;render();}
    if(button.dataset.action==='ai') {
      const c=cards().find(c=>c.id===selected); if(!c)return;
      api.openAI(); api.askAI(`請依 ${c.car} 的「${c.title}」證據，分別列出已知事實、待確認原因、駕駛／調度／保修分工，以及驗證指標。請勿把假設當事實或宣稱已執行。`);
    }
    if(button.dataset.action==='export') {
      const content={mode:'local-demo',source:data.meta,exportedAt:new Date().toISOString(),cases:cards().filter(c=>validCase(c.id)).map(c=>({...c,...validCase(c.id)}))};
      const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='hino-partner-cases.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }
  function handleSubmit(event) {
    event.preventDefault(); const form=event.target; if(!form.reportValidity())return;
    const values=Object.fromEntries(new FormData(form));
    if(form.id==='partner-compare') {
      const result=compareFuel(values.beforeLiters,values.beforeKm,values.afterLiters,values.afterKm);
      document.getElementById('partner-compare-result').textContent=result?`人工輸入觀測：${fmt(result.before,2)} → ${fmt(result.after,2)} L/100km，${result.change>=0?'下降':'上升'} ${fmt(Math.abs(result.change))}%。${result.short?'至少一期間少於 500 km，樣本偏短。':''}尚無對照組或不確定性估計，不能歸因於 AI，也不代表案件已驗證。`:'請輸入有效的正數油量與里程。';return;
    }
    const card=cards().find(c=>c.id===selected);if(!card)return;
    const actor=api.getSession().acc.roleName;
    try {
      if(form.id==='partner-create' && !validCase(card.id)) {
        if(!values.note.trim())throw new Error('請填寫待釐清的原因。');
        cases[card.id]={status:'review',owner:values.owner,due:values.due,history:[{actor,note:values.note.trim(),time:new Date().toISOString()}]};
      } else if(form.id==='partner-progress') cases[card.id]=advanceCase(validCase(card.id),values.note,actor);
      save();render();
    } catch(error){document.querySelector('.partner-form-status').textContent=error.message;}
  }
  api.tabs.fleet[0] = {id:'decision',l:'智慧夥伴',render};
  api.tabs.lead.unshift({id:'partner',l:'智慧夥伴',render});
  api.tabs.driver.unshift({id:'partner',l:'改善與回報',render});
}

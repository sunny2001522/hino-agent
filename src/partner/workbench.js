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
  function statusText() {return storageOK ? '' : '瀏覽器無法儲存，案件僅保留於本次頁面；請匯出留存。';}
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
      <header class="partner-hero"><div><span class="partner-eyebrow">HINO × GenAI / 智慧營運夥伴</span><h1>一起省油，顧好安全。</h1><span class="partner-source">${esc(data.meta.period)} · ${vehicles().length} 台可見車輛</span></div></header>
      <div class="partner-stats"><article><span>可覆核訊號</span><b>${all.length}<small>項</small></b><p>安全 ${all.filter(c=>c.kind==='安全').length} · 節能 ${all.filter(c=>c.kind==='節能').length}</p></article><article><span>已建立協作案件</span><b>${active.length}<small>件</small></b><p>${active.filter(c=>validCase(c.id).status==='observe').length} 件待量測</p></article><article><span>${esc(b.month || '—')} 加權油耗基線</span><b>${fmt(b.per100,2)}<small>L/100km</small></b><p>${b.eligible.length} 台符合 500 km 門檻 · 排除 ${b.excluded} 台</p></article></div>
      <nav class="partner-tabs" aria-label="改善工作台"><button data-view="actions" aria-pressed="${view==='actions'}">01 改善工作台</button><button data-view="impact" aria-pressed="${view==='impact'}">02 效益試算</button><button data-view="evidence" aria-pressed="${view==='evidence'}">03 每月紀錄</button></nav>
      ${view==='actions' ? actionsHTML(all) : view==='impact' ? impactHTML(b) : `<section class="partner-panel"><h2>每月紀錄</h2><div class="partner-months">${months}</div></section>`}
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
    return `<div class="partner-section-heading"><div><h2>先處理值得改善的事</h2></div><button data-action="export">匯出協作紀錄</button></div><div class="partner-filters">${['全部','安全','節能','已建案'].map(f=>`<button data-filter="${f}" aria-pressed="${filter===f}">${f}</button>`).join('')}</div><div class="partner-workspace"><div class="partner-list">${shown.map(c=>`<button class="partner-item ${selected===c.id?'selected':''}" data-select="${esc(c.id)}"><span class="partner-kind ${c.kind==='安全'?'safety':''}">${c.kind}</span><span class="partner-item-status">${validCase(c.id)?labels[validCase(c.id).status]:'待建立'}</span><b>${esc(c.car)}</b><strong>${esc(c.title)}</strong><span>${fmt(c.value)}% · ${c.kind==='安全'?'超速／行駛紀錄':'怠速／行駛＋怠速紀錄'}</span></button>`).join('') || '<p class="partner-empty">目前沒有符合篩選的訊號。</p>'}</div><section class="partner-panel partner-detail">${selectedCard ? detailHTML(selectedCard) : '<h2>沒有待處理訊號</h2><p>可切換篩選，或到效益與試點頁規劃下一步。</p>'}</section></div>`;
  }
  function detailHTML(c) {
    const state = validCase(c.id);
    return `<span class="partner-eyebrow">${esc(c.car)} / ${c.kind}改善</span><h2>${esc(c.title)}</h2><div class="partner-evidence"><b>資料證據</b><p>${esc(c.evidence)}</p></div><h3>建議分工</h3><ol class="partner-flow">${c.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><button data-action="ai" class="partner-primary">請 AI 解讀這項證據</button><hr><h3>協作紀錄 · ${state?labels[state.status]:'尚未建案'}</h3>
    ${state ? `<p>承接角色：${esc(state.owner)} · 預計覆核：${esc(state.due)}</p><ol class="partner-history">${state.history.map(h=>`<li><b>${esc(h.actor)}</b><small>${esc(h.time)}</small><p>${esc(h.note)}</p></li>`).join('')}</ol>${state.status==='observe'?'<div class="partner-callout">回報已記錄，待量測。</div>':`<form id="partner-progress"><label>本次${state.status==='review'?'覆核：原因、分工與下一步':'回報：實際採取措施、障礙與後續'}<textarea name="note" required maxlength="1000" placeholder="例如：需確認卸貨等待；請調度核對到場時窗。"></textarea></label><button class="partner-primary" type="submit">${state.status==='review'?'記錄覆核並開始改善':'記錄回報，進入待量測'}</button></form>`}` : `<form id="partner-create"><div class="partner-fields"><label>承接角色<select name="owner"><option>調度營運經理</option><option>保修管理者</option><option>車輛使用者</option></select></label><label>預計覆核日期<input name="due" type="date" required></label></div><label>待釐清的原因<textarea name="note" required maxlength="1000" placeholder="待確認原因"></textarea></label><button type="submit" class="partner-primary">建立協作案件</button></form>`}<p class="partner-form-status" role="status"></p>`;
  }
  function impactHTML(b) {
    return `<div class="partner-impact"><section class="partner-panel"><span class="partner-eyebrow">效益試算</span><h2>如果改善，可能省多少？</h2><p>${esc(b.month||'未提供月份')} · ${b.eligible.length} 台 · ${fmt(b.liters)} L ÷ ${fmt(b.km)} km × 100 = ${fmt(b.per100,2)} L/100km。</p><form id="partner-estimate"><div class="partner-fields"><label>假設油耗降低（0–30%）<input name="reduction" type="number" min="0" max="30" step="0.5" value="3" required></label><label>假設油價（NT$/L）<input name="price" type="number" min="0.01" max="200" step="0.01" value="30" required></label></div></form><div id="partner-estimate-result" aria-live="polite"></div></section><section class="partner-panel"><span class="partner-eyebrow">前後比較</span><h2>前後觀測是否真的變好？</h2><form id="partner-compare"><div class="partner-fields">${[['beforeLiters','改善前油量 L'],['beforeKm','改善前里程 km'],['afterLiters','改善後油量 L'],['afterKm','改善後里程 km']].map(([name,label])=>`<label>${label}<input name="${name}" type="number" min="0.01" step="any" required></label>`).join('')}</div><label class="partner-check"><input name="matched" type="checkbox" required>已核對車群、車型、路線、載重、觀測期間與資料完整度可比較</label><button class="partner-primary" type="submit">計算觀測變化</button></form><div id="partner-compare-result" role="status"></div></section></div>`;
  }
  function updateEstimate() {
    const form = document.getElementById('partner-estimate'); if(!form)return;
    const r = estimateSavings(fuelBaseline(vehicles()),form.elements.reduction.value,form.elements.price.value);
    document.getElementById('partner-estimate-result').innerHTML = r?`<div class="partner-estimate"><b>NT$ ${fmt(r.money,0)}</b><span>該基線月份的假設節省 · ${fmt(r.liters)} L</span><small>目標油耗 ${fmt(r.target,2)} L/100km</small></div>`:'<p>資料不足或輸入超出範圍，無法試算。</p>';
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
      document.getElementById('partner-compare-result').textContent=result?`人工輸入觀測：${fmt(result.before,2)} → ${fmt(result.after,2)} L/100km，${result.change>=0?'下降':'上升'} ${fmt(Math.abs(result.change))}%。${result.short?'至少一期間少於 500 km，樣本偏短。':''}`:'請輸入有效的正數油量與里程。';return;
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

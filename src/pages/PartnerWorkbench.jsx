import { useMemo, useState } from 'react';
import { advanceCase, compareFuel, estimateSavings, fuelBaseline, opportunities, scopedVehicles } from '../partner/engine.js';

const LABELS = { review: '待覆核', doing: '協作改善中', observe: '待量測' };
const FILTERS = ['全部', '安全', '節能', '已建案'];
const fmt = (n, digits = 1) => (n === null ? '資料不足' : Number(n).toLocaleString('zh-TW', { maximumFractionDigits: digits }));

function validCase(cases, id) {
  const rec = cases[id];
  return rec && LABELS[rec.status] && Array.isArray(rec.history) ? rec : null;
}

function loadCases(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return { cases: saved, ok: true };
  } catch { /* corrupt store */ }
  return { cases: {}, ok: false };
}

export default function PartnerWorkbench() {
  const data = window.HINO_EXCEL_DATA;
  const session = window.SESSION;
  const key = `hino-partner-v1:${data.meta.lastRecord}`;
  const [{ cases, ok: storageOK }, setStore] = useState(() => loadCases(key));
  const [filter, setFilter] = useState('全部');
  const [selected, setSelected] = useState(null);
  const [formError, setFormError] = useState('');
  const [view, setView] = useState('actions');
  const [reduction, setReduction] = useState('3');
  const [price, setPrice] = useState('30');
  const [compareMsg, setCompareMsg] = useState('');

  const vehicles = useMemo(() => {
    const driverCar = session?.role === 'driver' ? window.myDriver()?.d?.c : null;
    return scopedVehicles(data, session, driverCar);
  }, [data, session]);
  const cards = useMemo(() => opportunities(vehicles, data.meta.period), [vehicles, data.meta.period]);
  const baseline = useMemo(() => fuelBaseline(vehicles), [vehicles]);
  const active = cards.filter((c) => validCase(cases, c.id));
  const shown = cards.filter((c) => filter === '全部' || (filter === '已建案' ? validCase(cases, c.id) : c.kind === filter));
  const selectedCard = shown.find((c) => c.id === selected) || shown[0] || null;
  const state = selectedCard && validCase(cases, selectedCard.id);

  function persist(next) {
    let ok = storageOK;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { ok = false; }
    setStore({ cases: next, ok });
  }

  function onCreate(e) {
    e.preventDefault();
    if (!e.target.reportValidity() || !selectedCard || validCase(cases, selectedCard.id)) return;
    const fd = new FormData(e.target);
    const note = String(fd.get('note') || '').trim();
    setFormError('');
    try {
      if (!note) throw new Error('請填寫待釐清的原因。');
      persist({
        ...cases,
        [selectedCard.id]: {
          status: 'review',
          owner: fd.get('owner'),
          due: fd.get('due'),
          history: [{ actor: session.acc.roleName, note, time: new Date().toISOString() }],
        },
      });
    } catch (err) {
      setFormError(err.message);
    }
  }

  function onProgress(e) {
    e.preventDefault();
    if (!e.target.reportValidity() || !selectedCard) return;
    const note = String(new FormData(e.target).get('note') || '');
    setFormError('');
    try {
      persist({ ...cases, [selectedCard.id]: advanceCase(validCase(cases, selectedCard.id), note, session.acc.roleName) });
    } catch (err) {
      setFormError(err.message);
    }
  }

  function exportJson() {
    const content = {
      mode: 'local-demo',
      source: data.meta,
      exportedAt: new Date().toISOString(),
      cases: cards.filter((c) => validCase(cases, c.id)).map((c) => ({ ...c, ...validCase(cases, c.id) })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hino-partner-cases.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function onCompare(e) {
    e.preventDefault();
    if (!e.target.reportValidity()) return;
    const fd = new FormData(e.target);
    const result = compareFuel(fd.get('beforeLiters'), fd.get('beforeKm'), fd.get('afterLiters'), fd.get('afterKm'));
    setCompareMsg(result
      ? `人工輸入觀測：${fmt(result.before, 2)} → ${fmt(result.after, 2)} L/100km，${result.change >= 0 ? '下降' : '上升'} ${fmt(Math.abs(result.change))}%。${result.short ? '至少一期間少於 500 km，樣本偏短。' : ''}尚無對照組或不確定性估計，不能歸因於 AI，也不代表案件已驗證。`
      : '請輸入有效的正數油量與里程。');
  }

  function askAi() {
    if (!selectedCard) return;
    window.__selectedEvidenceId = selectedCard.id;
    const q = `請依 ${selectedCard.car} 的「${selectedCard.title}」證據，分別列出已知事實、待確認原因、駕駛／調度／保修分工，以及驗證指標。請勿把假設當事實或宣稱已執行。`;
    window.openAIChat?.();
    // ponytail: rAF until overlay commit (React setState); cap 60 frames
    let n = 0;
    const tick = () => {
      if (document.querySelector('#ov.on #chatlog')) window.aiAsk?.(q);
      else if (++n < 60) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  return (
    <div className="screen" data-react>
      <div className="partner">
        <header className="partner-hero">
          <div>
            <span className="partner-eyebrow">HINO × GenAI / 智慧營運夥伴</span>
            <h1>把一個訊號，變成一次改善。</h1>
            <p>從省油與安全出發，讓駕駛、調度與保修一起找到原因，再用數據驗證。</p>
            <span className="partner-source">歷史資料 {data.meta.period} · {vehicles.length} 台可見車輛</span>
          </div>
          <div className="partner-proof">
            <strong>尚未驗證</strong>
            <span>實際省油與事故改善效益</span>
            <small>先做試點，再提出成效主張</small>
          </div>
        </header>
        <div className="partner-stats">
          <article>
            <span>可覆核訊號</span>
            <b>{cards.length}<small>項</small></b>
            <p>安全 {cards.filter((c) => c.kind === '安全').length} · 節能 {cards.filter((c) => c.kind === '節能').length}</p>
          </article>
          <article>
            <span>已建立協作案件</span>
            <b>{active.length}<small>件</small></b>
            <p>{active.filter((c) => validCase(cases, c.id).status === 'observe').length} 件待量測，尚無實證結案</p>
          </article>
          <article>
            <span>{baseline.month || '—'} 加權油耗基線</span>
            <b>{fmt(baseline.per100, 2)}<small>L/100km</small></b>
            <p>{baseline.eligible.length} 台符合 500 km 門檻 · 排除 {baseline.excluded} 台</p>
          </article>
        </div>
        <nav className="partner-tabs" aria-label="改善工作台">
          {[
            ['actions', '01 改善工作台'],
            ['impact', '02 效益與試點'],
            ['evidence', '03 資料與 AI 邏輯'],
          ].map(([id, label]) => (
            <button key={id} type="button" data-view={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>
          ))}
        </nav>
        {view === 'impact' ? (
          <ImpactView
            baseline={baseline}
            reduction={reduction}
            price={price}
            onReduction={setReduction}
            onPrice={setPrice}
            compareMsg={compareMsg}
            onCompare={onCompare}
          />
        ) : view === 'evidence' ? (
          <EvidenceView data={data} />
        ) : (
        <>
        <div className="partner-section-heading">
          <div>
            <h2>先處理值得改善的事</h2>
            <p>依同類訊號比例排序，安全與節能交錯呈現；不是事故風險排行。</p>
          </div>
          <button type="button" onClick={exportJson}>匯出協作紀錄</button>
        </div>
        <div className="partner-filters">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setFormError(''); }}>
              {f}
            </button>
          ))}
        </div>
        <div className="partner-workspace">
          <div className="partner-list">
            {shown.length ? shown.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`partner-item ${selectedCard?.id === c.id ? 'selected' : ''}`}
                onClick={() => { setSelected(c.id); setFormError(''); }}
              >
                <span className={`partner-kind ${c.kind === '安全' ? 'safety' : ''}`}>{c.kind}</span>
                <span className="partner-item-status">{validCase(cases, c.id) ? LABELS[validCase(cases, c.id).status] : '待建立'}</span>
                <b>{c.car}</b>
                <strong>{c.title}</strong>
                <span>{fmt(c.value)}% · {c.kind === '安全' ? '超速／行駛紀錄' : '怠速／行駛＋怠速紀錄'}</span>
              </button>
            )) : <p className="partner-empty">目前沒有符合篩選的訊號。未出現訊號不代表沒有風險。</p>}
          </div>
          <section className="partner-panel partner-detail">
            {selectedCard ? (
              <>
                <span className="partner-eyebrow">{selectedCard.car} / {selectedCard.kind}改善</span>
                <h2>{selectedCard.title}</h2>
                <div className="partner-evidence">
                  <b>資料證據</b>
                  <p>{selectedCard.evidence}</p>
                  <small>{selectedCard.source}</small>
                </div>
                <p>{selectedCard.why}</p>
                <h3>建議分工</h3>
                <ol className="partner-flow">{selectedCard.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                <div className="partner-callout">
                  <b>怎麼知道有改善？</b>
                  <p>{selectedCard.metric}</p>
                </div>
                <button type="button" className="partner-primary" onClick={askAi}>請 AI 解讀這項證據</button>
                <span className="partner-ai-note">模型是否連線會在對話內標示</span>
                <hr />
                <h3>協作紀錄 · {state ? LABELS[state.status] : '尚未建案'}</h3>
                {state ? (
                  <>
                    <p>承接角色：{state.owner} · 預計覆核：{state.due}</p>
                    <ol className="partner-history">
                      {state.history.map((h, i) => (
                        <li key={`${h.time}-${i}`}>
                          <b>{h.actor}</b>
                          <small>{h.time}</small>
                          <p>{h.note}</p>
                        </li>
                      ))}
                    </ol>
                    {state.status === 'observe' ? (
                      <div className="partner-callout">回報已記錄，等待同條件追蹤資料…尚未證明有效</div>
                    ) : (
                      <form id="partner-progress" onSubmit={onProgress}>
                        <label>
                          本次{state.status === 'review' ? '覆核：原因、分工與下一步' : '回報：實際採取措施、障礙與後續'}
                          <textarea name="note" required maxLength={1000} placeholder="例如：需確認卸貨等待；請調度核對到場時窗。" />
                        </label>
                        <button className="partner-primary" type="submit">
                          {state.status === 'review' ? '記錄覆核並開始改善' : '記錄回報，進入待量測'}
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <form id="partner-create" onSubmit={onCreate}>
                    <div className="partner-fields">
                      <label>
                        承接角色
                        <select name="owner">
                          <option>調度營運經理</option>
                          <option>保修管理者</option>
                          <option>車輛使用者</option>
                        </select>
                      </label>
                      <label>
                        預計覆核日期
                        <input name="due" type="date" required />
                      </label>
                    </div>
                    <label>
                      待釐清的原因
                      <textarea name="note" required maxLength={1000} placeholder="填入需要確認的作業情境，不以訊號直接歸責。" />
                    </label>
                    <button type="submit" className="partner-primary">建立協作案件（本機 Demo）</button>
                  </form>
                )}
                <p className="partner-form-status" role="status">{formError}</p>
              </>
            ) : (
              <>
                <h2>沒有待處理訊號</h2>
                <p>可切換篩選，或稍後再查看本角色可見車輛。</p>
              </>
            )}
          </section>
        </div>
        </>
        )}
        <footer>{storageOK ? '案件只儲存在此瀏覽器；角色為流程演示，未派工或推播。' : '瀏覽器無法儲存，案件僅保留於本次頁面；請匯出留存。'}</footer>
      </div>
    </div>
  );
}

function ImpactView({ baseline, reduction, price, onReduction, onPrice, compareMsg, onCompare }) {
  const estimate = estimateSavings(baseline, reduction, price);
  return (
    <>
      <div className="partner-impact">
        <section className="partner-panel">
          <span className="partner-eyebrow">假設試算 / 非實際效益</span>
          <h2>如果改善，可能省多少？</h2>
          <p>{baseline.month || '未提供月份'} · {baseline.eligible.length} 台 · {fmt(baseline.liters)} L ÷ {fmt(baseline.km)} km × 100 = {fmt(baseline.per100, 2)} L/100km。使用同月份合格車輛總量加權，不平均各車比率。</p>
          <form id="partner-estimate">
            <div className="partner-fields">
              <label>
                假設油耗降低（0–30%）
                <input name="reduction" type="number" min="0" max="30" step="0.5" value={reduction} required onChange={(e) => onReduction(e.target.value)} />
              </label>
              <label>
                假設油價（NT$/L，非即時報價）
                <input name="price" type="number" min="0.01" max="200" step="0.01" value={price} required onChange={(e) => onPrice(e.target.value)} />
              </label>
            </div>
          </form>
          <div id="partner-estimate-result" aria-live="polite">
            {estimate ? (
              <div className="partner-estimate">
                <b>NT$ {fmt(estimate.money, 0)}</b>
                <span>該基線月份的假設節省 · {fmt(estimate.liters)} L</span>
                <small>目標油耗 {fmt(estimate.target, 2)} L/100km · 尚未實現</small>
              </div>
            ) : <p>資料不足或輸入超出範圍，無法試算。</p>}
          </div>
          <p>公式：基線用油 × 假設改善率 × 假設油價。固定里程及作業條件，未扣導入成本；不外推全台四千輛車，也不將怠速比例當作油耗占比。</p>
        </section>
        <section className="partner-panel">
          <span className="partner-eyebrow">人工輸入 / 尚未驗證</span>
          <h2>前後觀測是否真的變好？</h2>
          <p>輸入相同車群兩個期間的總油量與總里程。此工具不修改案件或來源資料。</p>
          <form id="partner-compare" onSubmit={onCompare}>
            <div className="partner-fields">
              {[
                ['beforeLiters', '改善前油量 L'],
                ['beforeKm', '改善前里程 km'],
                ['afterLiters', '改善後油量 L'],
                ['afterKm', '改善後里程 km'],
              ].map(([name, label]) => (
                <label key={name}>
                  {label}
                  <input name={name} type="number" min="0.01" step="any" required />
                </label>
              ))}
            </div>
            <label className="partner-check">
              <input name="matched" type="checkbox" required />
              已核對車群、車型、路線、載重、觀測期間與資料完整度可比較
            </label>
            <button className="partner-primary" type="submit">計算觀測變化</button>
          </form>
          <div id="partner-compare-result" role="status">{compareMsg}</div>
        </section>
      </div>
      <section className="partner-panel">
        <h2>六週試點：先訂成功標準</h2>
        <p>以下是提案目標，尚非實測成果；正式樣本數需依基線變異與可偵測改善幅度估算。</p>
        <div className="partner-pilot">
          <article>
            <b>第 1–2 週 · 建基線</b>
            <p>核對計數器重設、缺測與去重事件；依車型、載重、路線配對車輛，再分派介入與對照組。</p>
          </article>
          <article>
            <b>第 3–4 週 · 小步介入</b>
            <p>一次測一項等待改善或出車前提醒，記錄採納、原因、分工及回報；不以縮短休息換取油耗改善。</p>
          </article>
          <article>
            <b>第 5–6 週 · 比較與覆核</b>
            <p>比較兩組前後變化、樣本量及信賴區間；未改善或誤報過多就調整規則。</p>
          </article>
        </div>
        <div className="partner-targets">
          <p><b>節能目標（待驗證）</b>相對對照組的 L/100km 改善 ≥3%。</p>
          <p><b>安全目標（待驗證）</b>去重超速事件／1,000 km 下降 ≥10%；同步檢視誤報率。</p>
          <p><b>管理目標（待驗證）</b>每案人工判讀時間降低 ≥30%；回報完成率 ≥80%。</p>
        </div>
        <p>歷史資料沒有介入／對照組，也沒有事故標籤；目前不能證明上述目標已達成。</p>
      </section>
    </>
  );
}

function EvidenceView({ data }) {
  return (
    <section className="partner-panel">
      <h2>資料完整度，先於分數</h2>
      <p>全資料集每月紀錄數。缺測月份不能解讀為安全改善；有資料也不代表整月完整。</p>
      <div className="partner-months">
        {data.months.map((m, i) => (
          <div key={`${m}-${i}`} className={data.aggregate.recordsByMonth[i] ? 'present' : 'missing'}>
            <b>{m}</b>
            <span>{fmt(data.aggregate.recordsByMonth[i], 0)} 筆</span>
          </div>
        ))}
      </div>
      <div className="partner-callout">{data.meta.regionMethod}。區域不是實際管理部門；車號也不是駕駛身分。</div>
      <h3>分析與生成各自負責什麼？</h3>
      <ol className="partner-flow">
        <li><b>資料層</b>固定 Excel → 月份、車號、CAN 油量與里程差分、GPS 與車況紀錄。</li>
        <li><b>規則層</b>怠速 ≥15%、超速 ≥10% 列為覆核候選；門檻是 Demo 設定，非經驗證預測模型。</li>
        <li><b>GenAI 層</b>以資料期間、分母、證據卡與限制產生分工建議。配置 Gemini 後使用模型；離線時顯示規則摘要。</li>
        <li><b>執行層</b>人員覆核 → 協作回報 → 待量測。模型不能自行宣告任務完成或成效。</li>
      </ol>
      <h3>安全的預先介入</h3>
      <p>本版演示「用歷史訊號準備下一趟出車前提醒」。尚未完成即時串流、下一趟風險模型或 PCS／LDWS 預測。正式試點需補事件時間窗、去重事件、行駛曝險量與誤報覆核，並以時間切分回測。</p>
      <p>週評分含事件類別文字，但與既有欄位缺漏說明不一致；新工作台不使用那些未完成欄位核對的事件作結論。</p>
      <details>
        <summary>來源與計算口徑</summary>
        <p>{data.meta.sourceFile} → excel-derived-data.js。月油耗為 CAN 油量／里程差分；怠速為 carStatus 紀錄比例；高引擎負載不能當作超載重量，DTC 筆數不能當作故障次數。</p>
        <p>累積計數器重設、跨缺測區間與車型／載重差異仍需在原始資料層驗證。</p>
      </details>
    </section>
  );
}

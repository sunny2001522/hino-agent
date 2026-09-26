import { estimateSavings } from '../../../partner/engine.js';

const fmt = (n, digits = 1) => (n === null ? '資料不足' : Number(n).toLocaleString('zh-TW', { maximumFractionDigits: digits }));

export default function ImpactView({ baseline, reduction, price, onReduction, onPrice, compareMsg, onCompare }) {
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

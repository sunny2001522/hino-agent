const fmt = (n, digits = 1) => (n === null ? '資料不足' : Number(n).toLocaleString('zh-TW', { maximumFractionDigits: digits }));

export default function EvidenceView({ data }) {
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

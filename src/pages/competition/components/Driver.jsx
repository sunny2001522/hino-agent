import { useEffect, useRef, useState } from 'react';
import { CATS, history, lineChart, regionAvg, tint, signed } from '../score.js';
import CatTabs from './CatTabs.jsx';
import StatusFacts from './StatusFacts.jsx';

const data = typeof window !== 'undefined' ? window.HINO_EXCEL_DATA : null;
const fleet = data ? data.regions.flatMap(r => r.drivers) : [];
const me = (() => {
  if (!data) return null;
  const code = data.accountBindings.driver_code;
  const region = data.regions.find(r => r.id === code[0]);
  return region?.drivers[+code.slice(1)] ?? null;
})();
const myRegion = me && data.regions.find(r => r.id === me.region);

function rankOf(cat, car) {
  const list = [...fleet].sort((a, b) => cat.score(b) - cat.score(a));
  return { rank: list.findIndex(d => d.c === car) + 1, total: list.length };
}

function moodOf(d) {
  if (d.overspeed_pct >= 15) return { tag: '待覆核', line: '歷史超速紀錄偏高，請先確認限速資料與派車條件。車號訊號不能推定個人情緒或責任。' };
  if (d.idle_pct >= 15) return { tag: '等待情境待確認', line: '怠速紀錄偏高，請在停妥後回報裝卸、等待與必要作業原因，由調度協助確認。' };
  return { tag: '歷史資料摘要', line: '目前沒有超過這組展示門檻，仍需留意路況。這是規則摘要，不是即時風險預測。' };
}

function aiReply(q) {
  if (/累|疲|睡|休息/.test(q)) return '請在安全地點停妥後再操作或回報，並由調度協助安排。此介面無法判斷疲勞程度。';
  return moodOf(me).line;
}

export default function Driver() {
  const [catId, setCatId] = useState('safety');
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [, setTick] = useState(0);
  const chatRef = useRef(null);
  const logRef = useRef(null);
  const greeted = useRef(false);

  useEffect(() => {
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setTick(n => n + 1), 120);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    if (chatOpen) {
      if (!el.open) el.showModal();
      if (!greeted.current && me) {
        greeted.current = true;
        setMessages([{ role: 'ai', text: moodOf(me).line }]);
      }
    } else if (el.open) {
      el.close();
    }
  }, [chatOpen]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (!me) return <p className="period">無法載入分數資料</p>;

  const cat = CATS.find(c => c.id === catId);
  const score = cat.score(me);
  const { rank, total } = rankOf(cat, me.c);
  const pts = history(cat, myRegion);
  const mom = pts.at(-1).v - pts.at(-2).v;
  const avg = regionAvg(cat, fleet);
  const asOf = (me.last_time || data.meta.lastRecord).slice(0, 10);
  const tabItems = CATS.map(c => {
    const s = c.score(me);
    const rk = rankOf(c, me.c);
    return { id: c.id, name: c.name, score: s, color: tint(s), sub: `第 ${rk.rank} / ${rk.total}` };
  });

  function sendChat(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    setMessages(m => [...m, { role: 'me', text: q }, { role: 'ai', text: aiReply(q) }]);
  }

  return (
    <>
      <section className="dash-top">
        <p className="period">{data.meta.period} · 資料截至 {asOf}</p>
        <p className="period">歷史車號指標 Demo，非官方駕駛成績；區域為 GPS 展示分組，缺測月份不參與比較。</p>
        <div className="score-row">
          <div className="score-card">
            <div className="k">總分</div>
            <div className="v" style={{ color: tint(score) }}>{score}</div>
            <div className="s">{cat.name}分數</div>
            <div className={`s ${mom > 0 ? 'up' : mom < 0 ? 'down' : ''}`}>
              本區較前次有資料月份 {signed(mom)}
            </div>
          </div>
          <div className="score-card">
            <div className="k">排名</div>
            <div className="v">{rank}</div>
            <div className="s">/ {total} · 平均 {avg}</div>
          </div>
        </div>
        <div className="chartcard">
          <div className="ch-h">
            <span className="ttl">{myRegion.name}月趨勢</span>
            <span className="sub">虛線綠燈 70</span>
          </div>
          <div className="chart" dangerouslySetInnerHTML={{ __html: lineChart(pts) }} />
        </div>
        <details className="status">
          <summary>目前狀況</summary>
          <div className="status-row">
            <div className="status-body">
              <StatusFacts facts={cat.facts(me)} />
            </div>
            <div className="ai-care">
              <p className="ai-bubble">{moodOf(me).line}</p>
              <button type="button" className="ai-btn" aria-label="跟 AI 聊聊" onClick={() => setChatOpen(true)}>✦</button>
            </div>
          </div>
        </details>
      </section>
      <CatTabs catId={catId} onChange={setCatId} items={tabItems} />
      <dialog
        id="aiChat"
        className="ai-dialog"
        ref={chatRef}
        onClose={() => setChatOpen(false)}
      >
        <div className="chathd">
          <strong>AI 關心</strong>
          <button type="button" className="ai-x" onClick={() => chatRef.current?.close()}>關閉</button>
        </div>
        <div className="chatlog" ref={logRef}>
          {messages.map((m, i) => (
            <div key={i} className={`bub ${m.role}`}>{m.text}</div>
          ))}
        </div>
        <form className="chatin" onSubmit={sendChat}>
          <input
            type="text"
            placeholder="想說什麼都可以"
            autoComplete="off"
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button type="submit">送出</button>
        </form>
      </dialog>
    </>
  );
}

(function () {
  const z = { overspeed_pct: 0, idle_pct: 0, high_load_pct: 0, dtc_count: 0 };
  const w = { overspeed_pct: 50, idle_pct: 40, high_load_pct: 40, dtc_count: 30 };
  console.assert(CATS.every(c => c.score(z) === 100), 'clean input should be 100');
  console.assert(CATS.every(c => c.score(w) < c.score(z)), 'worse input must score lower');
  if (me) {
    const h = history(CATS[0], myRegion);
    console.assert(h.length >= 2, 'history should have months');
    console.assert(h.at(-1).v === myRegion.series.safety.filter((_, i) => myRegion.recordsByMonth ? myRegion.recordsByMonth[i] > 0 : myRegion.series.safety[i] !== null).at(-1), 'last point is region month');
    console.assert(['待覆核', '等待情境待確認', '歷史資料摘要'].includes(moodOf(me).tag), 'mood tag');
  }
})();

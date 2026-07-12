import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

// 有金鑰才啟用真 AI；沒有金鑰時 /api/chat 回 503，前端自動退回本地模擬
const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = hasKey ? new Anthropic() : null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---- 依身分建立系統提示（老闆／車隊負責人）----
function systemPrompt(ctx) {
  const base = `你是「HINO iTRAQ × GenAI 省油 · 安全智慧夥伴」的車隊 AI 軍師（火箭隊作品）。
你的回答必須完全依據下方提供的 iTRAQ 車聯網即時數據（grounding），不可捏造數據。
規則：
- 全程繁體中文、口語、專業但好懂；不要用 emoji。
- 聚焦「省油」與「安全」兩大主軸，並落到「可執行的決策 / 行動」。
- 老闆端(fleet)：只談決策層級（設目標、核准預算、下達政策），前線執行動作說明已由 AI 代理／負責人自動處理、老闆不必手按。
- 車隊負責人端(lead)：可談本區駕駛的實際跟進動作（通知、語音關懷、派交接、限期改善），但只限自己負責的那一區。
- 回答務必引用具體數字（怠速%、油耗L、安全分、異常率、事故風險%等），給 2-4 點具體建議，結尾給一個明確的下一步。
- 控制在約 150-260 字，條列清楚。`;

  if (ctx.role === 'fleet') {
    return `${base}

【登入身分】${ctx.name}｜車隊管理（全隊總管，6 區 / 20 車）
【全隊即時數據】
- 全隊平均安全分：${ctx.aggSafe}
- 全隊怠速佔比：${ctx.idle}%（目標 ≤8%、起點 16%）
- 全隊百公里油耗：約 ${ctx.fuel} L
- 怠速最高（最耗油）區：${ctx.worstIdle?.name}（怠速 ${ctx.worstIdle?.idlePct}%、油耗 ${ctx.worstIdle?.fuel}L、異常率 ${ctx.worstIdle?.anomaly}%）
- 安全分最低（最需關注）區：${ctx.worstSafe?.name}（安全分 ${ctx.worstSafe?.safe}、異常率 ${ctx.worstSafe?.anomaly}%）
- 各區摘要：${(ctx.regions || []).map(r => `${r.name}(安全${r.safe}/怠速${r.idlePct}%/異常${r.anomaly}%/準時${r.onTime}%)`).join('、')}
- 今日高風險駕駛（AI 事前預測）：${(ctx.riskTop || []).map(r => `${r.n}(${r.region}) 風險${r.pc}% 於${r.win}`).join('；')}
- AI 自動化授權目前開啟：${ctx.autoOn}
你已可讀取以上全隊數據，請以「全隊省油×安全 AI 軍師」身分回答老闆的問題，只給決策層建議。`;
  }

  // lead
  return `${base}

【登入身分】${ctx.name}｜總負責人（僅負責 ${ctx.region}，看不到其他區）
【本區即時數據】
- 本區安全分：${ctx.safe}（全隊平均 ${ctx.aggSafe}）
- 本區怠速佔比：${ctx.idle}%（目標 ≤8%）
- 本區百公里油耗：約 ${ctx.fuel} L
- 本區異常率：${ctx.anomaly}%
- 本區引擎過載：${ctx.overload} 次
- 本區駕駛（紅黃綠）：${(ctx.drivers || []).map(d => `${d.n} 安全分${d.s}(${d.i})`).join('；')}
你只掌握 ${ctx.region} 的數據，請以「${ctx.region}省油×安全夥伴」身分回答，聚焦本區駕駛的實際跟進行動。`;
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function handleChat(req, res) {
  if (!client) return send(res, 503, { error: 'AI backend not configured' });
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    let payload;
    try { payload = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'bad json' }); }
    const { context, question } = payload;
    if (!context || !question || (context.role !== 'fleet' && context.role !== 'lead')) {
      return send(res, 400, { error: 'context(role fleet|lead) and question required' });
    }
    // SSE 串流
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt(context),
        messages: [{ role: 'user', content: String(question).slice(0, 2000) }],
      });
      stream.on('text', (delta) => {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      });
      const final = await stream.finalMessage();
      res.write(`data: ${JSON.stringify({ done: true, model: final.model })}\n\n`);
      res.end();
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err?.message || 'AI error' })}\n\n`);
      res.end();
    }
  });
}

async function serveStatic(req, res, urlPath) {
  try {
    const clean = urlPath === '/' ? '/index.html' : urlPath.split('?')[0];
    // 防目錄穿越
    const filePath = path.join(__dirname, path.normalize(clean).replace(/^(\.\.[/\\])+/, ''));
    if (!filePath.startsWith(__dirname)) return send(res, 403, 'forbidden');
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    send(res, 404, 'not found');
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/health') {
    return send(res, 200, { ok: true, ai: hasKey, model: hasKey ? MODEL : null });
  }
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    return handleChat(req, res);
  }
  return serveStatic(req, res, url.pathname);
}).listen(PORT, () => {
  console.log(`HINO dashboard on :${PORT} — AI backend: ${hasKey ? MODEL : 'OFF (local sim fallback)'}`);
});

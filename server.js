import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSystemPrompt, geminiConfig } from './lib/gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// ---- Google Gemini（AI Studio API key，放環境變數 GEMINI_API_KEY）----
const { key: GEMINI_KEY, model: GEMINI_MODEL } = geminiConfig();
const hasKey = !!GEMINI_KEY; // 沒有金鑰時 /api/chat 回 503，前端自動退回本地模擬

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

// 呼叫 Gemini streamGenerateContent（SSE），把逐字文字回吐成前端要的 {delta}
async function handleChat(req, res) {
  if (!hasKey) return send(res, 503, { error: 'AI backend not configured' });
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    let payload;
    try { payload = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'bad json' }); }
    const { context, question } = payload;
    if (!context || !question || (context.role !== 'fleet' && context.role !== 'lead')) {
      return send(res, 400, { error: 'context(role fleet|lead) and question required' });
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_KEY)}`;
      const body = {
        systemInstruction: { parts: [{ text: buildSystemPrompt(context) }] },
        contents: [{ role: 'user', parts: [{ text: String(question).slice(0, 2000) }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      };
      const gres = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!gres.ok || !gres.body) {
        const errTxt = await gres.text().catch(() => '');
        res.write(`data: ${JSON.stringify({ error: `gemini ${gres.status}: ${errTxt.slice(0, 200)}` })}\n\n`);
        return res.end();
      }
      // Gemini SSE：一連串 data: {candidates:[{content:{parts:[{text}]}}]}
      const reader = gres.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop();
        for (const p of parts) {
          const line = p.split('\n').find(l => l.startsWith('data:'));
          if (!line) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          let obj;
          try { obj = JSON.parse(jsonStr); } catch { continue; }
          const text = obj?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
          if (text) res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true, model: GEMINI_MODEL })}\n\n`);
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
    return send(res, 200, { ok: true, ai: hasKey, provider: hasKey ? 'gemini' : null, model: hasKey ? GEMINI_MODEL : null });
  }
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    return handleChat(req, res);
  }
  return serveStatic(req, res, url.pathname);
}).listen(PORT, () => {
  console.log(`HINO dashboard on :${PORT} — AI backend: ${hasKey ? 'Gemini ' + GEMINI_MODEL : 'OFF (local sim fallback)'}`);
});

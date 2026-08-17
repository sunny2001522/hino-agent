import { buildSystemPrompt, geminiConfig } from '../lib/gemini.js';

function json(res, status, body) {
  res.status(status).json(body);
}

async function bodyFor(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('request too large');
  }
  return JSON.parse(raw || '{}');
}

function event(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  const { key, model } = geminiConfig();
  if (!key) return json(res, 503, { error: 'Gemini API key is not configured' });

  let payload;
  try {
    payload = await bodyFor(req);
  } catch {
    return json(res, 400, { error: 'bad json' });
  }
  const { context, question } = payload || {};
  if (!context || !question || !['fleet', 'lead'].includes(context.role)) {
    return json(res, 400, { error: 'context(role fleet|lead) and question required' });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(context) }] },
        contents: [{ role: 'user', parts: [{ text: String(question).slice(0, 2000) }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.35 },
      }),
    });
    if (!geminiResponse.ok || !geminiResponse.body) {
      const detail = await geminiResponse.text().catch(() => '');
      event(res, { error: `Gemini ${geminiResponse.status}: ${detail.slice(0, 200)}` });
      return res.end();
    }

    const reader = geminiResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() || '';
      for (const chunk of chunks) {
        const line = chunk.split(/\r?\n/).find(item => item.trimStart().startsWith('data:'));
        if (!line) continue;
        const value = line.trimStart().slice(5).trim();
        if (!value || value === '[DONE]') continue;
        try {
          const eventData = JSON.parse(value);
          const delta = eventData?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
          if (delta) event(res, { delta });
        } catch { /* Ignore incomplete Gemini SSE frames. */ }
      }
    }
    // Gemini may close the response without a trailing blank SSE separator.
    // Flush its final event so the UI receives the entire generated answer.
    const finalLine = buffer.split(/\r?\n/).find(item => item.trimStart().startsWith('data:'));
    if (finalLine) {
      try {
        const eventData = JSON.parse(finalLine.trimStart().slice(5).trim());
        const delta = eventData?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
        if (delta) event(res, { delta });
      } catch { /* Ignore an incomplete final SSE frame. */ }
    }
    event(res, { done: true, model });
  } catch (error) {
    event(res, { error: error?.message || 'Gemini request failed' });
  }
  res.end();
}

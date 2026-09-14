import test from 'node:test';
import assert from 'node:assert/strict';

test('missing key is not_configured and does not fetch', async () => {
  const previousGemini = process.env.GEMINI_API_KEY, previousGoogle = process.env.GOOGLE_API_KEY, oldFetch = global.fetch;
  let fetched = 0;
  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    global.fetch = async () => { fetched += 1; return { ok: true, status: 200 }; };
    const { aiHealth } = await import('../lib/ai-health.js');
    const result = await aiHealth();
    assert.equal(result.ai, false);
    assert.equal(result.configured, false);
    assert.equal(result.status, 'not_configured');
    assert.equal(fetched, 0);
  } finally {
    global.fetch = oldFetch;
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousGemini;
    if (previousGoogle === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = previousGoogle;
  }
});

test('health reports unavailable credentials instead of a false live-model claim', async () => {
  const previous = process.env.GEMINI_API_KEY, oldFetch = global.fetch;
  try {
    process.env.GEMINI_API_KEY = 'test-invalid';
    global.fetch = async () => ({ ok: false, status: 400 });
    const { aiHealth } = await import('../lib/ai-health.js');
    const result = await aiHealth();
    assert.equal(result.ai, false);
    assert.equal(result.configured, true);
    assert.equal(result.status, 'credential_rejected');
    assert.ok(!JSON.stringify(result).includes('test-invalid'));
  } finally {
    global.fetch = oldFetch;
    if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
  }
});

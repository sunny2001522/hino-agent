import test from 'node:test';
import assert from 'node:assert/strict';

test('health reports unavailable credentials instead of a false live-model claim',async()=>{
 const previous=process.env.GEMINI_API_KEY, oldFetch=global.fetch;
 try {
  process.env.GEMINI_API_KEY='test-invalid';
  global.fetch=async()=>({ok:false,status:400});
  const {aiHealth}=await import('../lib/ai-health.js');
  const result=await aiHealth();
  assert.equal(result.ai,false);assert.equal(result.configured,true);assert.equal(result.status,'credential_rejected');
  assert.ok(!JSON.stringify(result).includes('test-invalid'));
 } finally {global.fetch=oldFetch;if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});

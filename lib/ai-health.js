import {geminiConfig} from './gemini.js';
let cached;
export async function aiHealth() {
  const {key,model}=geminiConfig();
  if(!key)return {ok:true,ai:false,configured:false,status:'not_configured',provider:null,model:null};
  if(cached && Date.now()<cached.until)return cached.value;
  let status='unavailable';
  try {
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(5000)});
    status=response.ok?'ready':([400,401,403].includes(response.status)?'credential_rejected':'unavailable');
  } catch { status='unavailable'; }
  const value={ok:true,ai:status==='ready',configured:true,status,provider:'gemini',model};
  cached={until:Date.now()+60000,value};return value;
}

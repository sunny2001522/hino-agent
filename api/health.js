import {aiHealth} from '../lib/ai-health.js';
export default async function handler(req,res) {
  if(req.method!=='GET')return res.status(405).json({error:'method not allowed'});
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json(await aiHealth());
}

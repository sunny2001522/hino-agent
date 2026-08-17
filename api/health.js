import { geminiConfig } from '../lib/gemini.js';

export default function handler(_req, res) {
  const { key, model } = geminiConfig();
  res.status(200).json({ ok: true, ai: Boolean(key), provider: key ? 'gemini' : null, model: key ? model : null });
}

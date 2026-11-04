// Mints a short-lived OpenAI Realtime client secret so the browser never sees the real API key.
// Needs OPENAI_API_KEY in the Vercel project env.
export default async function handler(req, res) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: 'OPENAI_API_KEY not set: falling back to browser voice' });
  const model = process.env.REALTIME_MODEL || 'gpt-realtime';
  const voice = process.env.REALTIME_VOICE || 'marin';
  try {
    const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: { type: 'realtime', model, audio: { output: { voice } } } }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: j.error?.message || 'openai error', detail: j });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ value: j.value, model });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

// POST: guarda un paso del recorrido (contrato de Luis: {session_id, ts, product_url, type, role, text, page_id, page_url, reason, source}).
// Extras opcionales que acepta: buyer_type, sector, company, topic, meta.
// Es el destino de ?memory=<url> del voice agent.
import { sb, dbReady, cors } from './_db.js';
import { chat } from './_llm.js';

async function topicOf(text) {
  if (!text) return null;
  const out = await chat([
    { role: 'system', content: 'Devuelve SOLO un tema en 1-2 palabras inglesas minúsculas con guion bajo (ej: payroll, security, pricing, integrations, onboarding, reporting) para lo que pide el visitante de una demo de software. Si no pide nada concreto, devuelve none.' },
    { role: 'user', content: text.slice(0, 400) }], { max_tokens: 10, ms: 8000 });
  const t = out && out.trim().toLowerCase().replace(/[^a-z_]/g, '');
  return t && t !== 'none' && t.length < 30 ? t : null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!dbReady()) return res.status(503).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set' });
  const s = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!s.session_id || !s.type) return res.status(400).json({ error: 'session_id and type required' });
  try {
    let domain = null;
    try { domain = new URL(s.product_url).hostname.replace(/^www\./, ''); } catch {}
    await sb('/sessions?on_conflict=id', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { id: s.session_id, product_url: s.product_url || null, domain,
        ...(s.buyer_type && { buyer_type: s.buyer_type }), ...(s.sector && { sector: s.sector }), ...(s.company && { company: s.company }) },
    });
    const topic = s.topic || (s.type === 'utterance' && s.role === 'user' ? await topicOf(s.text) : null);
    await sb('/events', {
      method: 'POST', prefer: 'return=minimal',
      body: { session_id: s.session_id, ts: s.ts ? new Date(s.ts).toISOString() : undefined, type: s.type, role: s.role || null,
        text: s.text || null, topic, page_id: s.page_id || null, page_url: s.page_url || null,
        reason: s.reason || null, source: s.source || null, meta: s.meta || {} },
    });
    return res.status(200).json({ ok: true, topic });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
}

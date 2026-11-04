// GET ?sector=<tipo de empresa>&buyer=<tipo>  → qué piden más los buyers parecidos. Lo consume el plan de Dani.
// Devuelve topic_demand (ordenado) y los temas que ya cumplen el umbral para entrar en la demo (demo_promotions).
import { sb, dbReady, cors } from './_db.js';

const q = (v) => encodeURIComponent(v);

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!dbReady()) return res.status(503).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set' });
  const f = [req.query.sector && `sector=eq.${q(req.query.sector)}`, req.query.buyer && `buyer_type=eq.${q(req.query.buyer)}`].filter(Boolean).join('&');
  try {
    const [demand, promote] = await Promise.all([
      sb(`/topic_demand?${f}&order=sessions.desc,mentions.desc&limit=20`),
      sb(`/demo_promotions?${f}&limit=10`),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ demand, promote });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
}

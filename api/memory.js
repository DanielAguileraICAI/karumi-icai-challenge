// POST: Claudia's memory (saves a step). GET ?product=<url>: recent steps for that product, in the shape Luis's voice agent reads ({steps}).
import post from '../memory/api/memory.js';
import { sb, dbReady, cors } from '../memory/api/_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return post(req, res);
  cors(res);
  res.setHeader('Cache-Control', 'no-store');
  if (!dbReady()) return res.status(200).json({ steps: [] });
  try {
    let host = ''; try { host = new URL(req.query.product).hostname.replace(/^www\./, ''); } catch {}
    const ss = await sb(`/sessions?select=id,buyer_type,product_url,sector,company${host ? `&domain=eq.${encodeURIComponent(host)}` : ''}&order=created_at.desc&limit=100`);
    if (!ss || !ss.length) return res.status(200).json({ steps: [] });
    const by = Object.fromEntries(ss.map(s => [s.id, s]));
    const ids = ss.map(s => `"${s.id}"`).join(',');
    const ev = await sb(`/events?select=session_id,ts,type,role,text,topic,page_id,page_url,reason,source&session_id=in.(${encodeURIComponent(ids)})&order=ts.desc&limit=400`);
    const steps = (ev || []).map(e => ({ ...e, product_url: by[e.session_id]?.product_url, buyer: by[e.session_id]?.buyer_type, sector: by[e.session_id]?.sector }));
    return res.status(200).json({ steps });
  } catch (e) {
    return res.status(200).json({ steps: [], error: String(e).slice(0, 200) });
  }
}

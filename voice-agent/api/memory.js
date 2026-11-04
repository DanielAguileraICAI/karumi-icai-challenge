// Shared memory of visitor journeys ("empresa X pidió Y"). POST a step, GET ?product=&buyer= → {steps}.
// Storage: Upstash / Vercel KV REST if KV_REST_API_URL + KV_REST_API_TOKEN are set, else an in-process
// array (best effort: lives as long as the warm function instance). Never throws.
const CAP = 5000;
const MEM = globalThis.__karumiMem || (globalThis.__karumiMem = []);
const KV_URL = process.env.KV_REST_API_URL, KV_TOKEN = process.env.KV_REST_API_TOKEN;
// Supabase (Claudia's DB): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-only), table SUPABASE_TABLE (default journey_steps).
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const SB_TABLE = process.env.SUPABASE_TABLE || 'journey_steps';
async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${SB_TABLE}${path}`, { ...opts, headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(opts.headers || {}) } });
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return opts.method === 'POST' ? null : r.json();
}

const host = u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase(); } };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

async function kv(cmds) {
  const r = await fetch(KV_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('kv ' + r.status);
  return r.json();
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > 50000) break; }
  return raw ? JSON.parse(raw) : null;
}

function clean(s) {
  if (!s || typeof s !== 'object' || !s.product_url) return null;
  const out = {};
  for (const k of ['session_id', 'ts', 'product_url', 'type', 'role', 'text', 'page_id', 'page_url', 'page_title', 'reason', 'source', 'buyer'])
    if (s[k] != null) out[k] = typeof s[k] === 'string' ? s[k].slice(0, 1000) : s[k];
  out.ts ||= new Date().toISOString();
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method === 'POST') {
      let step; try { step = clean(await readBody(req)); } catch { step = null; }
      if (!step) return res.status(400).json({ error: 'bad step' });
      const key = 'mem:' + host(step.product_url);
      if (SB_URL && SB_KEY) {
        try { await sb('', { method: 'POST', body: JSON.stringify({ ...step, product_host: host(step.product_url) }) }); return res.status(200).json({ ok: true, store: 'supabase' }); }
        catch (e) { console.warn(String(e)); /* fall through */ }
      }
      if (KV_URL && KV_TOKEN) {
        try { await kv([['LPUSH', key, JSON.stringify(step)], ['LTRIM', key, 0, CAP - 1]]); return res.status(200).json({ ok: true, store: 'kv' }); }
        catch { /* fall through to memory */ }
      }
      MEM.push(step); if (MEM.length > CAP * 4) MEM.splice(0, MEM.length - CAP * 4);
      return res.status(200).json({ ok: true, store: 'memory' });
    }
    const q = req.query || {};
    const h = q.product ? host(q.product) : '';
    const limit = Math.min(+q.limit || CAP, CAP);
    let steps = [];
    if (h && SB_URL && SB_KEY) {
      try { steps = (await sb(`?product_host=eq.${encodeURIComponent(h)}&order=ts.desc&limit=${limit}`)).reverse(); } catch (e) { console.warn(String(e)); steps = []; }
    }
    if (!steps.length && h && KV_URL && KV_TOKEN) {
      try {
        const [r] = await kv([['LRANGE', 'mem:' + h, 0, limit - 1]]);
        steps = (r.result || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean).reverse();
      } catch { steps = []; }
    }
    if (!steps.length) steps = MEM.filter(s => !h || host(s.product_url) === h);
    if (q.buyer) {
      // Keep whole sessions whose buyer shares a token with the requested one (client does finer matching).
      const want = new Set(norm(q.buyer).split(/[^a-z0-9]+/).filter(Boolean));
      const ok = new Set(steps.filter(s => s.buyer && norm(s.buyer).split(/[^a-z0-9]+/).some(t => want.has(t))).map(s => s.session_id));
      if (ok.size) steps = steps.filter(s => ok.has(s.session_id));
    }
    return res.status(200).json({ steps: steps.slice(-limit) });
  } catch (e) {
    try { return res.status(200).json({ steps: [], error: String(e) }); } catch {}
  }
}

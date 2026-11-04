// POST {name, url}: registers a client company. Returns the widget <script> snippet and its private dashboard URL.
// The dashboard token is only returned here, once. A domain already registered gets 409 and no token.
import { randomBytes } from 'node:crypto';
import { sb, dbReady, cors, hostOf } from './_db.js';
import { safeUrl } from './_util.js';

const origin = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!dbReady()) return res.status(503).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set' });
  let b;
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return res.status(400).json({ error: 'bad json' }); }
  const name = String(b.name || '').trim().slice(0, 80);
  const raw = String(b.url || '').trim();
  const u = safeUrl(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
  const domain = u && hostOf(u.href);
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!domain || !domain.includes('.') || domain.length > 253) return res.status(400).json({ error: 'url must be a public website, e.g. https://www.booking.com' });
  try {
    const [c] = await sb('/companies?select=id,name,domain,dashboard_token,created_at', {
      method: 'POST', prefer: 'return=representation',
      body: { name, domain, dashboard_token: randomBytes(16).toString('hex') },
    });
    const base = origin(req);
    const snippet = `<script>window.KARUMI_MEMORY_URL = "${base}/api/memory";</script>\n<script src="${base}/widget/widget.js" defer></script>`;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      company: { id: c.id, name: c.name, domain: c.domain, created_at: c.created_at },
      snippet,
      dashboard_url: `${base}/dashboard/?token=${c.dashboard_token}`,
      note: 'Keep the dashboard URL private: the token in it is the only key to this company\'s data.',
    });
  } catch (e) {
    const m = String(e);
    if (/supabase 409/.test(m)) return res.status(409).json({ error: `${domain} is already registered` });
    if (/PGRST205/.test(m)) return res.status(503).json({ error: 'companies table missing: run memory/schema.sql in Supabase' });
    return res.status(502).json({ error: m });
  }
}

// GET ?token=<dashboard_token>: everything the visitors of ONE company asked for in the demo.
// The token picks the company; every query is filtered by that company's domain (sessions.domain) in the database,
// and every row is checked again here before it leaves. Nothing from another domain, no cross-domain aggregates.
import { sb, dbReady } from './_db.js';

const enc = encodeURIComponent;
const PROMOTE_AT = 3; // same threshold as the demo_promotions view, counted only inside this domain
const isAsk = (e) => e.topic && (e.type === 'reco_click' || e.type === 'reco_idea' || (e.type === 'utterance' && e.role === 'user'));
const isSaid = (e) => e.text && (e.type === 'reco_idea' || (e.type === 'utterance' && e.role === 'user'));
const channel = (e) => (/voice|realtime/.test(e.source || '') ? 'voice' : 'text');
const rank = (m) => [...m.values()].map(x => ({ ...x, sessions: x.sessions.size })).sort((a, b) => b.sessions - a.sessions || b.mentions - a.mentions);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (!dbReady()) return res.status(503).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set' });
  const token = String(req.query.token || '');
  if (!/^[A-Za-z0-9]{32}$/.test(token)) return res.status(401).json({ error: 'invalid token' });
  try {
    const [company] = await sb(`/companies?select=name,domain,created_at&dashboard_token=eq.${token}&limit=1`);
    if (!company || !company.domain) return res.status(401).json({ error: 'invalid token' });
    const d = company.domain;
    const [ss, ev] = await Promise.all([
      sb(`/sessions?select=id,domain,buyer_type,sector,company,created_at&domain=eq.${enc(d)}&order=created_at.desc&limit=1000`),
      sb(`/events?select=session_id,ts,type,role,text,topic,page_id,page_url,source,sessions!inner(domain)&sessions.domain=eq.${enc(d)}&order=ts.desc&limit=5000`),
    ]);
    const sessions = (ss || []).filter(s => s.domain === d);
    const byId = new Map(sessions.map(s => [s.id, s]));
    const events = (ev || []).filter(e => e.sessions && e.sessions.domain === d && byId.has(e.session_id)).reverse(); // oldest first

    const topics = new Map(), byBuyer = new Map(), promo = new Map(), clicks = new Map(), trail = new Map();
    const ideas = [];
    for (const e of events) {
      const s = byId.get(e.session_id), buyer = s.buyer_type || null;
      if (!trail.has(e.session_id)) trail.set(e.session_id, []);
      trail.get(e.session_id).push({ ts: e.ts, type: e.type, role: e.role, text: e.text, topic: e.topic, page_id: e.page_id, page_url: e.page_url });
      if (isSaid(e)) ideas.push({ ts: e.ts, session_id: e.session_id, buyer_type: buyer, visitor_company: s.company || null, channel: channel(e), text: e.text, topic: e.topic });
      if (e.type === 'reco_click' || e.type === 'reco_shown') {
        const k = (e.text || e.topic || '').trim();
        if (k) {
          const c = clicks.get(k) || { title: k, topic: e.topic, shown: 0, clicks: 0, sessions: new Set() };
          if (e.type === 'reco_shown') c.shown++; else { c.clicks++; c.sessions.add(e.session_id); }
          clicks.set(k, c);
        }
      }
      if (!isAsk(e)) continue;
      const t = topics.get(e.topic) || { topic: e.topic, mentions: 0, sessions: new Set(), by_buyer: {} };
      t.mentions++; t.sessions.add(e.session_id); t.by_buyer[buyer || 'unknown'] = (t.by_buyer[buyer || 'unknown'] || 0) + 1;
      topics.set(e.topic, t);
      const b = byBuyer.get(buyer) || { buyer_type: buyer, asks: 0, sessions: new Set(), topics: new Map() };
      b.asks++; b.sessions.add(e.session_id);
      const bt = b.topics.get(e.topic) || { topic: e.topic, mentions: 0, sessions: new Set() };
      bt.mentions++; bt.sessions.add(e.session_id); b.topics.set(e.topic, bt);
      byBuyer.set(buyer, b);
      const pk = `${s.sector || ''}|${buyer || ''}|${e.topic}`;
      const p = promo.get(pk) || { sector: s.sector || null, buyer_type: buyer, topic: e.topic, mentions: 0, sessions: new Set() };
      p.mentions++; p.sessions.add(e.session_id); promo.set(pk, p);
    }

    const recent = sessions.map(s => {
      const steps = trail.get(s.id) || [];
      const asked = steps.filter(isAsk);
      return { id: s.id, buyer_type: s.buyer_type, sector: s.sector, visitor_company: s.company,
        started_at: steps[0]?.ts || s.created_at, last_at: steps.at(-1)?.ts || s.created_at,
        asks: asked.length, topics: [...new Set(asked.map(x => x.topic))], steps: steps.slice(-80) };
    }).sort((a, b) => String(b.last_at).localeCompare(String(a.last_at))).slice(0, 20);

    const top_topics = rank(topics);
    const reco_clicks = rank(clicks).filter(c => c.clicks).sort((a, b) => b.clicks - a.clicks);
    const promoted = rank(promo).filter(p => p.sessions >= PROMOTE_AT);
    return res.status(200).json({
      company: { name: company.name, domain: d, since: company.created_at },
      totals: {
        sessions: sessions.length,
        asks: top_topics.reduce((n, t) => n + t.mentions, 0),
        reco_clicks: reco_clicks.reduce((n, c) => n + c.clicks, 0),
        ideas: ideas.length,
        promoted: promoted.length,
        last_activity: events.at(-1)?.ts || null,
      },
      top_topics,
      demand_by_buyer: [...byBuyer.values()].map(b => ({ buyer_type: b.buyer_type, asks: b.asks, sessions: b.sessions.size, topics: rank(b.topics) }))
        .sort((a, b) => b.sessions - a.sessions || b.asks - a.asks),
      reco_clicks,
      ideas: ideas.reverse().slice(0, 30),
      promoted,
      sessions: recent,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    if (/PGRST205/.test(String(e))) return res.status(503).json({ error: 'companies table missing: run memory/schema.sql in Supabase' });
    return res.status(502).json({ error: 'could not read the dashboard data' });
  }
}

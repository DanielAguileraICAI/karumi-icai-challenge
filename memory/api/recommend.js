// GET ?url=<web>&buyer=<tipo>&session=<id>  → scrapea la web y devuelve recomendaciones para ese tipo de buyer.
// Cada recomendación se guarda en `recommendations` (si hay Supabase). Clics/ideas se guardan vía /api/memory con type reco_click|reco_idea.
import { safeUrl, fetchText, strip } from './_util.js';
import { sb, dbReady, cors, upsertSession, hostOf } from './_db.js';
import { chat, parseJson } from './_llm.js';

const pick = (re, s) => { const m = s.match(re); return m ? strip(m[1]) : ''; };

async function scrape(href) {
  const home = await fetchText(href, 8000);
  const base = new URL(home.finalUrl || href);
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, home.text);
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i, home.text);
  const heads = [...home.text.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => strip(m[1])).filter(h => h && h.length < 140).slice(0, 25);
  const links = []; const seen = new Set();
  for (const m of home.text.matchAll(/<a[^>]+href=["']([^"'#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let l; try { l = new URL(m[1], base); } catch { continue; }
    if (l.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '') || seen.has(l.pathname)) continue;
    if (/\.(png|jpe?g|svg|pdf|zip|css|js|ico|webp|gif)$/i.test(l.pathname) || /(login|signin|privacy|cookie|terms)/i.test(l.pathname)) continue;
    seen.add(l.pathname);
    const anchor = strip(m[2]).slice(0, 80);
    if (anchor.length > 2) links.push({ anchor, url: l.href });
  }
  return { url: base.href, title, desc, heads, links: links.slice(0, 30) };
}

async function rank(site, buyer) {
  const out = await chat([
    { role: 'system', content: 'Eres el cerebro de una demo de producto. Dada la web de un producto y un tipo de comprador, elige 4 cosas de la web que más le interesarían, ordenadas. Responde SOLO JSON {"recommendations":[{"key":"slug_corto","title":"max 6 palabras","why":"1 frase, por qué a este comprador","page_url":"url de la lista de enlaces o null"}]}. Responde en el idioma de la web.' },
    { role: 'user', content: JSON.stringify({ buyer_type: buyer, site }) }]);
  const recs = out && parseJson(out)?.recommendations;
  return Array.isArray(recs) && recs.length ? recs : null;
}

// Sin LLM: heurística simple sobre titulares y enlaces.
const fallback = (site) => [...site.links.map(l => ({ title: l.anchor, page_url: l.url })), ...site.heads.map(h => ({ title: h, page_url: null }))]
  .slice(0, 4).map((x, i) => ({ key: 'r' + i, title: x.title.slice(0, 60), why: 'Aparece destacado en la web.', page_url: x.page_url }));

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const u = safeUrl(req.query.url);
  if (!u) return res.status(400).json({ error: 'bad url' });
  const buyer = String(req.query.buyer || 'general').slice(0, 60);
  try {
    const site = await scrape(u.href);
    let recs = null;
    try { recs = await rank(site, buyer); } catch {}
    const source = recs ? 'llm' : 'heuristic';
    recs = (recs || fallback(site)).slice(0, 4);
    if (dbReady() && req.query.session) {
      try {
        await upsertSession({ id: req.query.session, product_url: site.url, domain: hostOf(site.url), buyer_type: buyer });
        await sb('/recommendations', { method: 'POST', prefer: 'return=minimal',
          body: recs.map(r => ({ session_id: req.query.session, product_url: site.url, buyer_type: buyer, rec_key: r.key, title: r.title, why: r.why })) });
      } catch {}
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ product_url: site.url, buyer_type: buyer, source, recommendations: recs });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
}

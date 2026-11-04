// Basic page map from a URL: homepage + same-site links, each with title/summary/keywords.
// Dani's planner can replace this: the frontend accepts any JSON with the same shape (see plan.example.json).
import { safeUrl, fetchText, strip } from './_util.js';

const pick = (re, s) => { const m = s.match(re); return m ? strip(m[1]) : ''; };

function describe(html, url) {
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html) || url;
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i, html)
    || pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i, html);
  const heads = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => strip(m[1])).filter(h => h && h.length < 120).slice(0, 8);
  return { title, summary: [desc, ...heads].filter(Boolean).join(' · ').slice(0, 500), headings: heads };
}

const STOP = new Set('the and for with your you our are from that this into más para con los las del una por que como sus nos tus'.split(' '));
const keywords = s => [...new Set((s.toLowerCase().match(/[a-záéíóúñü]{4,}/g) || []).filter(w => !STOP.has(w)))].slice(0, 15);

export default async function handler(req, res) {
  const u = safeUrl(req.query.url);
  if (!u) return res.status(400).json({ error: 'bad url' });
  const max = Math.min(+req.query.max || 12, 25);
  try {
    const home = await fetchText(u.href, 8000);
    const base = new URL(home.finalUrl || u.href);
    const seen = new Set([base.href.split('#')[0]]);
    const links = [];
    for (const m of home.text.matchAll(/<a[^>]+href=["']([^"'#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      let l; try { l = new URL(m[1], base); } catch { continue; }
      if (l.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) continue;
      if (/\.(png|jpe?g|svg|pdf|zip|css|js|xml|ico|webp|gif|mp4)$/i.test(l.pathname)) continue;
      if (/(login|signin|sign-in|signup|register|legal|privacy|cookie|terms|careers|jobs)/i.test(l.pathname)) continue;
      l.hash = ''; l.search = '';
      if (seen.has(l.href)) continue;
      seen.add(l.href);
      links.push({ url: l.href, anchor: strip(m[2]).slice(0, 80) });
    }
    const top = links.slice(0, max - 1);
    const pages = [{ url: base.href, anchor: 'Inicio', ...describe(home.text, base.href) }];
    const got = await Promise.allSettled(top.map(async l => {
      const r = await fetchText(l.url, 5000);
      if (!r.ok || !/html/i.test(r.type)) return null;
      return { ...l, ...describe(r.text, l.url) };
    }));
    for (const g of got) if (g.status === 'fulfilled' && g.value) pages.push(g.value);
    const plan = {
      product: describe(home.text, base.href).title.split(/[|\-–·:]/)[0].trim() || base.hostname,
      url: base.href,
      source: 'basic-map',
      pages: pages.map((p, i) => ({
        id: 'p' + i,
        url: p.url,
        title: (p.anchor && p.anchor.length > 2 && i > 0 ? p.anchor + ' — ' : '') + p.title,
        summary: p.summary,
        keywords: keywords([p.anchor, p.title, p.summary].join(' ')),
        score: i === 0 ? 1 : 0.5,
      })),
    };
    res.setHeader('Cache-Control', 's-maxage=600');
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
}

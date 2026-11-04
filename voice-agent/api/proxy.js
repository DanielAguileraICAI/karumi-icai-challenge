// Serves a product page from our own origin so it can be shown in an iframe and the agent can
// scroll/highlight inside it. Adds <base href> so relative assets still load from the real site.
import { safeUrl, fetchText } from './_util.js';

export default async function handler(req, res) {
  const u = safeUrl(req.query.url);
  if (!u) return res.status(400).send('bad url');
  try {
    const r = await fetchText(u.href, 8000);
    if (!/html/i.test(r.type)) { res.setHeader('Location', u.href); return res.status(302).end(); }
    const base = r.finalUrl || u.href;
    let html = r.text
      .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '')
      .replace(/<base[^>]*>/gi, '');
    const inject = `<base href="${base.replace(/"/g, '&quot;')}"><style>.kv-hl{outline:4px solid #ff3b30!important;outline-offset:4px!important;border-radius:6px;box-shadow:0 0 0 9999px rgba(0,0,0,.35)!important;transition:all .3s;position:relative;z-index:2147483646}</style>`;
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + inject) : inject + html;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Final-Url', base);
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).send(html);
  } catch (e) {
    return res.status(502).send(`<p style="font:16px system-ui;padding:2rem">No se pudo cargar ${u.href}: ${String(e)}</p>`);
  }
}

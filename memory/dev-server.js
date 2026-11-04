// Local: node dev-server.js → http://localhost:5174  (ALLOW_LOCAL=1 para webs en localhost; env de Supabase/OpenAI opcionales)
import http from 'node:http'; import { readFile } from 'node:fs/promises';
const routes = { '/api/memory': './api/memory.js', '/api/recommend': './api/recommend.js', '/api/insights': './api/insights.js' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const r = Object.assign(res, { status(c) { res.statusCode = c; return res; }, json(o) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; } });
  if (routes[u.pathname]) {
    req.query = Object.fromEntries(u.searchParams);
    let b = ''; for await (const c of req) b += c; try { req.body = b ? JSON.parse(b) : {}; } catch { req.body = {}; }
    return (await import(routes[u.pathname])).default(req, r);
  }
  try { res.setHeader('Content-Type', 'text/html'); res.end(await readFile('./index.html')); } catch { res.statusCode = 404; res.end(); }
}).listen(5174, () => console.log('http://localhost:5174'));

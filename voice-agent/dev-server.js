// Local stand-in for `vercel dev`: serves static files and routes /api/* to the handlers.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const root = new URL('.', import.meta.url).pathname;
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    const mod = await import(join(root, u.pathname + '.js'));
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    res.send = s => res.end(s);
    req.query = Object.fromEntries(u.searchParams);
    return mod.default(req, res);
  }
  const p = join(root, u.pathname === '/' ? 'index.html' : u.pathname);
  try { res.setHeader('Content-Type', types[extname(p)] || 'application/octet-stream'); res.end(await readFile(p)); }
  catch { res.statusCode = 404; res.end('not found'); }
}).listen(process.env.PORT || 5173, () => console.log('http://localhost:' + (process.env.PORT || 5173)));

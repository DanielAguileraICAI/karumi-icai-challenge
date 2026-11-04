// Karumi memory: "empresa tipo X pidió Y". Learns from past journeys which pages/questions repeat for
// the same (or a similar) buyer type, so the agent can anticipate. Local-first (localStorage), shared via /api/memory.
const KEY = 'karumi.memory', CAP = 5000;
let apiBase = '';
let shared = [];            // steps fetched from /api/memory (cache, merged with local)

export function configure(opts = {}) { if (opts.apiBase != null) apiBase = String(opts.apiBase).replace(/\/$/, ''); }

// ---------- storage ----------
function readLocal() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function writeLocal(all) { try { localStorage.setItem(KEY, JSON.stringify(all.slice(-CAP))); } catch {} }
const stepKey = s => `${s.session_id}|${s.ts}|${s.type}|${s.page_id || ''}|${(s.text || '').slice(0, 40)}`;

export function remember(step, { post = true } = {}) {
  if (!step) return;
  const all = readLocal(); all.push(step); writeLocal(all);
  if (post) try {
    fetch(`${apiBase}/api/memory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(step), keepalive: true }).catch(() => {});
  } catch {}
}

export async function loadShared(product_url) {
  try {
    const r = await fetch(`${apiBase}/api/memory?product=${encodeURIComponent(product_url || '')}`);
    if (!r.ok) return shared.length;
    const j = await r.json();
    const seen = new Set(shared.map(stepKey));
    for (const s of j.steps || []) { const k = stepKey(s); if (!seen.has(k)) { seen.add(k); shared.push(s); } }
    if (shared.length > CAP * 2) shared = shared.slice(-CAP * 2);
  } catch {}
  return shared.length;
}

export function clearMemory() { writeLocal([]); shared = []; }

// ---------- normalisation / similarity ----------
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const tokens = s => norm(s).split(/[^a-z0-9]+/).filter(t => t.length > 1);
const host = u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return norm(u).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]; } };
const GROUPS = {
  finance: ['cfo', 'ceo', 'finanzas', 'financiero', 'finance', 'financial', 'contable', 'controller'],
  tech: ['cto', 'it', 'developer', 'dev', 'ingeniero', 'engineer', 'tecnico', 'tech', 'devops'],
  sales: ['ventas', 'sales', 'marketing', 'comercial', 'cmo', 'growth'],
  ops: ['operaciones', 'ops', 'coo', 'operations', 'logistica'],
};
const groupsOf = b => { const t = new Set(tokens(b)); return Object.keys(GROUPS).filter(g => GROUPS[g].some(w => t.has(w))); };

/** 1 exact, 0.7 token overlap, 0.4 same synonym group, 0 otherwise. Empty target buyer → 0.3 for everyone. */
export function buyerSimilarity(a, b) {
  if (!norm(a)) return 0.3;
  if (!norm(b)) return 0;
  if (norm(a) === norm(b)) return 1;
  const ta = new Set(tokens(a)); if (tokens(b).some(t => ta.has(t))) return 0.7;
  const ga = groupsOf(a); if (groupsOf(b).some(g => ga.includes(g))) return 0.4;
  return 0;
}

// ---------- session model ----------
function sessions(product_url) {
  const h = product_url ? host(product_url) : '';
  const seen = new Set(), by = new Map();
  for (const s of [...shared, ...readLocal()]) {
    if (!s || !s.session_id || (h && s.product_url && host(s.product_url) !== h)) continue;
    const k = stepKey(s); if (seen.has(k)) continue; seen.add(k);
    if (!by.has(s.session_id)) by.set(s.session_id, { id: s.session_id, buyer: '', steps: [] });
    const S = by.get(s.session_id); S.steps.push(s); if (s.buyer && !S.buyer) S.buyer = s.buyer;
  }
  for (const S of by.values()) {
    S.steps.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const nav = []; S.titles = {};
    for (const s of S.steps) if (s.type === 'navigate' && s.page_id) {
      if (s.page_title) S.titles[s.page_id] = s.page_title;
      if (nav[nav.length - 1] !== s.page_id) nav.push(s.page_id);
    }
    S.nav = nav;
  }
  return [...by.values()];
}

function similar(buyer, product_url, excludeSession) {
  return sessions(product_url)
    .filter(S => S.id !== excludeSession && S.nav.length + S.steps.length > 1)
    .map(S => ({ ...S, w: buyerSimilarity(buyer, S.buyer) }))
    .filter(S => S.w > 0);
}

// ---------- queries ----------
export function suggestPath(buyer, product_url, { visited = [], max = 5, exclude_session } = {}) {
  const ss = similar(buyer, product_url, exclude_session).filter(S => S.nav.length);
  const agg = new Map(), titles = {};
  let totalW = 0;
  for (const S of ss) {
    totalW += S.w; Object.assign(titles, S.titles);
    const firstPos = new Map();
    S.nav.forEach((id, i) => { if (!firstPos.has(id)) firstPos.set(id, S.nav.length > 1 ? i / (S.nav.length - 1) : 0); });
    for (const [id, pos] of firstPos) {
      const a = agg.get(id) || { page_id: id, w: 0, n: 0, posSum: 0 };
      a.w += S.w; a.n += 1; a.posSum += pos * S.w; agg.set(id, a);
    }
  }
  const skip = new Set(visited);
  const top = [...agg.values()].filter(a => !skip.has(a.page_id)).sort((x, y) => y.w - x.w).slice(0, max);
  const path = top
    .map(a => ({ page_id: a.page_id, page_title: titles[a.page_id] || a.page_id, count: a.n, share: totalW ? +(a.w / totalW).toFixed(2) : 0, _pos: a.posSum / a.w, _w: a.w }))
    // typical visit order, nudged forward by frequency (popular pages come a bit earlier)
    .sort((x, y) => (x._pos - 0.25 * x._w / (totalW || 1)) - (y._pos - 0.25 * y._w / (totalW || 1)))
    .map(({ _pos, _w, ...p }) => p);
  const counts = {};
  for (const S of ss) if (S.buyer) counts[S.buyer] = (counts[S.buyer] || 0) + 1;
  const similar_buyers = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([b, sessions]) => ({ buyer: b, sessions, similarity: buyerSimilarity(buyer, b) }));
  return { path, sessions: ss.length, similar_buyers };
}

const STOP = new Set(('de la el en y a los las del que se por un una para con no es lo al su sus mas o como pero le me mi te tu ya este esta esto eso hay tiene tienen ser son fue muy si sobre entre cuando donde quien cual cuales hola gracias quiero quisiera querria puedes podrias puede ver saber dime decir enseña ensename muestrame muestra mostrar algo cosa cosas favor vale bueno pues nos vosotros ustedes usted ellos ella yo hacer hace estoy esta estan bien tambien solo todo todos otra otro ' +
  'the a an and or of to in on for with is are be it this that what how can could would you your me my we our do does show tell about have has i its from at by please want like need just so ok yes not').split(' '));
const STEM = t => t.length > 4 ? t.replace(/ones$/, 'on').replace(/([^s])s$/, '$1') : t;

export function topRequests(buyer, product_url, n = 5) {
  const counts = new Map();
  for (const S of similar(buyer, product_url)) {
    const inSession = new Set();
    for (const s of S.steps) if (s.type === 'utterance' && s.role === 'user' && s.text)
      for (const t of tokens(s.text)) if (t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t)) inSession.add(STEM(t));
    for (const t of inSession) counts.set(t, (counts.get(t) || 0) + 1);   // count sessions that asked, not repeats
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([term, count]) => ({ term, count }));
}

export function predictNext(buyer, product_url, current_page_id) {
  if (!current_page_id) return null;
  const tr = new Map(); let titles = {};
  for (const S of similar(buyer, product_url)) {
    Object.assign(titles, S.titles);
    for (let i = 0; i < S.nav.length - 1; i++) if (S.nav[i] === current_page_id) {
      const nx = S.nav[i + 1]; tr.set(nx, (tr.get(nx) || 0) + S.w);
    }
  }
  if (!tr.size) return null;
  const tot = [...tr.values()].reduce((a, b) => a + b, 0);
  const [page_id, w] = [...tr].sort((a, b) => b[1] - a[1])[0];
  return { page_id, page_title: titles[page_id] || page_id, confidence: +(w / tot).toFixed(2) };
}

const plural = b => /^[A-Z0-9]{2,5}$/.test(b.trim()) ? b.trim() + 's' : `perfiles «${b.trim()}»`;
export function summaryText(buyer, product_url, opts = {}) {
  const { path, sessions: n, similar_buyers } = suggestPath(buyer, product_url, { max: 4, ...opts });
  if (!n || !path.length) return '';
  const exact = similar_buyers.filter(s => norm(s.buyer) === norm(buyer)).reduce((a, s) => a + s.sessions, 0);
  const who = exact === n && buyer ? (n === 1 ? `1 ${buyer.trim()}` : `${n} ${plural(buyer)}`)
    : `${n} visitante${n > 1 ? 's' : ''} con perfil parecido${buyer ? ` a ${buyer.trim()}` : ''}`;
  const route = path.map(p => String(p.page_title).split(/\s[|\-–·:]\s/)[0].slice(0, 30)).join(' → ');
  const req = topRequests(buyer, product_url, 3).filter(r => r.count > 1).map(r => r.term);
  return `${who} antes que tú pidieron: ${route}` + (req.length ? `. Preguntaron sobre: ${req.join(', ')}.` : '.');
}

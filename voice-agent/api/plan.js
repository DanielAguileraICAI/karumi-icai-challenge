// CEREBRO: buyer-aware demo plan. GET /api/plan?url=..&buyer=CFO  or  ?url=..&buyers=CFO,CTO,Ventas
// Uses OpenAI when OPENAI_API_KEY is set; otherwise (or on any failure) a deterministic heuristic.
import { buildMap } from './map.js';

const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Buyer profiles: `match` detects the profile from buyer text, `terms` score pages, `ideas` seed buyer_ideas.
const PROFILES = {
  finance: {
    match: /\b(cfo|ceo|coo|finan\w*|contro\w*|tesor\w*|owner|fundador\w*|founder|direct\w* general|gerente|dueno|presiden\w*|compras|procurement)\b/,
    terms: { pricing: 3, price: 3, precio: 3, precios: 3, plan: 2, plans: 2, planes: 2, tarifa: 3, cost: 2, coste: 2, costo: 2, roi: 3, ahorro: 2, savings: 2, customers: 2, clientes: 2, 'case-stud': 2, case: 1, casos: 2, testimonial: 1, billing: 2, facturacion: 2, enterprise: 1 },
    label: 'negocio y finanzas',
    ideas: ['Cuánto cuesta y qué plan encaja con su tamaño', 'Retorno de la inversión y ahorro de tiempo/coste', 'Pruebas sociales: clientes y casos de éxito similares', 'Riesgo bajo: contratos, flexibilidad y escalado del gasto'],
  },
  tech: {
    match: /\b(cto|cio|ciso|tech\w*|tecnic\w*|dev\w*|desarroll\w*|engineer\w*|ingenier\w*|it|sistemas|arquitect\w*|seguridad|security|data)\b/,
    terms: { integration: 3, integrations: 3, integracion: 3, integraciones: 3, api: 3, docs: 2, documentation: 2, documentacion: 2, developer: 2, developers: 2, security: 3, seguridad: 3, compliance: 2, gdpr: 2, rgpd: 2, sso: 2, webhook: 2, sdk: 2, status: 1, architecture: 2, encryption: 2, cifrado: 2, iso: 1, soc: 2 },
    label: 'tecnología e integración',
    ideas: ['Cómo se integra con su stack actual (APIs, conectores)', 'Seguridad, cumplimiento normativo y protección de datos', 'Esfuerzo de implantación y mantenimiento para su equipo', 'Documentación y fiabilidad de la plataforma'],
  },
  sales: {
    match: /\b(sales|ventas|comercial\w*|vende\w*|account|sdr|bdr|revenue|cro|crm)\b/,
    terms: { product: 2, producto: 2, features: 3, funcionalidades: 3, caracteristicas: 2, customers: 2, clientes: 2, 'how-it-works': 3, como: 1, pipeline: 3, crm: 2, leads: 3, ventas: 2, sales: 2, integrations: 1, integraciones: 1, demo: 1 },
    label: 'ventas',
    ideas: ['Cómo ayuda a vender más y acortar el ciclo de venta', 'Funcionalidades clave para el día a día del equipo comercial', 'Clientes que ya lo usan con resultados', 'Encaje con su CRM y herramientas actuales'],
  },
  marketing: {
    match: /\b(marketing|cmo|growth|brand\w*|marca|contenido|content|seo|ecommerce|e-commerce|tienda|retail|pyme|smb)\b/,
    terms: { product: 2, producto: 2, features: 3, funcionalidades: 3, customers: 2, clientes: 2, 'how-it-works': 2, pricing: 1, precios: 1, integrations: 2, integraciones: 2, analytics: 2, campaign: 2, campanas: 2, ecommerce: 2, shop: 2, tienda: 2 },
    label: 'crecimiento y marketing',
    ideas: ['Cómo atrae y convierte más clientes', 'Facilidad de uso sin depender de IT', 'Integración con su tienda/herramientas de marketing', 'Coste asumible y resultados rápidos'],
  },
  ops: {
    match: /\b(ops|operac\w*|operations|rrhh|hr|people|soporte|support|customer success|logistic\w*|producc\w*)\b/,
    terms: { product: 2, producto: 2, features: 2, funcionalidades: 2, 'how-it-works': 3, workflow: 3, automation: 3, automatizacion: 3, integrations: 2, integraciones: 2, customers: 1, clientes: 1, support: 2, soporte: 2, onboarding: 2 },
    label: 'operaciones',
    ideas: ['Automatización de procesos y ahorro de horas', 'Facilidad de adopción por el equipo', 'Integración con sus flujos actuales', 'Soporte y acompañamiento en la implantación'],
  },
};
const GENERIC = {
  terms: { product: 2, producto: 2, features: 2, funcionalidades: 2, 'how-it-works': 2, solution: 2, soluciones: 2, customers: 1, clientes: 1, pricing: 1, precios: 1 },
  label: 'negocio',
  ideas: ['Qué problema resuelve el producto y para quién', 'Las funcionalidades más diferenciales', 'Quién lo usa ya', 'Cómo empezar y cuánto cuesta'],
};

function profilesFor(buyer) {
  const b = norm(buyer);
  const ps = Object.values(PROFILES).filter(p => p.match.test(b));
  return ps.length ? ps : [GENERIC];
}

const firstSentence = s => (String(s || '').split(/ · |(?<=[.!?])\s/)[0] || '').trim().slice(0, 140);

function heuristic(map, buyer) {
  const profs = profilesFor(buyer);
  const terms = {};
  for (const p of profs) for (const [k, w] of Object.entries(p.terms)) terms[k] = Math.max(terms[k] || 0, w);
  const texts = map.pages.map(pg => ({ head: norm(pg.title + ' ' + pg.url), body: norm(pg.summary + ' ' + (pg.keywords || []).join(' ')) }));
  const res = Object.fromEntries(Object.keys(terms).map(t => [t, new RegExp('(^|[^a-z])' + t.replace(/[-]/g, '[- ]?'), 'i')]));
  // terms present on (nearly) every page (e.g. the product name "CRM") don't discriminate: ignore them
  if (texts.length > 2) for (const t of Object.keys(terms)) {
    const n = texts.filter(x => res[t].test(x.head + ' ' + x.body)).length;
    if (n >= Math.max(3, texts.length * 0.8)) delete terms[t];
  }
  const isGeneric = profs[0] === GENERIC;
  const scored = map.pages.map((pg, i) => {
    const { head, body } = texts[i];
    let raw = 0; const hits = [];
    for (const [t, w] of Object.entries(terms)) {
      const re = res[t];
      const inHead = re.test(head), inBody = re.test(body);
      if (inHead || inBody) { raw += w * (inHead ? 2 : 1); hits.push(t); }
    }
    return { pg, i, raw, hits };
  });
  const maxRaw = Math.max(1, ...scored.map(s => s.raw));
  const pages = scored.map(({ pg, i, raw, hits }) => {
    let score = 0.15 + 0.85 * (raw / maxRaw);
    if (i === 0) score = isGeneric ? 1 : Math.max(score, 0.45); // home stays reachable (first for unknown buyers)
    if (raw === 0 && i > 0) score = 0.1 + Math.max(0, 0.1 - i * 0.01);
    score = Math.round(Math.min(1, score) * 100) / 100;
    const name = (pg.title || '').split(/ — | [|\-–] /)[0].trim() || 'esta página';
    const why = hits.length
      ? `Relevante para ${buyer}: trata ${hits.slice(0, 3).join(', ')}.`
      : i === 0 ? `Punto de partida: visión general del producto para ${buyer}.` : `Contexto secundario para ${buyer}.`;
    const parts = String(pg.summary || '').split(' · ').map(s => s.trim()).filter(s => s.length > 3);
    const talking_points = (parts.length ? parts.slice(0, 3).map(p => `${name}: ${firstSentence(p)}`) : [`Mostrar ${name} y conectarlo con las prioridades de ${buyer}.`]);
    return { ...pg, score, why, talking_points };
  });
  pages.sort((a, b) => b.score - a.score);
  const top = pages.filter(p => p.score >= 0.5).slice(0, 2).map(p => (p.title || '').split(/ — | [|\-–] /)[0].trim()).filter(Boolean);
  const label = profs.map(p => p.label).join(' y ');
  const opening = `Hola, te enseño ${map.product} pensando en lo que más le importa a un perfil ${buyer}: ${label}.` +
    (top.length ? ` Empezaremos por ${top.join(' y ')}.` : '');
  const siteHints = pages.filter(p => p.score >= 0.5).slice(0, 2).map(p => `Lo que muestra ${p.title.split(/ — /)[0]}: ${firstSentence(p.summary) || p.title}`);
  const buyer_ideas = [...new Set([...profs.flatMap(p => p.ideas), ...siteHints])].slice(0, 5);
  return { opening, buyer_ideas, pages, brain: 'heuristic' };
}

async function llm(map, buyer, base) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const list = map.pages.map(p => ({ id: p.id, url: p.url, title: p.title, summary: (p.summary || '').slice(0, 300) }));
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.PLAN_MODEL || 'gpt-4.1-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Eres un preventa experto. Planificas una demo de producto web adaptada al tipo de comprador. Responde SOLO JSON en español. Básate únicamente en el contenido de las páginas dadas; no inventes datos.' },
          { role: 'user', content: `Producto: ${map.product} (${map.url})\nComprador: ${buyer}\nPáginas:\n${JSON.stringify(list)}\n\nDevuelve JSON: {"opening": "1-2 frases de apertura para este comprador", "buyer_ideas": ["3-5 cosas que probablemente le importan a este comprador, derivadas del sitio"], "pages": [{"id": "p0", "score": 0.0-1.0 relevancia para este comprador, "why": "razón corta", "talking_points": ["1-3 puntos cortos basados en el resumen de la página"]}]} con todas las páginas.` },
        ],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const out = JSON.parse(j.choices?.[0]?.message?.content || '{}');
    const byId = new Map((Array.isArray(out.pages) ? out.pages : []).map(p => [p.id, p]));
    if (!byId.size) return null;
    const pages = base.pages.map(p => {
      const o = byId.get(p.id) || {};
      const score = Number.isFinite(+o.score) && o.score !== null ? Math.max(0, Math.min(1, +o.score)) : p.score;
      const tps = Array.isArray(o.talking_points) ? o.talking_points.filter(x => typeof x === 'string' && x.trim()).slice(0, 3) : [];
      return { ...p, score, why: typeof o.why === 'string' && o.why.trim() ? o.why : p.why, talking_points: tps.length ? tps : p.talking_points };
    }).sort((a, b) => b.score - a.score);
    const ideas = Array.isArray(out.buyer_ideas) ? out.buyer_ideas.filter(x => typeof x === 'string' && x.trim()).slice(0, 5) : [];
    return {
      opening: typeof out.opening === 'string' && out.opening.trim() ? out.opening : base.opening,
      buyer_ideas: ideas.length >= 3 ? ideas : base.buyer_ideas,
      pages, brain: 'llm',
    };
  } catch { return null; } finally { clearTimeout(t); }
}

export async function planFor(map, buyer) {
  buyer = String(buyer || '').trim() || 'comprador';
  const base = heuristic(map, buyer);
  let out = base;
  try { out = (await llm(map, buyer, base)) || base; } catch { out = base; }
  const pages = out.pages;
  // keep home reachable: if it fell out of the top 3, it's still in the list (just ensure present)
  if (!pages.some(p => p.id === 'p0')) pages.push(base.pages.find(p => p.id === 'p0'));
  return { product: map.product, url: map.url, source: 'plan', brain: out.brain, buyer, opening: out.opening, buyer_ideas: out.buyer_ideas, pages: pages.filter(Boolean) };
}

export default async function handler(req, res) {
  const q = req.query || {};
  let map;
  try { map = await buildMap(q.url, q.max || 12); }
  catch (e) { return res.status(e.status || 502).json({ error: e.status === 400 ? 'bad url' : String(e) }); }
  try {
    res.setHeader('Cache-Control', 's-maxage=600');
    if (q.buyers) {
      const buyers = String(q.buyers).split(',').map(s => s.trim()).filter(Boolean).slice(0, 6);
      const demos = await Promise.all(buyers.map(b => planFor(map, b)));
      return res.status(200).json({ product: map.product, url: map.url, demos });
    }
    return res.status(200).json(await planFor(map, q.buyer));
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

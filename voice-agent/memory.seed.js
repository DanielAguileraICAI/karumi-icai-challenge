// Demo seed: 6 fake past sessions so the "learning" is visible live.
// CFO x3: pricing → customers → security. CTO x3: integrations → security → docs.
// Pages are matched by title keyword (ids differ per site). Unmatched topics get a synthetic page.
import { remember } from './memory.js';

const TOPICS = {
  pricing: { re: /precio|pricing|price|plan(es)?\b|tarifa|coste|cost/i, title: 'Precios' },
  customers: { re: /client|customer|caso|case|success|testimon|historia/i, title: 'Clientes' },
  security: { re: /segur|security|privac|complian|gdpr|rgpd|trust|confian/i, title: 'Seguridad' },
  integrations: { re: /integra|connect|conector|api\b|apps?\b|plugin/i, title: 'Integraciones' },
  docs: { re: /doc|developer|desarroll|guia|guía|help|ayuda|soporte|support/i, title: 'Documentación' },
};
const SESSIONS = [
  { buyer: 'CFO', topics: ['pricing', 'customers', 'security'], asks: ['¿Cuánto cuesta? Quiero ver el precio', 'Qué clientes lo usan y el retorno', '¿Es seguro? cumplimiento RGPD'] },
  { buyer: 'CFO', topics: ['pricing', 'customers', 'security'], asks: ['Enséñame los precios por favor', 'casos de clientes parecidos', 'seguridad de los datos financieros'] },
  { buyer: 'CFO', topics: ['pricing', 'security', 'customers'], asks: ['precio por usuario', 'seguridad y auditoría', 'clientes en mi sector'] },
  { buyer: 'CTO', topics: ['integrations', 'security', 'docs'], asks: ['¿Qué integraciones tiene? API', 'seguridad, SSO y cifrado', 'documentación de la API'] },
  { buyer: 'CTO', topics: ['integrations', 'security', 'docs'], asks: ['se integra con nuestro stack', 'seguridad SOC2', 'docs para developers'] },
  { buyer: 'CTO', topics: ['integrations', 'docs', 'security'], asks: ['integraciones disponibles', 'quiero ver la documentación', 'seguridad del API'] },
];

/** pageIdsByTitle: {title: page_id} | [{id,title}] | plan.pages. Returns number of steps inserted (0 if already seeded). */
export function seedDemo(product_url, pageIdsByTitle = {}, { force = false } = {}) {
  const pages = Array.isArray(pageIdsByTitle) ? pageIdsByTitle.map(p => ({ id: p.id ?? p.page_id, title: p.title ?? p.page_title ?? '' }))
    : Object.entries(pageIdsByTitle).map(([title, id]) => ({ id, title }));
  let host = 'demo'; try { host = new URL(product_url).hostname; } catch {}
  try {
    const already = JSON.parse(localStorage.getItem('karumi.memory') || '[]').some(s => s.session_id === `seed-${host}-0`);
    if (already && !force) return 0;
  } catch {}
  const pick = t => {
    const p = pages.find(p => TOPICS[t].re.test(p.title || '')) || pages.find(p => TOPICS[t].re.test(String(p.id)));
    return p ? { page_id: p.id, page_title: p.title } : { page_id: `seed-${t}`, page_title: TOPICS[t].title };
  };
  let n = 0, t0 = Date.now() - 7 * 864e5;
  SESSIONS.forEach((sess, i) => {
    const session_id = `seed-${host}-${i}`;
    let ts = t0 + i * 36e5;
    const step = s => { remember({ session_id, ts: new Date(ts += 15000).toISOString(), product_url, buyer: sess.buyer, source: 'seed', ...s }, { post: false }); n++; };
    step({ type: 'session_start' });
    sess.topics.forEach((t, k) => {
      const p = pick(t);
      step({ type: 'utterance', role: 'user', text: sess.asks[k], page_id: null });
      step({ type: 'navigate', ...p, reason: `seed: ${t}` });
    });
  });
  return n;
}

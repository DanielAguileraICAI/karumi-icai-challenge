// Live Demo Agent: a voice agent that re-decides what to show "first" after every thing the visitor says.
// Realtime voice = OpenAI Realtime over WebRTC (key minted by /api/session). Without a key it falls back
// to the browser's speech recognition + a local page matcher, so the demo never dies on stage.

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const API = (window.KARUMI_API_BASE ?? params.get('api') ?? '').replace(/\/$/, '');
const MEMORY_URL = window.KARUMI_MEMORY_URL || params.get('memory') || '';   // Claudia's memory endpoint (optional)
const LANG = params.get('lang') || 'es-ES';

const S = { plan: null, cur: null, visited: [], journey: [], sessionId: crypto.randomUUID(), rt: null, rec: null, live: false, loadWaiters: [] };

// ---------- UI helpers ----------
function log(role, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + role; d.textContent = text;
  $('#log').append(d); $('#log').scrollTop = 1e9;
}
const pageById = id => S.plan?.pages.find(p => p.id === id);
function renderRoute(nextId) {
  const ol = $('#route'); ol.innerHTML = '';
  // Visited pages first, in the order the conversation chose them, then the rest of the plan.
  const order = [...S.visited, ...S.plan.pages.map(p => p.id).filter(id => !S.visited.includes(id))];
  for (const id of order) {
    const p = pageById(id); if (!p) continue;
    const li = document.createElement('li');
    li.textContent = p.title.slice(0, 60);
    li.className = [S.visited.includes(id) && 'visited', S.cur === id && 'cur', nextId === id && 'next'].filter(Boolean).join(' ');
    li.onclick = () => navigate(id, 'click en la ruta', 'click');
    ol.append(li);
  }
  $('#steps').textContent = S.journey.length + ' pasos';
}

// ---------- Journey (contract for Claudia's memory) ----------
function record(step) {
  const s = { session_id: S.sessionId, ts: new Date().toISOString(), product_url: S.plan?.url, ...step };
  S.journey.push(s);
  try {
    const all = JSON.parse(localStorage.getItem('karumi.journeys') || '[]'); all.push(s);
    localStorage.setItem('karumi.journeys', JSON.stringify(all.slice(-2000)));
  } catch {}
  window.dispatchEvent(new CustomEvent('karumi:step', { detail: s }));
  if (MEMORY_URL) fetch(MEMORY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }).catch(() => {});
  $('#steps').textContent = S.journey.length + ' pasos';
}
$('#export').onclick = () => {
  const blob = new Blob([JSON.stringify({ session_id: S.sessionId, plan: S.plan, journey: S.journey }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `journey-${S.sessionId.slice(0, 8)}.json`; a.click();
};

// ---------- Stage: navigate / highlight / scroll ----------
const frame = $('#frame');
frame.addEventListener('load', () => {
  let doc; try { doc = frame.contentDocument; } catch { doc = null; }
  if (doc) {
    // Keep clicks inside the proxied stage so the agent always knows where we are.
    doc.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank') return;
      e.preventDefault();
      const p = S.plan.pages.find(p => p.url === a.href.split('#')[0]);
      if (p) navigate(p.id, 'el visitante hizo click', 'click');
      else showUrl(a.href);
    }, true);
  }
  const w = S.loadWaiters; S.loadWaiters = []; w.forEach(f => f());
});
function showUrl(url) {
  frame.src = `${API}/api/proxy?url=${encodeURIComponent(url)}`;
  $('#openTab').href = url;
  return new Promise(r => { S.loadWaiters.push(r); setTimeout(r, 7000); });
}
function visibleText(max = 1800) {
  try { return (frame.contentDocument?.body?.innerText || '').replace(/\s+/g, ' ').slice(0, max); } catch { return ''; }
}
async function navigate(id, reason = '', source = 'agent', utterance = '') {
  const p = pageById(id); if (!p) return { ok: false, error: 'unknown page_id ' + id };
  S.cur = id; if (!S.visited.includes(id)) S.visited.push(id);
  $('#curTitle').textContent = p.title;
  renderRoute();
  log('sys', `→ ${p.title}${reason ? ' · ' + reason : ''}`);
  record({ type: 'navigate', page_id: id, page_url: p.url, page_title: p.title, reason, source, utterance });
  await showUrl(p.url);
  return { ok: true, page: p.title, url: p.url, on_screen_text: visibleText() };
}
function highlight(text) {
  let doc; try { doc = frame.contentDocument; } catch { return { ok: false, error: 'cross-origin' }; }
  if (!doc) return { ok: false };
  doc.querySelectorAll('.kv-hl').forEach(e => e.classList.remove('kv-hl'));
  const needle = text.toLowerCase().trim();
  const els = [...doc.querySelectorAll('h1,h2,h3,h4,p,li,button,a,span,td,label,img[alt]')];
  let best = null, bestLen = 1e9;
  for (const el of els) {
    const t = (el.innerText || el.alt || '').toLowerCase();
    if (t.includes(needle) && t.length < bestLen) { best = el; bestLen = t.length; }
  }
  if (!best) { // fall back to the element sharing most words
    const words = needle.split(/\s+/).filter(w => w.length > 3); let score = 0;
    for (const el of els) { const t = (el.innerText || '').toLowerCase(); if (t.length > 400) continue; const s = words.filter(w => t.includes(w)).length; if (s > score) { score = s; best = el; } }
  }
  if (!best) return { ok: false, error: 'not found on screen' };
  const target = best.closest('section,article,div') && best.innerText.length < 25 ? best.parentElement : best;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('kv-hl');
  record({ type: 'highlight', page_id: S.cur, text });
  return { ok: true, highlighted: (target.innerText || '').slice(0, 200) };
}
function scrollStage(direction) {
  try { frame.contentWindow.scrollBy({ top: (direction === 'up' ? -1 : 1) * frame.clientHeight * 0.8, behavior: 'smooth' }); } catch {}
  return { ok: true, on_screen_text: visibleText(800) };
}

// ---------- Local matcher (fallback brain, also used to suggest "next") ----------
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const SYN = { precio: ['pricing', 'price', 'plans', 'planes', 'cuesta', 'coste', 'tarifa'], integraciones: ['integrations', 'integracion', 'api', 'conecta', 'connect'], seguridad: ['security', 'privacy', 'gdpr', 'soc'], clientes: ['customers', 'case', 'casos', 'testimonios', 'stories'], producto: ['product', 'features', 'funcionalidades', 'como funciona', 'how'], equipo: ['about', 'nosotros', 'team'], docs: ['docs', 'documentation', 'documentacion', 'developers'] };
function expand(q) { let t = norm(q); for (const [k, vs] of Object.entries(SYN)) if ([k, ...vs].some(v => t.includes(v))) t += ' ' + [k, ...vs].join(' '); return t; }
function rank(q) {
  const words = expand(q).split(/[^a-z0-9]+/).filter(w => w.length > 2);
  return S.plan.pages.map(p => {
    const hay = norm([p.title, p.summary, p.url, ...(p.keywords || [])].join(' '));
    let s = 0; for (const w of words) if (hay.includes(w)) s += norm(p.title + p.url).includes(w) ? 3 : 1;
    return { p, s: s + (p.score || 0) * 0.1 };
  }).sort((a, b) => b.s - a.s);
}
async function fallbackTurn(text) {
  log('user', text);
  record({ type: 'utterance', role: 'user', text, page_id: S.cur });
  if (/siguiente|next|otra cosa|que mas|qué más/i.test(text)) {
    const n = S.plan.pages.find(p => !S.visited.includes(p.id));
    if (n) { await navigate(n.id, 'siguiente en el plan', 'fallback', text); return say(`Te enseño ${n.title}.`); }
  }
  const [top] = rank(text);
  if (top && top.s >= 1 && top.p.id !== S.cur) {
    await navigate(top.p.id, 'lo más relacionado con lo que has dicho', 'fallback', text);
    const r = highlight(text);
    return say(`Vamos a ${top.p.title.split('—')[0].trim()}. ${r.ok ? 'Te marco la parte relevante.' : ''} ¿Qué te gustaría ver después?`);
  }
  const r = highlight(text);
  say(r.ok ? 'Aquí lo tienes, lo he resaltado en pantalla.' : 'No lo veo en esta página. ¿Me lo cuentas de otra forma?');
}
function say(text) {
  log('agent', text); record({ type: 'utterance', role: 'agent', text, page_id: S.cur });
  try { const u = new SpeechSynthesisUtterance(text); u.lang = LANG; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {}
}

// ---------- Realtime voice (OpenAI) ----------
const TOOLS = [
  { type: 'function', name: 'navigate_to_page', description: 'Show a page of the product on screen. Call this BEFORE talking whenever what the visitor just said is better answered by another page.', parameters: { type: 'object', properties: { page_id: { type: 'string', description: 'id from the page list' }, reason: { type: 'string', description: 'why this page answers what the visitor just said (short)' } }, required: ['page_id', 'reason'] } },
  { type: 'function', name: 'highlight', description: 'Scroll to and visually highlight a piece of text visible on the current page, to point at what you are talking about.', parameters: { type: 'object', properties: { text: { type: 'string', description: 'exact short text from the page (a heading, button or phrase)' } }, required: ['text'] } },
  { type: 'function', name: 'scroll', description: 'Scroll the current page up or down.', parameters: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] } }, required: ['direction'] } },
];
function instructions() {
  const pages = S.plan.pages.map(p => `- ${p.id}: ${p.title} | ${p.url}\n  ${(p.summary || '').slice(0, 260)}`).join('\n');
  return `Eres el agente de demo en vivo de "${S.plan.product}". Estás en una llamada de voz con un visitante y controlas la pantalla que está viendo.
Principio: "lo primero que enseñar" no es fijo; se recalcula después de CADA cosa que dice el visitante.
Reglas:
1. Tras cada frase del visitante, decide qué página responde mejor a lo que acaba de decir. Si no es la actual, llama a navigate_to_page ANTES de hablar.
2. Cuando ya estés en la página, usa highlight para señalar exactamente lo que explicas (usa texto que aparezca en on_screen_text).
3. Habla poco: máximo 2 frases cortas, luego una pregunta breve para descubrir qué le importa (rol, problema, urgencia).
4. Si pregunta algo que no está en las páginas, dilo con honestidad y propón lo más cercano. No inventes funcionalidades ni precios.
5. Responde en el idioma del visitante (por defecto español).
Empieza saludando en una frase y preguntando qué le trae por aquí y cuál es su rol.
Páginas disponibles:
${pages}`;
}
async function runTool(name, args) {
  if (name === 'navigate_to_page') return navigate(args.page_id, args.reason, 'voice', S.lastUser || '');
  if (name === 'highlight') return highlight(args.text || '');
  if (name === 'scroll') return scrollStage(args.direction);
  return { ok: false, error: 'unknown tool' };
}
async function startRealtime() {
  const r = await fetch(`${API}/api/session`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'no session');
  const { value: ek } = await r.json();
  const pc = new RTCPeerConnection();
  const audio = new Audio(); audio.autoplay = true;
  pc.ontrack = e => { audio.srcObject = e.streams[0]; };
  const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
  pc.addTrack(mic.getTracks()[0]);
  const dc = pc.createDataChannel('oai-events');
  const send = o => dc.readyState === 'open' && dc.send(JSON.stringify(o));
  dc.onopen = () => {
    send({ type: 'session.update', session: { type: 'realtime', instructions: instructions(), tools: TOOLS, tool_choice: 'auto', audio: { input: { transcription: { model: 'gpt-4o-mini-transcribe' }, turn_detection: { type: 'server_vad', silence_duration_ms: 500 } } } } });
    send({ type: 'response.create' });
  };
  const done = new Set();
  dc.onmessage = async ev => {
    const m = JSON.parse(ev.data);
    switch (m.type) {
      case 'conversation.item.input_audio_transcription.completed':
        if (m.transcript?.trim()) { S.lastUser = m.transcript.trim(); log('user', S.lastUser); record({ type: 'utterance', role: 'user', text: S.lastUser, page_id: S.cur }); }
        break;
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        if (m.transcript) { log('agent', m.transcript); record({ type: 'utterance', role: 'agent', text: m.transcript, page_id: S.cur }); }
        break;
      case 'response.function_call_arguments.done': {
        if (done.has(m.call_id)) break; done.add(m.call_id);
        let args = {}; try { args = JSON.parse(m.arguments || '{}'); } catch {}
        const out = await runTool(m.name, args);
        send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: m.call_id, output: JSON.stringify(out) } });
        send({ type: 'response.create' });
        break;
      }
      case 'error': log('sys', 'error: ' + (m.error?.message || JSON.stringify(m))); break;
    }
  };
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  const sdp = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', body: offer.sdp, headers: { Authorization: `Bearer ${ek}`, 'Content-Type': 'application/sdp' } });
  if (!sdp.ok) throw new Error('webrtc ' + sdp.status + ' ' + (await sdp.text()).slice(0, 200));
  await pc.setRemoteDescription({ type: 'answer', sdp: await sdp.text() });
  return { pc, dc, send, mic, stop() { mic.getTracks().forEach(t => t.stop()); pc.close(); } };
}

// ---------- Browser voice fallback ----------
function startBrowserVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { log('sys', 'Este navegador no reconoce voz: usa la caja de texto.'); return null; }
  const rec = new SR(); rec.lang = LANG; rec.continuous = true; rec.interimResults = false;
  rec.onresult = e => { const t = e.results[e.results.length - 1][0].transcript.trim(); if (t) fallbackTurn(t); };
  rec.onend = () => { if (S.live && S.rec === rec) try { rec.start(); } catch {} };
  rec.start();
  say('Hola. Cuéntame qué te trae por aquí y te enseño justo eso.');
  return { stop() { S.rec = null; rec.stop(); } };
}

// ---------- Wiring ----------
$('#talk').onclick = async () => {
  if (S.live) { S.live = false; S.rt?.stop(); S.rec?.stop(); S.rt = S.rec = null; $('#talk').classList.remove('live'); $('#talk').textContent = '🎙️ Hablar con el agente'; return; }
  S.live = true; $('#talk').classList.add('live'); $('#talk').textContent = '■ Parar';
  try { S.rt = await startRealtime(); $('#mode').textContent = 'modo: voz en tiempo real (OpenAI Realtime)'; log('sys', 'Conectado. Habla cuando quieras.'); }
  catch (e) { $('#mode').textContent = 'modo: voz del navegador (sin clave) · ' + e.message; S.rec = startBrowserVoice(); }
};
$('#say').onsubmit = e => {
  e.preventDefault(); const t = $('#sayText').value.trim(); if (!t || !S.plan) return; $('#sayText').value = '';
  if (S.rt) { S.lastUser = t; log('user', t); record({ type: 'utterance', role: 'user', text: t, page_id: S.cur, typed: true }); S.rt.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: t }] } }); S.rt.send({ type: 'response.create' }); }
  else fallbackTurn(t);
};
async function loadPlan(url) {
  log('sys', 'Preparando mapa de ' + url + '…');
  // Accept Dani's planner output directly: ?plan=<json url> or window.KARUMI_PLAN_URL
  const planUrl = params.get('plan') || window.KARUMI_PLAN_URL;
  const r = await fetch(planUrl ? planUrl : `${API}/api/map?url=${encodeURIComponent(url)}`);
  const plan = await r.json();
  if (!plan.pages?.length) throw new Error(plan.error || 'sin páginas');
  plan.pages.forEach((p, i) => { p.id ||= 'p' + i; });
  plan.pages.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  S.plan = plan; S.visited = []; S.journey = [];
  record({ type: 'session_start', product: plan.product, plan_source: plan.source || 'external', pages: plan.pages.length });
  log('sys', `${plan.pages.length} páginas de ${plan.product}. Pulsa el micro o escribe.`);
  $('#talk').disabled = false;
  await navigate(plan.pages[0].id, 'punto de partida del plan', 'plan');
}
$('#urlForm').onsubmit = async e => {
  e.preventDefault(); let u = $('#url').value.trim(); if (!u) return; if (!/^https?:/.test(u)) u = 'https://' + u;
  try { await loadPlan(u); } catch (err) { log('sys', 'Error: ' + err.message); }
};
if (params.get('url')) { $('#url').value = params.get('url'); $('#urlForm').requestSubmit(); }
window.KarumiDemo = { S, navigate, highlight, rank };

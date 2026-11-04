/* Demo guide widget: in-page voice demo agent. Plain browser JS, no deps. */
(function () {
  if (window.__nsWidget) return; window.__nsWidget = true;
  var KEY = 'nextstep.live';
  var SYN = [
    [['price', 'precio', 'cuesta', 'coste', 'cost', 'tarifa', 'plan', 'planes', 'pricing'], 'pricing cost price'],
    [['seguridad', 'security', 'sso', 'gdpr', 'privacidad', 'privacy', 'permisos'], 'security'],
    [['integracion', 'integration', 'api', 'conecta', 'connect', 'sap', 'erp'], 'integrations integration api'],
    [['nomina', 'payroll', 'salario', 'sueldo', 'pay'], 'payroll'],
    [['vacaciones', 'time off', 'ausencia', 'leave', 'holiday', 'permiso'], 'time off timeoff leave absence'],
    [['gastos', 'expense', 'expenses', 'tickets', 'recibo'], 'expenses expense'],
    [['contratar', 'recruiting', 'hiring', 'candidato', 'seleccion', 'hire'], 'recruiting talent hiring'],
    [['informe', 'informes', 'dashboard', 'dashboards', 'report', 'analytics', 'metricas'], 'analytics insight dashboards'],
    [['planificar', 'planning', 'forecast', 'presupuesto', 'budget'], 'planning forecast budget'],
    [['asistente', 'assistant', ' ia ', ' ai ', 'copilot', 'inteligencia'], 'assistant ai'],
    [['cierre', 'close', 'contabilidad', 'accounting'], 'close financials'],
    [['evaluacion', 'performance', 'desempeno'], 'performance'],
    [['habilidades', 'skills', 'formacion'], 'skills'],
    [['empleados', 'org chart', 'organigrama', 'directory', 'people'], 'directory people org']
  ];
  var STOP = { the: 1, and: 1, for: 1, que: 1, los: 1, las: 1, del: 1, con: 1, una: 1, por: 1, you: 1, how: 1, what: 1, can: 1, para: 1, como: 1, este: 1, esto: 1, with: 1 };
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var S = null, speaking = false, listening = false, talkOn = false, rec = null, el = {}, open = false;

  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function lang() { return S && S.profile && S.profile.language === 'es' ? 'es' : 'en'; }
  function T(en, es) { return lang() === 'es' ? es : en; }
  function base() { return (S && S.base) || '/client-site/'; }
  function steps() { return S.plan.steps; }
  function cur() { return steps()[S.stepIndex] || null; }
  function sid() { if (!S.session_id) S.session_id = 'ns-' + Date.now().toString(36); return S.session_id; }

  function record(r) {
    var rec = Object.assign({ session_id: sid(), ts: new Date().toISOString(), product_url: location.origin + base(), type: '', role: 'agent', text: '', page_id: cur() ? cur().id : null, page_url: location.href, reason: '', source: 'widget' }, r);
    S.journey = S.journey || []; S.journey.push(rec); save();
    try { window.dispatchEvent(new CustomEvent('karumi:step', { detail: rec })); } catch (e) {}
  }

  function buildDefault(schema) {
    var feats = schema.features.slice().sort(function (a, b) { return b.wow - a.wow; });
    var top = feats.slice(0, 5);
    var t = 15;
    var st = top.map(function (f, i) {
      var s = { n: i + 1, id: f.id, name: f.name, module: f.module, screen: f.screen, start: t, seconds: f.seconds, score: f.wow, why: ['High impact feature'], say: f.does + '. ' + f.proof + '.', check: i === 0 ? 'What would you like to see next?' : null, role: i === 0 ? 'hook' : 'core' };
      t += f.seconds; return s;
    });
    return {
      profile: null, base: '/client-site/', stepIndex: 0, journey: [],
      features: schema.features.map(function (f) { return Object.assign({ score: f.wow }, f); }),
      plan: { opening: 'Welcome to ' + schema.product + '.', totalSeconds: t + 15, budgetSeconds: t + 15, steps: st, mustKnow: [], leftOut: [], nextStep: 'Book a tailored demo with our team' }
    };
  }

  function pathOf(step) { return (base() + step.screen).replace(/\/+/g, '/'); }
  function matchStepIndex() {
    var p = location.pathname;
    for (var i = 0; i < steps().length; i++) if (pathOf(steps()[i]) === p) return i;
    return -1;
  }

  /* ---------- UI ---------- */
  function css() {
    if (!document.querySelector('link[data-ns-font]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-ns-font', '1');
      l.href = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;600;700&display=swap';
      document.head.appendChild(l);
    }
    var s = document.createElement('style');
    s.textContent = [
      '.ns-root{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:"Schibsted Grotesk",system-ui,sans-serif;color:#161515;font-size:14px;line-height:1.4}',
      '.ns-root *{box-sizing:border-box;font-family:inherit}',
      '.ns-pill{display:flex;align-items:center;gap:10px;background:#161515;color:#FFDFF3;border:0;border-radius:4px;padding:10px 14px;cursor:pointer;font-size:14px;font-weight:600}',
      '.ns-dots{display:inline-flex;align-items:center;gap:3px;height:16px}',
      '.ns-dots i{display:block;width:4px;height:4px;border-radius:2px;background:currentColor;transition:height .12s}',
      '.ns-live .ns-dots i{animation:ns-lvl .9s ease-in-out infinite}',
      '.ns-dots i:nth-child(2){animation-delay:.1s}.ns-dots i:nth-child(3){animation-delay:.25s}.ns-dots i:nth-child(4){animation-delay:.05s}.ns-dots i:nth-child(5){animation-delay:.3s}.ns-dots i:nth-child(6){animation-delay:.15s}',
      '@keyframes ns-lvl{0%,100%{height:4px}50%{height:14px}}',
      '.ns-panel{width:360px;max-height:80vh;overflow:auto;background:#FFDFF3;border:1px solid #161515;border-radius:4px}',
      '.ns-head{display:flex;align-items:center;gap:10px;background:#161515;color:#FFDFF3;padding:10px 12px}',
      '.ns-head b{flex:1;font-weight:600}.ns-head small{opacity:.85}',
      '.ns-x{background:none;border:0;color:#FFDFF3;cursor:pointer;font-size:16px;padding:0 4px}',
      '.ns-body{padding:12px}',
      '.ns-mod{font-size:12px;text-transform:uppercase;letter-spacing:.04em;opacity:.7}',
      '.ns-name{font-size:18px;font-weight:700;margin:2px 0 6px}',
      '.ns-say{margin:0 0 8px}',
      '.ns-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
      '.ns-chip{background:#D8D0E8;color:#161515;border-radius:4px;padding:2px 8px;font-size:12px}',
      '.ns-change{background:#D9F56A;color:#161515;border-radius:4px;padding:8px;margin-bottom:10px;font-size:13px}',
      '.ns-reply{background:#F2EAD9;color:#161515;border-radius:4px;padding:8px;margin-bottom:10px;font-size:13px}',
      '.ns-btns{display:flex;gap:8px;margin-bottom:8px}',
      '.ns-btn{flex:1;background:#161515;color:#FFDFF3;border:1px solid #161515;border-radius:4px;padding:8px;cursor:pointer;font-weight:600;font-size:14px}',
      '.ns-btn.ns-alt{background:#FFDFF3;color:#161515}.ns-btn.ns-on{background:#D9F56A;color:#161515}',
      '.ns-form{display:flex;gap:6px;margin-bottom:12px}',
      '.ns-in{flex:1;border:1px solid #161515;border-radius:4px;padding:7px 8px;background:#fff;color:#161515;font-size:13px}',
      '.ns-route{border-top:1px solid #161515;padding-top:8px;margin:0;list-style:none}',
      '.ns-route li{display:flex;gap:8px;padding:4px 0;font-size:13px;cursor:pointer}',
      '.ns-route li span:first-child{width:16px;text-align:center}',
      '.ns-route li.ns-cur{font-weight:700}',
      '.ns-close{background:#D8D0E8;color:#161515;border-radius:4px;padding:10px;margin-bottom:10px}',
      '.ns-mark{outline:2px solid #161515 !important;outline-offset:4px;transition:outline-color .3s}',
      '.ns-tint{background:#D9F56A !important;color:#161515 !important}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function dots() { return '<span class="ns-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function mount() {
    css();
    var root = document.createElement('div'); root.className = 'ns-root'; el.root = root;
    document.body.appendChild(root); render();
  }
  function setLive() { if (el.root) el.root.classList.toggle('ns-live', speaking || listening); }

  function render(extra) {
    extra = extra || el.extra || {}; el.extra = extra;
    var root = el.root; if (!root) return;
    if (!open) {
      root.innerHTML = '<button class="ns-pill" type="button">' + dots() + '<span>' + T('Demo guide', 'Guía de la demo') + '</span></button>';
      root.querySelector('.ns-pill').onclick = function () { open = true; render(); };
      setLive(); return;
    }
    var st = cur(), n = steps().length, name = S.profile && S.profile.name ? S.profile.name : T('Visitor', 'Visitante');
    var done = S.stepIndex >= n;
    var visited = S.visited || [];
    var h = '<div class="ns-panel"><div class="ns-head">' + dots() + '<b>' + esc(name) + '</b><small>' +
      (done ? T('Demo done', 'Demo terminada') : T('Step ', 'Paso ') + (S.stepIndex + 1) + T(' of ', ' de ') + n) +
      '</small><button class="ns-x" type="button" aria-label="Close">x</button></div><div class="ns-body">';
    if (extra.change) h += '<div class="ns-change">' + esc(extra.change) + '</div>';
    if (extra.reply) h += '<div class="ns-reply">' + esc(extra.reply) + '</div>';
    if (done || !st) {
      h += '<div class="ns-close"><div class="ns-mod">' + T('Next step', 'Siguiente paso') + '</div><div class="ns-name">' + esc(S.plan.nextStep || '') + '</div></div>';
    } else {
      h += '<div class="ns-mod">' + esc(st.module) + '</div><div class="ns-name">' + esc(st.name) + '</div><p class="ns-say">' + esc(st.say) + '</p>';
      var why = (st.why || []).slice(0, 4);
      if (why.length) h += '<div class="ns-chips">' + why.map(function (w) { return '<span class="ns-chip">' + esc(w) + '</span>'; }).join('') + '</div>';
    }
    h += '<div class="ns-btns"><button class="ns-btn ns-next" type="button">' + (done ? T('Restart', 'Reiniciar') : (S.stepIndex + 1 >= n ? T('Finish', 'Terminar') : T('Next', 'Siguiente'))) + '</button>' +
      (rec ? '<button class="ns-btn ns-alt ns-talk' + (talkOn ? ' ns-on' : '') + '" type="button">' + (talkOn ? T('Stop', 'Parar') : T('Talk', 'Hablar')) + '</button>' : '') + '</div>';
    h += '<form class="ns-form"><input class="ns-in" placeholder="' + T('Ask or type a topic', 'Pregunta o escribe un tema') + '"><button class="ns-btn ns-alt" style="flex:0 0 auto" type="submit">' + T('Send', 'Enviar') + '</button></form>';
    h += '<ol class="ns-route">' + steps().map(function (s, i) {
      var mark = i === S.stepIndex ? '&#9679;' : (visited.indexOf(s.id) >= 0 || i < S.stepIndex ? '&#10003;' : '');
      return '<li data-i="' + i + '" class="' + (i === S.stepIndex ? 'ns-cur' : '') + '"><span>' + mark + '</span><span>' + esc(s.name) + '</span></li>';
    }).join('') + '</ol></div></div>';
    root.innerHTML = h; setLive();
    root.querySelector('.ns-x').onclick = function () { open = false; render(); };
    root.querySelector('.ns-next').onclick = next;
    var tb = root.querySelector('.ns-talk'); if (tb) tb.onclick = toggleTalk;
    root.querySelector('.ns-form').onsubmit = function (e) { e.preventDefault(); var i = root.querySelector('.ns-in'); var v = i.value.trim(); if (v) { i.value = ''; heard(v, 'typed'); } };
    Array.prototype.forEach.call(root.querySelectorAll('.ns-route li'), function (li) {
      li.onclick = function () { go(+li.getAttribute('data-i'), 'picked from route'); };
    });
  }

  /* ---------- voice ---------- */
  function say(text) {
    if (!text || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang() === 'es' ? 'es-ES' : 'en-US';
      u.onstart = function () { speaking = true; setLive(); };
      u.onend = function () { speaking = false; setLive(); if (talkOn) listen(); };
      u.onerror = function (e) { speaking = false; setLive(); if (e && e.error === 'not-allowed') pendingSay = text; else if (talkOn) listen(); };
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  /* Chrome blocks speech on a fresh page until the visitor interacts: replay the line on the first click or key. */
  var pendingSay = null;
  function flushSay() { if (pendingSay) { var t = pendingSay; pendingSay = null; say(t); } }
  document.addEventListener('pointerdown', flushSay, true);
  document.addEventListener('keydown', flushSay, true);
  function setupRec() {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return null;
    var r = new R(); r.continuous = false; r.interimResults = false;
    r.onstart = function () { listening = true; setLive(); };
    r.onend = function () { listening = false; setLive(); if (talkOn && !speaking) setTimeout(listen, 250); };
    r.onerror = function (e) { if (e.error === 'not-allowed') { talkOn = false; render(); } };
    r.onresult = function (e) { var t = e.results[0][0].transcript; if (t) heard(t, 'voice'); };
    return r;
  }
  function listen() { if (!rec || !talkOn || listening || speaking) return; try { rec.lang = lang() === 'es' ? 'es-ES' : 'en-US'; rec.start(); } catch (e) {} }
  function toggleTalk() {
    talkOn = !talkOn;
    if (talkOn) { if (window.speechSynthesis) speechSynthesis.cancel(); speaking = false; listen(); } else { try { rec.stop(); } catch (e) {} }
    record({ type: 'mic', role: 'user', text: talkOn ? 'mic on' : 'mic off', reason: 'talk button' });
    render();
  }

  /* ---------- navigation ---------- */
  function go(i, reason) {
    var st = steps()[i];
    S.stepIndex = i; save();
    if (!st) { render({}); var ns = S.plan.nextStep || ''; say(T('That is the demo. Next step: ', 'Esa es la demo. Siguiente paso: ') + ns); record({ type: 'close', text: ns, reason: reason || 'end of plan' }); return; }
    record({ type: 'navigate', text: st.name, page_id: st.id, page_url: location.origin + pathOf(st), reason: reason || 'next in plan' });
    if (pathOf(st) === location.pathname) { arrive(); return; }
    location.href = pathOf(st);
  }
  function next() {
    if (S.stepIndex >= steps().length) { S.stepIndex = 0; S.visited = []; save(); return go(0, 'restart'); }
    go(S.stepIndex + 1, 'next in plan');
  }

  function highlight(st) {
    var t = (st && document.querySelector('[data-feature="' + st.id + '"]')) || document.querySelector('main') || document.body;
    try { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    var hd = t.querySelector && t.querySelector('h1, h2, h3');
    t.classList.add('ns-mark'); if (hd) hd.classList.add('ns-tint');
    setTimeout(function () { t.classList.remove('ns-mark'); if (hd) hd.classList.remove('ns-tint'); }, 3000);
  }
  function arrive() {
    var st = cur(); el.extra = el.extra || {};
    if (!st) { render(); return; }
    S.visited = S.visited || []; if (S.visited.indexOf(st.id) < 0) S.visited.push(st.id); save();
    open = true; render();
    highlight(st);
    var pre = S.stepIndex === 0 && S.plan.opening && !S.openingDone ? S.plan.opening + ' ' : '';
    if (pre) { S.openingDone = true; save(); }
    setTimeout(function () { say(pre + st.say); }, 400);
  }

  /* ---------- live replanning ---------- */
  function expand(q) {
    var t = ' ' + norm(q) + ' ', add = [];
    SYN.forEach(function (row) { if (row[0].some(function (v) { return t.indexOf(norm(v)) >= 0; })) add.push(row[1]); });
    return { text: t, extra: add.join(' ') };
  }
  function rank(q) {
    var ex = expand(q);
    var words = (ex.text + ' ' + ex.extra).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2 && !STOP[w]; });
    return (S.features || []).map(function (f) {
      var hay = norm([f.id, f.name, f.does, f.module, (f.themes || []).join(' '), f.screen].join(' '));
      var key = norm([f.id, f.name, f.module].join(' '));
      var s = 0;
      words.forEach(function (w) { if (hay.indexOf(w) >= 0) s += key.indexOf(w) >= 0 ? 3 : 1; });
      return { f: f, s: s + (f.score || 0) * 0.01 };
    }).sort(function (a, b) { return b.s - a.s; });
  }
  function toStep(f) {
    return { n: 0, id: f.id, name: f.name, module: f.module, screen: f.screen, start: 0, seconds: f.seconds, score: f.score || 0,
      why: [T('You asked about it', 'Lo has pedido')], say: f.does + '. ' + f.proof + '.', check: null, role: 'core' };
  }
  function heard(text, source) {
    record({ type: 'utterance', role: 'user', text: text, reason: source, source: 'widget-' + source });
    var t = norm(text);
    if (/^(next|siguiente|sigue|continua|continue|vale|ok)\b/.test(t)) { render({}); return next(); }
    var r = rank(text), top = r[0], st = cur();
    if (top && top.s >= 3 && (!st || top.f.id !== st.id)) {
      var f = top.f, list = steps();
      var at = -1; for (var i = 0; i < list.length; i++) if (list[i].id === f.id) at = i;
      var moved = at >= 0 ? list.splice(at, 1)[0] : toStep(f);
      var ins = Math.min(S.stepIndex + 1 - (at >= 0 && at <= S.stepIndex ? 1 : 0), list.length);
      if (ins < 0) ins = 0;
      list.splice(ins, 0, moved);
      if (at >= 0 && at < S.stepIndex) S.stepIndex -= 1;
      list.forEach(function (s, k) { s.n = k + 1; });
      save();
      var change = T('Plan changed: you asked about ' + text + ', so next is ' + f.name, 'Plan cambiado: has preguntado por ' + text + ', así que lo siguiente es ' + f.name);
      record({ type: 'replan', role: 'agent', text: change, page_id: f.id, reason: 'matched score ' + top.s.toFixed(1) });
      render({ change: change });
      say(T('Good question. Next I will show you ' + f.name + '. Press Next when you are ready.', 'Buena pregunta. Ahora te enseño ' + f.name + '. Pulsa Siguiente cuando quieras.'));
      return;
    }
    if (top && top.s >= 3 && st && top.f.id === st.id) {
      var rep0 = T('That is what we are looking at now. ', 'Es justo lo que estamos viendo. ') + st.say;
      render({ reply: rep0 }); say(rep0); highlight(st);
      record({ type: 'reply', text: rep0, reason: 'already on it' }); return;
    }
    var rep = (st && st.check) || T('Tell me more: what matters most for you here?', 'Cuéntame más: ¿qué es lo que más te importa aquí?');
    record({ type: 'reply', text: rep, reason: 'no clear match, plan kept' });
    render({ reply: rep }); say(rep);
  }

  /* ---------- boot ---------- */
  function boot() {
    S = load();
    var ready = S && S.plan && S.plan.steps && S.plan.steps.length ? Promise.resolve() :
      fetch('/client-site/features.json').then(function (r) { return r.json(); }).then(function (schema) { S = buildDefault(schema); save(); });
    ready.then(function () {
      if (!S.features) S.features = [];
      if (S.stepIndex == null) S.stepIndex = 0;
      rec = setupRec();
      mount();
      var i = matchStepIndex();
      if (i >= 0) {
        if (i !== S.stepIndex) { S.stepIndex = i; save(); }
        arrive();
      }
    }).catch(function (e) { console.warn('[demo guide] could not start', e); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

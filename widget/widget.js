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
    var pr = S.profile || {};
    if (pr.role) rec.buyer_type = pr.role;
    if (pr.sector) rec.sector = pr.sector;
    if (pr.company) rec.company = pr.company;
    if (rec.type === 'replan' && rec.page_id) rec.topic = rec.page_id;
    S.journey = S.journey || []; S.journey.push(rec); save();
    try { var all = JSON.parse(localStorage.getItem('karumi.journeys') || '[]'); all.push(rec); localStorage.setItem('karumi.journeys', JSON.stringify(all.slice(-500))); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('karumi:step', { detail: rec })); } catch (e) {}
    // Memory API (Claudia): ?memory=<url>/api/memory on the agent web, or window.KARUMI_MEMORY_URL
    var mem = S.memory || window.KARUMI_MEMORY_URL || localStorage.getItem('nextstep.memory') || (/^(localhost|127\.)/.test(location.hostname) ? null : '/api/memory');
    if (mem) { try { fetch(mem, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) }).catch(function () {}); } catch (e) {} }
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
      '.ns-recos{border-top:1px solid #161515;padding-top:8px;margin-bottom:10px}',
      '.ns-recos .ns-mod{margin-bottom:6px}',
      '.ns-reco{display:block;width:100%;text-align:left;background:#D8D0E8;color:#161515;border:0;border-radius:4px;padding:7px 8px;margin-bottom:6px;cursor:pointer;font-size:13px;font-weight:600}',
      '.ns-reco small{display:block;font-weight:400;opacity:.8}',
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
      (rec || window.RTCPeerConnection ? '<button class="ns-btn ns-alt ns-talk' + (talkOn ? ' ns-on' : '') + '" type="button">' + (talkOn ? T('Stop', 'Parar') : T('Talk', 'Hablar')) + '</button>' : '') + '</div>';
    h += '<form class="ns-form"><input class="ns-in" placeholder="' + T('Ask or type a topic', 'Pregunta o escribe un tema') + '"><button class="ns-btn ns-alt" style="flex:0 0 auto" type="submit">' + T('Send', 'Enviar') + '</button></form>';
    var rc = (S.recos || []).slice(0, 4);
    if (rc.length) h += '<div class="ns-recos"><div class="ns-mod">' + T('You may also want to see', 'También te puede interesar') + '</div>' + rc.map(function (r, i) {
      return '<button class="ns-reco" type="button" data-r="' + i + '">' + esc(r.title) + (r.why ? '<small>' + esc(r.why) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
    else loadRecos();
    h += '<ol class="ns-route">' + steps().map(function (s, i) {
      var mark = i === S.stepIndex ? '&#9679;' : (visited.indexOf(s.id) >= 0 || i < S.stepIndex ? '&#10003;' : '');
      return '<li data-i="' + i + '" class="' + (i === S.stepIndex ? 'ns-cur' : '') + '"><span>' + mark + '</span><span>' + esc(s.name) + '</span></li>';
    }).join('') + '</ol></div></div>';
    root.innerHTML = h; setLive();
    root.querySelector('.ns-x').onclick = function () { open = false; render(); };
    root.querySelector('.ns-next').onclick = next;
    var tb = root.querySelector('.ns-talk'); if (tb) tb.onclick = toggleTalk;
    root.querySelector('.ns-form').onsubmit = function (e) { e.preventDefault(); var i = root.querySelector('.ns-in'); var v = i.value.trim(); if (v) { i.value = ''; heard(v, 'typed'); } };
    Array.prototype.forEach.call(root.querySelectorAll('.ns-reco'), function (b) {
      b.onclick = function () { pickReco((S.recos || [])[+b.getAttribute('data-r')]); };
    });
    Array.prototype.forEach.call(root.querySelectorAll('.ns-route li'), function (li) {
      li.onclick = function () { go(+li.getAttribute('data-i'), 'picked from route'); };
    });
  }

  /* ---------- recommendations (memory /api/recommend) ---------- */
  var recoLoading = false;
  function loadRecos() {
    if (recoLoading || /^(localhost|127\.)/.test(location.hostname)) return;
    recoLoading = true;
    var pr = S.profile || {};
    var u = '/api/recommend?url=' + encodeURIComponent(location.origin + base()) + '&buyer=' + encodeURIComponent(pr.title || pr.role || 'general') + '&session=' + encodeURIComponent(sid());
    fetch(u).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      recoLoading = false;
      var list = d && d.recommendations ? d.recommendations.slice(0, 4) : [];
      if (!list.length) return;
      S.recos = list; save();
      if (!S.recoShown) { S.recoShown = true; save(); record({ type: 'reco_shown', text: list.map(function (r) { return r.title; }).join(' | '), reason: 'recommendations in widget', meta: { keys: list.map(function (r) { return r.key; }) } }); }
      if (open) render();
    }).catch(function () { recoLoading = false; });
  }
  function featureForUrl(url) {
    var path; try { path = new URL(url, location.href).pathname.replace(/\/+/g, '/'); } catch (e) { return null; }
    var fs = S.features || [];
    for (var i = 0; i < fs.length; i++) if (fs[i].screen && (base() + fs[i].screen).replace(/\/+/g, '/') === path) return fs[i];
    return null;
  }
  function insertNext(f) {
    var list = steps(), st = cur();
    if (st && st.id === f.id) return false;
    var at = -1; for (var i = 0; i < list.length; i++) if (list[i].id === f.id) at = i;
    var moved = at >= 0 ? list.splice(at, 1)[0] : toStep(f);
    if (at >= 0 && at <= S.stepIndex) S.stepIndex -= 1;
    var ins = Math.max(0, Math.min(S.stepIndex + 1, list.length));
    list.splice(ins, 0, moved);
    list.forEach(function (s, k) { s.n = k + 1; });
    save(); return ins;
  }
  function pickReco(r) {
    if (!r) return;
    record({ type: 'reco_click', role: 'user', text: r.title, topic: r.key, page_url: r.page_url || location.href, reason: 'recommendation button' });
    var f = r.page_url ? featureForUrl(r.page_url) : null;
    if (f) {
      var st = cur();
      if (st && st.id === f.id) { highlight(st); return; }
      var ins = insertNext(f);
      var change = T('Plan changed: you picked ' + r.title + ', so we go to ' + f.name, 'Plan cambiado: has elegido ' + r.title + ', así que vamos a ' + f.name);
      record({ type: 'replan', role: 'agent', text: change, page_id: f.id, reason: 'recommendation ' + r.key });
      el.extra = { change: change };
      return go(ins, 'recommendation ' + r.key);
    }
    if (r.page_url) location.href = r.page_url;
  }
  function matchReco(text) {
    var t = norm(text), rc = S.recos || [];
    for (var i = 0; i < rc.length; i++) {
      var title = norm(rc[i].title);
      var words = title.split(/[^a-z0-9]+/).filter(function (w) { return w.length > 3; });
      if (title && (t.indexOf(title) >= 0 || (words.length && words.filter(function (w) { return t.indexOf(w) >= 0; }).length >= Math.min(2, words.length)))) return rc[i];
    }
    return null;
  }

  /* ---------- OpenAI Realtime voice: the model is the live brain (tools drive the demo) ---------- */
  var RT = null, rtQueue = [], DBG = /rtdebug/.test(location.search) || localStorage.getItem('nextstep.rtdebug');
  function rtLog() { if (DBG) console.log.apply(console, ['[realtime]'].concat([].slice.call(arguments))); }
  function rtContext() {
    var pr = S.profile || {}, st = cur();
    var feats = (S.features || []).map(function (f) { return '- ' + f.id + ': ' + f.name + ' (' + (f.module || '') + '): ' + (f.does || '') + (f.proof ? ' Proof: ' + f.proof : ''); }).join('\n');
    var plan = steps().map(function (s, i) { return (i === S.stepIndex ? '>> ' : '   ') + (i + 1) + '. ' + s.id + ' ' + s.name; }).join('\n');
    var hist = (S.rtHist || []).slice(-8).map(function (h) { return h.r + ': ' + h.t; }).join('\n');
    return 'You are the live demo guide for the product shown on screen (Kestrel). You talk with a ' + (pr.title || pr.role || 'visitor') + (pr.company ? ' from ' + pr.company : '') + (pr.sector ? ' (' + pr.sector + ')' : '') + '.\n' +
      'Speak ' + (lang() === 'es' ? 'Spanish from Spain' : 'English') + '. Be brief: max 2 short sentences, then a short question.\n' +
      'The principle: what to show FIRST is recalculated after everything the visitor says.\n' +
      'Rules: if what the visitor says is better answered by another feature than the current one, call show_feature with its id (do not just describe it). If they want to continue, call next_step. If the current screen already answers, call read_screen and explain it using what is really on screen; use point_at to show where. To demo an action, use click or type_into (never click delete, send, pay or save buttons). Never invent features, prices or numbers that are not listed.\n' +
      'Features:\n' + feats + '\nCurrent plan (>> is on screen now):\n' + plan + (st ? '\nOn screen now: ' + st.name + ': ' + (st.say || '') : '') + (hist ? '\nConversation so far:\n' + hist : '');
  }
  var RT_TOOLS = [
    { type: 'function', name: 'show_feature', description: 'Change the plan and take the visitor to the screen of this feature now.', parameters: { type: 'object', properties: { feature_id: { type: 'string' }, reason: { type: 'string', description: 'short reason, in the visitor language' } }, required: ['feature_id'] } },
    { type: 'function', name: 'next_step', description: 'Go to the next step of the plan.', parameters: { type: 'object', properties: {} } },
    { type: 'function', name: 'read_screen', description: 'Read what is visible on the current screen (headings, numbers, buttons, fields). Use it before explaining details or when asked about something on screen.', parameters: { type: 'object', properties: {} } },
    { type: 'function', name: 'click', description: 'Click a button, tab or link on the current screen, by its visible text. Use it to demo an action live.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { type: 'function', name: 'type_into', description: 'Type a value into an input field on screen, found by its label or placeholder.', parameters: { type: 'object', properties: { field: { type: 'string' }, value: { type: 'string' } }, required: ['field', 'value'] } },
    { type: 'function', name: 'point_at', description: 'Scroll to and highlight a piece of text on screen to point at what you are talking about.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }
  ];
  /* ---------- screen: read / click / type / point (same page, direct DOM) ---------- */
  function onScreen(n) { return n && !(el.root && el.root.contains(n)) && n.offsetParent !== null; }
  function readScreen() {
    var out = [], seen = {};
    document.querySelectorAll('h1,h2,h3,h4,p,li,td,th,label,button,a,[role=tab],input,select,textarea,.kpi,.stat,.value').forEach(function (n) {
      if (!onScreen(n) || n.closest('nav,aside,header,[role=navigation]')) return;
      var t = (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') ? '[field ' + (n.getAttribute('aria-label') || n.placeholder || n.name || '') + '=' + (n.value || '') + ']' : (n.innerText || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 200 || seen[t]) return; seen[t] = 1;
      out.push((/^(BUTTON|A)$/.test(n.tagName) || n.getAttribute('role') === 'tab' ? '[button] ' : '') + t);
    });
    return { title: document.title, path: location.pathname, content: out.join('\n').slice(0, 3500), menu: 'other screens are reachable with show_feature' };
  }
  function findByText(text, sel) {
    var q = norm(text).trim(), best = null, bl = 1e9;
    document.querySelectorAll(sel).forEach(function (n) {
      if (!onScreen(n)) return;
      var t = norm(n.innerText || n.value || n.getAttribute('aria-label') || n.placeholder || '');
      if (t && t.indexOf(q) >= 0 && t.length < bl) { best = n; bl = t.length; }
    });
    return best;
  }
  window.__nsScreen = function (n, a) { return screenTool(n, a || {}); };
  function flash(n) { try { n.scrollIntoView({ behavior: 'smooth', block: 'center' }); var o = n.style.outline; n.style.outline = '3px solid #ff3b30'; n.style.outlineOffset = '3px'; setTimeout(function () { n.style.outline = o; }, 2500); } catch (e) {} }
  function screenTool(name, args) {
    if (name === 'read_screen') return readScreen();
    if (name === 'point_at') { var n = findByText(args.text || '', 'h1,h2,h3,h4,p,li,td,th,label,button,a,span,div'); if (!n) return { ok: false, error: 'not on screen' }; flash(n); record({ type: 'highlight', role: 'agent', text: args.text, source: 'widget-llm' }); return { ok: true }; }
    if (name === 'click') {
      var b = findByText(args.text || '', 'button,a,[role=tab],[role=button],input[type=submit],summary,label');
      if (!b) return { ok: false, error: 'no button with that text', screen: readScreen().content.slice(0, 800) };
      flash(b); record({ type: 'click', role: 'agent', text: args.text, source: 'widget-llm' });
      setTimeout(function () { b.click(); }, 500);
      return { ok: true, clicked: (b.innerText || args.text).slice(0, 80), note: 'call read_screen to see the result' };
    }
    if (name === 'type_into') {
      var f = null, q = norm(args.field || '');
      document.querySelectorAll('input,textarea').forEach(function (n) {
        if (f || !onScreen(n)) return;
        var lab = n.id && document.querySelector('label[for="' + n.id + '"]');
        var t = norm([n.getAttribute('aria-label'), n.placeholder, n.name, lab && lab.innerText].join(' '));
        if (t.indexOf(q) >= 0) f = n;
      });
      if (!f) return { ok: false, error: 'no field like that' };
      flash(f); f.focus(); f.value = args.value; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
      record({ type: 'type', role: 'agent', text: args.field + '=' + args.value, source: 'widget-llm' });
      return { ok: true };
    }
    return null;
  }
  function hist(r, t) { S.rtHist = (S.rtHist || []).concat([{ r: r, t: String(t).slice(0, 300) }]).slice(-12); save(); }
  function rtSpeak(text) {
    // Narration of a newly opened screen: the model presents it in its own words.
    if (!RT || !RT.ready) { rtQueue.push(text); return; }
    RT.send({ type: 'response.create', response: { instructions: 'The screen just changed. Present it briefly, in your own words, based on: ' + text + '. Then ask one short question.' } });
  }
  function rtTool(name, args, callId) {
    var out = { ok: true };
    var sc = screenTool(name, args);
    if (sc) { RT.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(sc) } }); RT.send({ type: 'response.create' }); return; }
    if (name === 'show_feature') {
      var f = (S.features || []).filter(function (x) { return x.id === args.feature_id; })[0];
      if (!f) out = { ok: false, error: 'unknown feature id' };
      else {
        var st = cur();
        if (st && st.id === f.id) { highlight(st); out = { ok: true, note: 'already on screen' }; }
        else {
          var ins = insertNext(f);
          var change = T('Plan changed: next is ' + f.name, 'Plan cambiado: lo siguiente es ' + f.name) + (args.reason ? ' (' + args.reason + ')' : '');
          record({ type: 'replan', role: 'agent', text: change, page_id: f.id, reason: 'llm: ' + (args.reason || '') , source: 'widget-llm' });
          el.extra = { change: change };
          out = { ok: true, navigating_to: f.name };
          RT.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(out) } });
          setTimeout(function () { go(ins, 'llm: ' + (args.reason || f.name)); }, 150);
          return;
        }
      }
    } else if (name === 'next_step') {
      RT.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: '{"ok":true}' } });
      setTimeout(next, 150); return;
    }
    RT.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(out) } });
    RT.send({ type: 'response.create' });
  }
  function startRT() {
    return fetch('/api/session', { method: 'POST' }).then(function (r) { return r.ok ? r.json() : r.json().then(function (j) { throw new Error(j.error || r.status); }); }).then(function (j) {
      var pc = new RTCPeerConnection(), audio = new Audio(); audio.autoplay = true;
      document.addEventListener('pointerdown', function () { try { audio.play(); } catch (e) {} }, true);
      pc.ontrack = function (e) { audio.srcObject = e.streams[0]; };
      var dc = pc.createDataChannel('oai-events');
      var rt = { pc: pc, dc: dc, ready: false, send: function (o) { if (dc.readyState === 'open') { rtLog('>>', o.type); dc.send(JSON.stringify(o)); } } };
      var done = {};
      dc.onopen = function () {
        rt.send({ type: 'session.update', session: { type: 'realtime', instructions: rtContext(), tools: RT_TOOLS, tool_choice: 'auto',
          audio: { input: { noise_reduction: { type: 'far_field' }, transcription: { model: 'gpt-4o-mini-transcribe', language: lang() },
            turn_detection: { type: 'semantic_vad', eagerness: 'low', create_response: true, interrupt_response: false } } } } });
        rt.ready = true; var q = rtQueue; rtQueue = []; q.slice(-1).forEach(rtSpeak);
      };
      dc.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        rtLog('<<', m.type, m.type === 'error' ? m.error : '');
        if (m.type === 'conversation.item.input_audio_transcription.completed' && m.transcript && m.transcript.trim()) {
          var t = m.transcript.trim(); hist('visitor', t);
          record({ type: 'utterance', role: 'user', text: t, reason: 'voice', source: 'widget-realtime' });
          el.extra = { reply: '🗣 ' + t }; if (open) render(el.extra);
        }
        if (m.type === 'response.output_audio_transcript.done' && m.transcript) { hist('agent', m.transcript); record({ type: 'reply', role: 'agent', text: m.transcript, source: 'widget-realtime' }); }
        if (m.type === 'response.function_call_arguments.done' && !done[m.call_id]) {
          done[m.call_id] = 1; var args = {}; try { args = JSON.parse(m.arguments || '{}'); } catch (e) {}
          rtLog('tool', m.name, args); rtTool(m.name, args, m.call_id);
        }
        if (m.type === 'input_audio_buffer.speech_started') { listening = true; setLive(); }
        if (m.type === 'input_audio_buffer.speech_stopped') { listening = false; setLive(); }
        if (m.type === 'output_audio_buffer.started') { speaking = true; setLive(); }
        if (m.type === 'output_audio_buffer.stopped') { speaking = false; setLive(); }
        if (m.type === 'error') console.warn('[realtime] error:', m.error && m.error.message);
      };
      pc.onconnectionstatechange = function () { rtLog('pc', pc.connectionState); if (pc.connectionState === 'failed') console.warn('[realtime] connection failed'); };
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (mic) {
        rt.mic = mic; pc.addTrack(mic.getTracks()[0]);
        return pc.createOffer();
      }).then(function (offer) { return pc.setLocalDescription(offer).then(function () {
        return fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', body: offer.sdp, headers: { Authorization: 'Bearer ' + j.value, 'Content-Type': 'application/sdp' } });
      }); }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('webrtc ' + r.status + ' ' + t.slice(0, 200)); }); return r.text(); })
        .then(function (sdp) { return pc.setRemoteDescription({ type: 'answer', sdp: sdp }); })
        .then(function () { RT = rt; console.info('[realtime] connected (OpenAI). Debug: add ?rtdebug=1'); return rt; });
    });
  }
  function stopRT() { if (!RT) return; try { RT.mic.getTracks().forEach(function (t) { t.stop(); }); RT.pc.close(); } catch (e) {} RT = null; }

  /* ---------- voice ---------- */
  function say(text) {
    if (text && (RT || (S && S.rtOn))) { rtSpeak(text); return; }
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
    if (talkOn) {
      if (window.speechSynthesis) speechSynthesis.cancel(); speaking = false;
      S.rtOn = true; save();
      startRT().then(function () { record({ type: 'mic', role: 'agent', text: 'openai realtime on', reason: 'voice' }); var st = cur(); if (st) say(st.say); })
        .catch(function (e) { console.warn('[realtime] fallback to browser voice:', e && e.message); S.rtOn = false; save(); rtQueue = []; listen(); });
    } else { S.rtOn = false; save(); stopRT(); try { rec.stop(); } catch (e) {} }
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
    if (RT && RT.ready && source === 'typed') { hist('visitor', text); record({ type: 'utterance', role: 'user', text: text, reason: 'typed', source: 'widget-realtime' }); RT.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: text }] } }); RT.send({ type: 'response.create' }); return; }
    record({ type: 'utterance', role: 'user', text: text, reason: source, source: 'widget-' + source });
    var ri = matchReco(text);
    if (ri) record({ type: 'reco_idea', role: 'user', text: text, topic: ri.key, page_url: ri.page_url || null, reason: 'said a recommendation (' + source + ')' });
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
      if (S.rtOn) { talkOn = true; startRT().catch(function () { S.rtOn = false; save(); rtQueue = []; talkOn = false; render(); }); }
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

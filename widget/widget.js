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
      '.ns-pill{display:flex;align-items:center;gap:10px;background:#FFFFFF;color:#161515;border:1px solid #161515;border-radius:999px;padding:7px 14px 7px 8px;cursor:pointer;font-size:14px;font-weight:600}',
      '.ns-dot{position:relative;display:inline-block;flex:none;border-radius:50%;background:#161515}',
      '.ns-eyes{position:absolute;left:0;right:0;top:22%;height:34%;display:flex;justify-content:center;gap:18%;transition:transform .3s ease;animation:ns-glance 7s ease-in-out infinite}',
      '.ns-eyes i{display:block;width:14%;height:100%;border-radius:999px;background:#FFFFFF;transform-origin:50% 50%;transition:transform .2s;animation:ns-blink 5s infinite}',
      '.ns-eyes i:nth-child(2){animation-delay:.02s}',
      '@keyframes ns-blink{0%,96%,100%{transform:scaleY(1)}97.2%{transform:scaleY(.1)}}',
      '@keyframes ns-glance{0%,40%,100%{transform:translateX(0)}45%,55%{transform:translateX(-2px)}85%,92%{transform:translateX(2px)}}',
      '@keyframes ns-bob{0%{transform:translateY(-1px)}100%{transform:translateY(1.5px)}}',
      '.ns-speaking .ns-eyes{animation:ns-bob .4s ease-in-out infinite alternate}',
      '.ns-listening .ns-eyes{animation:none;transform:translate(-6%,4%)}.ns-listening .ns-eyes i{animation:none;transform:scaleY(1.15)}',
      '.ns-thinking .ns-eyes{animation:none;transform:translate(7%,-10%)}',
      '.ns-vmode .ns-eyes{animation:none;transform:translateX(-12%)}.ns-vmode.ns-speaking .ns-eyes{animation:ns-bobl .4s ease-in-out infinite alternate}',
      '@keyframes ns-bobl{0%{transform:translate(-12%,-1px)}100%{transform:translate(-12%,1.5px)}}',
      '.ns-vmode.ns-listening .ns-eyes{transform:translate(-16%,4%)}.ns-vmode.ns-thinking .ns-eyes{transform:translate(4%,-10%)}',
      '@media (prefers-reduced-motion:reduce){.ns-eyes,.ns-eyes i,.ns-big{animation:none !important}}',
      '.ns-panel{width:360px;max-height:80vh;overflow:auto;background:#FFFFFF;border:1px solid #161515;border-radius:4px}',
      '.ns-head{display:flex;align-items:center;gap:8px;background:#FFFFFF;color:#161515;padding:10px 12px;border-bottom:1px solid rgba(22,21,21,.14)}',
      '.ns-head b{flex:1;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ns-head small{color:rgba(22,21,21,.6);white-space:nowrap}',
      '.ns-seg{display:inline-flex;border:1px solid #161515;border-radius:4px;overflow:hidden;flex:none}',
      '.ns-seg button{background:#FFFFFF;color:#161515;border:0;padding:3px 7px;font-size:12px;font-weight:600;cursor:pointer}.ns-seg button.ns-on{background:#161515;color:#FFFFFF}',
      '.ns-x{background:none;border:0;color:#161515;cursor:pointer;font-size:16px;padding:0 4px}',
      '.ns-body{padding:12px}',
      '.ns-mod{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:rgba(22,21,21,.6)}',
      '.ns-name{font-size:18px;font-weight:700;margin:2px 0 6px}',
      '.ns-say{margin:0 0 8px}',
      '.ns-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
      '.ns-chip{background:#F2EAD9;color:#161515;border-radius:4px;padding:2px 8px;font-size:12px}',
      '.ns-change{background:#FFFFFF;color:#161515;border:1px solid rgba(22,21,21,.14);border-radius:4px;padding:8px;margin-bottom:10px;font-size:13px}',
      '.ns-change:before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#D9F56A;margin-right:6px;vertical-align:1px}',
      '.ns-reply{background:#F2EAD9;color:#161515;border-radius:4px;padding:8px;margin-bottom:10px;font-size:13px}',
      '.ns-btns{display:flex;gap:8px;margin-bottom:8px}',
      '.ns-btn{flex:1;background:#161515;color:#FFFFFF;border:1px solid #161515;border-radius:4px;padding:8px;cursor:pointer;font-weight:600;font-size:14px}',
      '.ns-btn.ns-alt{background:#FFFFFF;color:#161515}.ns-btn.ns-on{background:#F2EAD9;color:#161515}',
      '.ns-form{display:flex;gap:6px;margin-bottom:12px}',
      '.ns-in{flex:1;border:1px solid #161515;border-radius:4px;padding:7px 8px;background:#fff;color:#161515;font-size:13px}',
      '.ns-recos{border-top:1px solid rgba(22,21,21,.14);padding-top:8px;margin-bottom:10px}',
      '.ns-recos .ns-mod{margin-bottom:6px}',
      '.ns-reco{display:block;width:100%;text-align:left;background:#F2EAD9;color:#161515;border:0;border-radius:4px;padding:7px 8px;margin-bottom:6px;cursor:pointer;font-size:13px;font-weight:600}',
      '.ns-reco small{display:block;font-weight:400;opacity:.8}',
      '.ns-route{border-top:1px solid rgba(22,21,21,.14);padding-top:8px;margin:0;list-style:none}',
      '.ns-route li{display:flex;gap:8px;padding:4px 0;font-size:13px;cursor:pointer}',
      '.ns-route li span:first-child{width:16px;text-align:center}',
      '.ns-route li.ns-cur{font-weight:700}',
      '.ns-close{background:#F2EAD9;color:#161515;border-radius:4px;padding:10px;margin-bottom:10px}',
      '.ns-mark{outline:2px solid #161515 !important;outline-offset:4px;transition:outline-color .3s}',
      '.ns-tint{background:#F2EAD9 !important;color:#161515 !important}',
      '.ns-root.ns-vmode{right:0;bottom:0}',
      '.ns-big{position:fixed;right:-53px;bottom:-53px;animation:ns-up .4s ease-out both}',
      '@keyframes ns-up{0%{transform:translateY(220px)}100%{transform:translateY(0)}}',
      '.ns-cap{position:fixed;right:124px;bottom:44px;max-width:340px;background:#FFFFFF;border:1px solid #161515;border-radius:4px;padding:12px 14px;font-size:16px;line-height:1.45}',
      '.ns-cap p{margin:0}',
      '.ns-tap{display:inline-block;margin-top:8px;background:#F2EAD9;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600}',
      '.ns-vbtns{display:flex;gap:14px;margin-top:10px}',
      '.ns-vbtns button{background:none;border:0;padding:0;color:rgba(22,21,21,.6);font-size:13px;font-weight:600;cursor:pointer;text-decoration:underline}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function agentDot(size) { return '<span class="ns-dot" aria-hidden="true" style="width:' + size + 'px;height:' + size + 'px"><span class="ns-eyes"><i></i><i></i></span></span>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function mount() {
    css();
    var root = document.createElement('div'); root.className = 'ns-root'; el.root = root;
    document.body.appendChild(root); render();
  }
  function setLive() {
    var r = el.root; if (!r) return;
    r.classList.toggle('ns-live', speaking || listening);
    r.classList.toggle('ns-speaking', speaking);
    r.classList.toggle('ns-listening', listening && !speaking);
    r.classList.toggle('ns-thinking', !!thinking && !speaking && !listening);
  }
  function isVoice() { return S && S.mode === 'voice'; }

  function render(extra) {
    extra = extra || el.extra || {}; el.extra = extra;
    var root = el.root; if (!root) return;
    root.classList.toggle('ns-vmode', isVoice());
    if (isVoice()) { renderVoice(); return; }
    if (!open) {
      root.innerHTML = '<button class="ns-pill" type="button">' + agentDot(22) + '<span>' + T('Demo guide', 'Guía de la demo') + '</span></button>';
      root.querySelector('.ns-pill').onclick = function () { open = true; render(); };
      setLive(); return;
    }
    var st = cur(), n = steps().length, name = S.profile && S.profile.name ? S.profile.name : T('Visitor', 'Visitante');
    var done = S.stepIndex >= n;
    var visited = S.visited || [];
    var h = '<div class="ns-panel"><div class="ns-head">' + agentDot(28) + '<b>' + esc(name) + '</b><small>' +
      (done ? T('Demo done', 'Demo terminada') : T('Step ', 'Paso ') + (S.stepIndex + 1) + T(' of ', ' de ') + n) +
      '</small><span class="ns-seg"><button type="button" class="ns-on" data-m="click">Click</button><button type="button" data-m="voice">' + T('Voice', 'Voz') + '</button></span><button class="ns-x" type="button" aria-label="Close">x</button></div><div class="ns-body">';
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
    root.querySelector('.ns-seg [data-m="voice"]').onclick = function () { setMode('voice'); };
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

  /* ---------- voice mode: the bot just speaks ---------- */
  var thinking = false, vPaused = false, vTimer = null, vCap = '';
  function renderVoice() {
    var root = el.root;
    if (!root.querySelector('.ns-voice')) {
      root.innerHTML = '<div class="ns-voice"><div class="ns-cap"><p class="ns-capt"></p><div class="ns-tapw"></div><div class="ns-vbtns"><button type="button" class="ns-pause"></button><button type="button" class="ns-toclick"></button></div></div><div class="ns-big">' + agentDot(160) + '</div></div>';
      root.querySelector('.ns-pause').onclick = function () { vPaused ? vResume() : vPause(); };
      root.querySelector('.ns-toclick').onclick = function () { setMode('click'); };
    }
    var st = cur();
    root.querySelector('.ns-capt').textContent = vCap || (st ? st.say : (S.plan.nextStep || ''));
    root.querySelector('.ns-tapw').innerHTML = pendingSay ? '<span class="ns-tap">' + T('Tap to continue', 'Toca para seguir') + '</span>' : '';
    root.querySelector('.ns-pause').textContent = vPaused ? T('Resume', 'Seguir') : T('Pause', 'Pausa');
    root.querySelector('.ns-toclick').textContent = T('Click mode', 'Modo click');
    setLive();
  }
  function vStop() {
    clearTimeout(vTimer); vTimer = null; thinking = false;
    curU = null; pendingSay = null;
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    speaking = false; if (rec && listening) try { rec.stop(); } catch (e) {}
  }
  function vSpeakCurrent() {
    var st = cur();
    if (!st) { say(T('That is the demo. Next step: ', 'Esa es la demo. Siguiente paso: ') + (S.plan.nextStep || '')); return; }
    var pre = S.stepIndex === 0 && S.plan.opening && !S.openingDone ? S.plan.opening + ' ' : '';
    if (pre) { S.openingDone = true; save(); }
    say(pre + st.say);
  }
  function vPause() { vPaused = true; vStop(); record({ type: 'voice', text: 'pause', reason: 'voice mode pause' }); render(); }
  function vResume() { vPaused = false; render(); vSpeakCurrent(); }
  function setMode(m) {
    vStop(); vPaused = false; vCap = '';
    if (talkOn) { talkOn = false; }
    S.mode = m; save();
    record({ type: 'mode', text: m, reason: 'demo guide level switch' });
    if (el.root) el.root.innerHTML = '';
    if (m === 'click') { open = true; render(); return; }
    render(); vSpeakCurrent();
  }
  /* after each spoken line: listen about 4 s; silence moves on, words go to heard() */
  function vAfter() {
    if (!isVoice() || vPaused) return;
    clearTimeout(vTimer);
    if (S.stepIndex >= steps().length) return;
    if (rec) { try { rec.lang = lang() === 'es' ? 'es-ES' : 'en-US'; rec.start(); } catch (e) {} }
    else { listening = true; setLive(); }
    vTimer = setTimeout(function () {
      if (!isVoice() || vPaused || speaking) return;
      if (rec) try { rec.stop(); } catch (e) {}
      listening = false; thinking = true; setLive();
      vTimer = setTimeout(function () { thinking = false; setLive(); if (isVoice() && !vPaused) next(); }, 500);
    }, 4200);
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

  /* ---------- voice ---------- */
  function say(text) {
    if (isVoice() && text) { vCap = text; clearTimeout(vTimer); if (rec && listening) try { rec.stop(); } catch (e) {} render(); }
    if (text && isVoice() && !window.speechSynthesis) { vTimer = setTimeout(vAfter, Math.min(12000, 1500 + text.length * 55)); return; }
    if (!text || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang() === 'es' ? 'es-ES' : 'en-US';
      curU = u;
      u.onstart = function () { if (u !== curU) return; speaking = true; setLive(); };
      u.onend = function () { if (u !== curU) return; speaking = false; setLive(); if (talkOn) listen(); if (isVoice()) vAfter(); };
      u.onerror = function (e) { if (u !== curU) return; speaking = false; setLive(); if (e && e.error === 'not-allowed') { pendingSay = text; if (isVoice()) render(); } else if (talkOn) listen(); else if (isVoice() && e && e.error !== 'interrupted' && e.error !== 'canceled') vAfter(); };
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  /* Chrome blocks speech on a fresh page until the visitor interacts: replay the line on the first click or key. */
  var pendingSay = null, curU = null;
  function flushSay() { if (pendingSay) { var t = pendingSay; pendingSay = null; say(t); } }
  document.addEventListener('pointerdown', flushSay, true);
  document.addEventListener('keydown', flushSay, true);
  function setupRec() {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return null;
    var r = new R(); r.continuous = false; r.interimResults = false;
    r.onstart = function () { listening = true; setLive(); };
    r.onend = function () { listening = false; setLive(); if (talkOn && !speaking && !isVoice()) setTimeout(listen, 250); };
    r.onerror = function (e) { if (e.error === 'not-allowed') { talkOn = false; render(); } };
    r.onresult = function (e) { var t = e.results[0][0].transcript; if (t) { if (isVoice()) { clearTimeout(vTimer); if (vPaused) return; } heard(t, 'voice'); } };
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
    if (isVoice()) { vCap = ''; render(); highlight(st); if (!vPaused) setTimeout(function () { if (isVoice() && !vPaused) vSpeakCurrent(); }, 400); return; }
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

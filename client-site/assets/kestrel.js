// Kestrel — tiny shared behaviour: active nav, toasts on buttons, tabs, ROI calculator.
(function () {
  function toast(text) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  window.kestrelToast = toast;

  document.addEventListener('DOMContentLoaded', function () {
    // Highlight the current screen in the sidebar.
    var here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar a[href]').forEach(function (a) {
      if (a.getAttribute('href').split('/').pop() === here) a.classList.add('active');
    });

    // Demo buttons: anything with data-toast shows a confirmation.
    document.querySelectorAll('[data-toast]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); toast(el.getAttribute('data-toast')); });
    });

    // Cosmetic tabs.
    document.querySelectorAll('.tabs').forEach(function (tabs) {
      tabs.querySelectorAll('span').forEach(function (s) {
        s.addEventListener('click', function () {
          tabs.querySelectorAll('span').forEach(function (x) { x.classList.remove('on'); });
          s.classList.add('on');
        });
      });
    });

    // Assistant: suggestion chips fill the composer.
    var input = document.querySelector('.composer input');
    document.querySelectorAll('.chip').forEach(function (c) {
      c.addEventListener('click', function () { if (input) { input.value = c.textContent; input.focus(); } });
    });

    // ROI calculator on pricing.
    var roi = document.getElementById('roi');
    if (roi) {
      var emp = roi.querySelector('#emp'), hrs = roi.querySelector('#hrs'), plan = roi.querySelector('#plan');
      var fmt = function (n) { return '€' + Math.round(n).toLocaleString('en-GB'); };
      var calc = function () {
        var e = +emp.value, h = +hrs.value, p = +plan.value;
        roi.querySelector('#empv').textContent = e.toLocaleString('en-GB');
        roi.querySelector('#hrsv').textContent = h;
        var cost = e * p * 12;
        var impl = e * 200; // one-off implementation
        var saved = e * h * 12 * 38 + e * 95; // admin hours at €38/h + tools switched off per head
        var net = saved - cost;
        roi.querySelector('#cost').textContent = fmt(cost);
        roi.querySelector('#impl').textContent = fmt(impl);
        roi.querySelector('#saved').textContent = fmt(saved);
        roi.querySelector('#net').textContent = fmt(net);
        roi.querySelector('#payback').textContent = net > 0 ? (impl / (net / 12)).toFixed(1) + ' months' : 'More hours saved needed';
      };
      [emp, hrs, plan].forEach(function (x) { x.addEventListener('input', calc); });
      calc();
    }
  });
})();

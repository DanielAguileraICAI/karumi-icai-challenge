// Floating "Hablar con el agente" button for any page.
// <script src="https://<deploy>/widget.js" data-url="https://producto.com" data-buyer="CFO" defer></script>
(() => {
  const me = document.currentScript;
  const base = new URL('.', me.src).href;
  const product = me.dataset.url || location.href;
  const buyer = me.dataset.buyer || '';
  const css = `#kv-fab{position:fixed;right:24px;bottom:24px;z-index:2147483647;background:#ff3b30;color:#fff;border:0;border-radius:999px;padding:14px 20px;font:600 15px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.3);cursor:pointer}
#kv-fab:hover{transform:scale(1.04)}#kv-panel{position:fixed;right:24px;bottom:90px;z-index:2147483647;width:min(1100px,calc(100vw - 48px));height:min(720px,calc(100vh - 120px));border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45);display:none;background:#0d0d10}
#kv-panel.open{display:block}#kv-panel iframe{width:100%;height:100%;border:0}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const fab = document.createElement('button'); fab.id = 'kv-fab'; fab.textContent = '🎙️ Hablar con el agente';
  const panel = document.createElement('div'); panel.id = 'kv-panel';
  let loaded = false;
  fab.onclick = () => {
    if (!loaded) {
      const f = document.createElement('iframe');
      f.allow = 'microphone; autoplay';
      f.src = `${base}?embed=1&autostart=1&url=${encodeURIComponent(product)}${buyer ? '&buyer=' + encodeURIComponent(buyer) : ''}`;
      panel.append(f); loaded = true;
    }
    const open = panel.classList.toggle('open');
    fab.textContent = open ? '✕ Cerrar demo' : '🎙️ Hablar con el agente';
  };
  document.body.append(panel, fab);
})();

# Live Demo Agent (voz): "first" cambia con cada frase

Agente de voz que hace la demo de un producto y **recalcula qué enseñar después de cada cosa que dice el visitante**: navega a la página que responde, resalta en pantalla lo que explica y deja el recorrido registrado.

## Cómo funciona
- `api/map.js`: URL → mapa de páginas (título, resumen, keywords). Lo sustituye el plan de Dani (`?plan=<url del json>`, formato en `plan.example.json`).
- `api/proxy.js`: sirve la web del producto desde nuestro dominio, para mostrarla en un iframe y poder resaltar y hacer scroll.
- `api/session.js`: crea una clave temporal de OpenAI Realtime (`gpt-realtime`, voz `marin`). La clave real nunca llega al navegador.
- `app.js`: voz por WebRTC con las herramientas `navigate_to_page`, `highlight` y `scroll`. **Sin clave** pasa a la voz del navegador (Chrome) con un buscador local de páginas. Siempre hay una caja de texto.

## Recorrido (para la memoria de Claudia)
Cada paso es un JSON `{session_id, ts, product_url, type: session_start|utterance|navigate|highlight, role, text, page_id, page_url, reason, source}`:
- se guarda en `localStorage["karumi.journeys"]`
- se emite como `window` event `karumi:step`
- se envía por POST a `?memory=<url>` (o `window.KARUMI_MEMORY_URL`) si existe
- botón "Exportar recorrido (JSON)"

## Deploy en Vercel
Root Directory = `voice-agent`, sin build. Variable de entorno: `OPENAI_API_KEY` (opcionales: `REALTIME_MODEL`, `REALTIME_VOICE`).
Uso: `https://<deploy>/?url=https://producto.com`

GitHub Pages solo sirve lo estático: ahí hace falta `?api=https://<deploy-vercel>` y funciona el modo sin clave.

## Local
`npm run dev` → http://localhost:5173 (`ALLOW_LOCAL=1` para probar contra webs en localhost).

## Añadido: cerebro, memoria y widget
- `api/plan.js` (cerebro): URL + buyer → demos por tipo de buyer (`?buyers=CFO,CTO,Ventas`), con `opening`, `buyer_ideas`, `why` y `talking_points`. Usa OpenAI si hay `OPENAI_API_KEY` (`PLAN_MODEL`) y, si no, heurística.
- `memory.js` + `api/memory.js`: "empresa X pidió Y". Aprende qué rutas piden buyers parecidos, reordena la demo antes de que lo pidan y predice la siguiente página. Persistente si hay `KV_REST_API_URL`/`KV_REST_API_TOKEN`; si no, en memoria.
- `?seed=1` carga 6 sesiones falsas (3 CFO, 3 CTO) para enseñar el aprendizaje en el pitch.
- `widget.js`: botón flotante para cualquier página (ver INTEGRATION-DANI.md).

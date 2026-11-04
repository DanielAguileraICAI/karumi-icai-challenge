# Integración del agente de voz (para Dani / su Claude)

La carpeta `voice-agent/` contiene el agente de voz y su API (funciones de Vercel). **No cambies nada dentro de `voice-agent/`**: solo intégralo en la página de demo.

## 1. Botón flotante en la página de demo
Añade antes de `</body>`:
```html
<script src="https://<DEPLOY>/widget.js" data-url="<URL del producto>" data-buyer="<tipo de buyer>" defer></script>
```
- Aparece un botón rojo "🎙️ Hablar con el agente" abajo a la derecha. Al pulsarlo se abre un panel con la web del producto y el chat, y la llamada arranca sola (pide permiso de micrófono).
- Si la URL y el buyer los mete el usuario en un formulario, crea el `<script>` dinámicamente al enviar el formulario:
```js
const s = document.createElement('script');
s.src = 'https://<DEPLOY>/widget.js';
s.dataset.url = urlInput.value; s.dataset.buyer = buyerInput.value;
document.body.appendChild(s);
```
- Alternativa sin widget: enlazar a `https://<DEPLOY>/?url=<url>&buyer=<buyer>&autostart=1`.

## 2. Pasar tu plan de demo al agente (opcional)
Si tu planner (URL + tipo de buyer → demo) genera su propio plan, sírvelo como JSON y pásalo con `?plan=<url del json>`:
```json
{ "product": "Acme", "url": "https://acme.com", "buyer": "CFO",
  "opening": "frase de apertura", "buyer_ideas": ["..."],
  "pages": [ { "id": "pricing", "url": "https://acme.com/pricing", "title": "Precios",
               "summary": "...", "keywords": ["precio"], "score": 0.9,
               "why": "por qué le importa a este buyer", "talking_points": ["..."] } ] }
```
Para varios buyers a la vez: `{ "product", "url", "demos": [ <plan>, <plan>, ... ] }`.
Sin `?plan=`, el agente usa su propio cerebro (`/api/plan`) y, si falla, un mapa básico de la web (`/api/map`).

## 3. Memoria (parte de Claudia)
Cada paso de la conversación se emite como JSON `{session_id, ts, product_url, buyer, type, role, text, page_id, page_url, reason}`:
- POST a `/api/memory`, o a `?memory=<endpoint>` si Claudia tiene el suyo
- evento `window` `karumi:step`
- `localStorage["karumi.journeys"]`

## 4. Despliegue
Vercel → importar el repo → **Root Directory: `voice-agent`**, sin comando de build → variable de entorno **`OPENAI_API_KEY`** → Deploy.
- Opcionales: `REALTIME_MODEL` (por defecto `gpt-realtime`), `REALTIME_VOICE` (`marin`), `PLAN_MODEL`.
- Si la página de demo está en GitHub Pages, `widget.js` debe apuntar al deploy de Vercel (la API vive allí).
- Sin clave, el agente usa la voz del navegador (Chrome) y siempre queda la caja de texto.

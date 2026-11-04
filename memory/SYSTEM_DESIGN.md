# Memoria + recomendaciones: system design

Para: Dani (deploy en Vercel). Carpeta: `memory/`. Rama: `clau`.

## Objetivo
1. **Recomendar**: dada la URL de un producto y un tipo de buyer, scrapear la web y sugerir 4 cosas que le pueden interesar (botones o voz).
2. **Recordar**: guardar todo lo que dicen y clican los buyers, para detectar qué piden repetidamente empresas del mismo tipo y meterlo en la demo de ese tipo.

## Arquitectura
```
 Buyer ──► Voice agent (Luis) ──POST ?memory=──┐
   │                                            ▼
   └─► Reco UI (memory/index.html)        /api/memory  ──► Supabase (sessions, events)
         │  GET                                │  (etiqueta topic con LLM)
         ▼                                     │
   /api/recommend ──► scrape web ──► LLM ──► 4 recomendaciones ──► Supabase (recommendations)
                                               
 Plan de demo (Dani) ◄── GET /api/insights ◄── vistas topic_demand / demo_promotions
```

## Flujo
1. El buyer mete URL + tipo. `GET /api/recommend` descarga la home, extrae título, descripción, titulares y enlaces internos.
2. Eso + el tipo de buyer van al **LLM**, que devuelve 4 recomendaciones `{key, title, why, page_url}`. Sin LLM hay una heurística (titulares y enlaces), así que nada se rompe.
3. Cada recomendación mostrada, cada clic y cada idea dicha al agente se envía a `POST /api/memory` como evento (`reco_shown`, `reco_click`, `reco_idea`; el voice agent ya manda `utterance`, `navigate`, `highlight`).
4. `/api/memory` guarda la sesión y el evento. Si el evento es una frase del buyer, el LLM la reduce a un **topic** (`payroll`, `security`...).
5. Las vistas agrupan por tipo de empresa y buyer. Cuando un topic lo piden **≥3 sesiones distintas** pasa a `demo_promotions`: candidato a entrar en la demo de ese tipo de empresa. `GET /api/insights?sector=&buyer=` lo expone al plan de demo.

## Para qué se necesita un LLM (2 usos, ambos baratos)
| Uso | Dónde | Entrada | Salida |
|---|---|---|---|
| Recomendar | `recommend.js` | resumen de la web + tipo de buyer | JSON con 4 recomendaciones |
| Etiquetar topic | `memory.js` | frase del buyer | 1-2 palabras (`payroll`) |

Con un modelo pequeño (tipo `gpt-4o-mini`) basta. **OpenRouter no es necesario** si Dani usa el AI Gateway de Vercel: el código lo detecta solo.

## Datos (Supabase, `schema.sql`)
- `sessions(id, product_url, domain, buyer_type, sector, company)`
- `events(session_id, type, role, text, topic, page_url, ...)`
- `recommendations(session_id, buyer_type, rec_key, title, why)`
- Vistas `topic_demand` y `demo_promotions`.
- RLS activado en todo; solo el backend entra con la secret key.

## Variables de entorno (Vercel, Root Directory `memory`)
| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://yiemsuhrlaipdarzaolb.supabase.co` |
| `SUPABASE_SERVICE_KEY` | la `sb_secret_...` (privada, no va al repo) |
| `AI_GATEWAY_API_KEY` | key del AI Gateway de Vercel (o `OPENROUTER_API_KEY` si no) |
| `LLM_MODEL` | opcional; por defecto `openai/gpt-4o-mini` en el Gateway |

Orden de prioridad del LLM: AI Gateway → OpenRouter → OpenAI → sin LLM (heurística).

## Pasos
1. Supabase: ya creado y `schema.sql` ejecutado.
2. Vercel: proyecto nuevo desde este repo, Root Directory `memory`, variables de arriba.
3. Luis: abrir el voice agent con `?memory=https://<deploy>/api/memory`.
4. Enganchar `GET /api/insights` al plan de demo.

## Límites conocidos
- Los botones aún no mandan la recomendación elegida al voice agent (solo emiten `karumi:reco`).
- El scraping solo lee la home (HTML estático); webs que renderizan con JS darán menos contenido.
- El umbral de 3 sesiones es arbitrario; ajustar en la vista `demo_promotions`.

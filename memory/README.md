# Memory + scraping (Claudia)

Guarda todo lo que dicen y clican los buyers, y recomienda cosas de la web según el tipo de buyer.

## Endpoints (Vercel, Root Directory = `memory`)
- `POST /api/memory` → destino de `?memory=` del voice agent. Guarda sesión + evento y etiqueta el `topic` de lo que pide el buyer (LLM). Acepta extras `buyer_type`, `sector`, `company`.
  Tipos nuevos de evento: `reco_shown`, `reco_click`, `reco_idea` (clic en una recomendación / idea dada al agente).
- `GET /api/recommend?url=&buyer=&session=` → scrapea y devuelve 4 recomendaciones (`recommendations[]`), también las guarda.
- `GET /api/insights?sector=&buyer=` → temas más pedidos por tipo de empresa (`demand`) y los que ya merecen entrar en la demo (`promote`, ≥3 sesiones).

## Setup
1. Supabase > SQL Editor: ejecutar `schema.sql`.
2. Vercel env: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENROUTER_API_KEY` (gratis en openrouter.ai; modelo por defecto `meta-llama/llama-3.3-70b-instruct:free`, cambiable con `LLM_MODEL`). Sin clave funciona igual con heurística, y `OPENAI_API_KEY` sirve de alternativa. Nunca en el repo.
3. Voice agent: abrir con `?memory=https://<deploy-memory>/api/memory`.

Autora: ClaudiaAgromayor (memoria en Supabase y recomendaciones del scraping).

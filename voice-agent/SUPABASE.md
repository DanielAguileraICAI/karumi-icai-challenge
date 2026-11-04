# Conectar la memoria a Supabase (Claudia)

1. En Supabase → SQL Editor, ejecuta:
```sql
create table if not exists journey_steps (
  id bigint generated always as identity primary key,
  session_id text, ts timestamptz default now(), product_url text, product_host text,
  type text, role text, text text, page_id text, page_url text, page_title text,
  reason text, source text, buyer text
);
create index if not exists journey_steps_host_ts on journey_steps (product_host, ts desc);
alter table journey_steps enable row level security;  -- solo el servidor (service role) escribe y lee
```
2. En Vercel → Settings → Environment Variables:
   `SUPABASE_URL` = https://<proyecto>.supabase.co · `SUPABASE_SERVICE_ROLE_KEY` = (Project Settings → API) · opcional `SUPABASE_TABLE` si la tabla se llama distinto. Luego Redeploy.
3. Comprueba: `https://<deploy>/api/memory` con POST devuelve `"store":"supabase"`.

Si Claudia ya tiene su propia tabla con otras columnas, basta con crear una vista o cambiar los nombres en `api/memory.js` (función `sb`).
El agente lee la memoria de `/api/memory?product=<url>` y aprende rutas por tipo de buyer en el navegador (`memory.js`).

## Cerebro externo
Si Claudia o Dani tienen su propio cerebro con una URL, se usa así: `?plan=https://su-api/plan?url={url}&buyer={buyer}`.
`{url}` y `{buyer}` se sustituyen solos. Debe devolver el formato de `plan.example.json`.

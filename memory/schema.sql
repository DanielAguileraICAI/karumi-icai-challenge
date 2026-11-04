-- Karumi memory. Pegar en Supabase > SQL Editor y ejecutar (idempotente).

create table if not exists sessions (
  id           text primary key,            -- session_id del voice agent
  product_url  text,
  domain       text,                        -- host normalizado de product_url
  buyer_type   text,                        -- cfo, hr, it, manager...
  sector       text,                        -- tipo de empresa (Logistics, Retail...)
  company      text,
  created_at   timestamptz default now()
);

create table if not exists events (
  id          bigserial primary key,
  session_id  text references sessions(id) on delete cascade,
  ts          timestamptz default now(),
  type        text not null,                -- session_start|utterance|navigate|highlight|reco_shown|reco_click|reco_idea
  role        text,                         -- user|assistant
  text        text,
  topic       text,                         -- tema normalizado de lo pedido (p.ej. "payroll", "security")
  page_id     text,
  page_url    text,
  reason      text,
  source      text,
  meta        jsonb default '{}'::jsonb
);
create index if not exists events_session_idx on events(session_id);
create index if not exists events_topic_idx   on events(topic) where topic is not null;

create table if not exists recommendations (
  id          bigserial primary key,
  session_id  text references sessions(id) on delete cascade,
  product_url text,
  buyer_type  text,
  rec_key     text,                         -- id corto de la recomendación
  title       text,
  why         text,
  created_at  timestamptz default now()
);

-- Qué piden más, por tipo de empresa y tipo de buyer. Alimenta el plan de demo.
create or replace view topic_demand as
select s.sector, s.buyer_type, e.topic,
       count(*)                    as mentions,
       count(distinct e.session_id) as sessions,
       count(distinct s.domain)     as companies
from events e join sessions s on s.id = e.session_id
where e.topic is not null
  and (e.type in ('reco_click','reco_idea') or (e.type = 'utterance' and e.role = 'user'))
group by s.sector, s.buyer_type, e.topic;

-- Candidatos a entrar en la demo de un tipo de empresa: pedidos por >=3 sesiones distintas.
create or replace view demo_promotions as
select * from topic_demand where sessions >= 3 order by sessions desc, mentions desc;

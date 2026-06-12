-- =============================================================================
-- Mundial Predictor — esquema de base de datos (Supabase / Postgres)
-- =============================================================================
-- Ejecuta este fichero en el editor SQL de Supabase para crear las tablas.
-- RLS: lectura pública en las cuatro tablas (datos no sensibles); la escritura
-- queda bloqueada para 'anon' y solo la realiza el backend con service_role,
-- que omite RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- teams — selecciones participantes (id proviene de API-Football)
-- -----------------------------------------------------------------------------
create table if not exists teams (
  id        integer primary key,          -- id de API-Football
  name      text not null,
  code      text,                         -- código corto (ESP, BRA, ...)
  country   text,
  logo_url  text
);

-- -----------------------------------------------------------------------------
-- fixtures — partidos del torneo y su resultado real (cuando finalizan)
-- -----------------------------------------------------------------------------
create table if not exists fixtures (
  id            integer primary key,       -- id de API-Football
  league_id     integer not null,
  season        integer not null,
  kickoff       timestamptz not null,      -- hora de inicio (UTC)
  status        text not null,             -- NS, 1H, HT, FT, ...
  home_team_id  integer not null references teams(id),
  away_team_id  integer not null references teams(id),

  -- resultado real (null hasta que el partido finaliza)
  home_goals    integer,
  away_goals    integer,
  home_corners  integer,
  away_corners  integer,
  home_shots    integer,
  away_shots    integer,
  home_shots_on integer,
  away_shots_on integer,
  possession    integer,                   -- % de posesión del local
  xg            numeric                     -- xG del local (si la API lo da)
);

create index if not exists fixtures_kickoff_idx on fixtures (kickoff);
create index if not exists fixtures_status_idx  on fixtures (status);

-- -----------------------------------------------------------------------------
-- team_stats — agregados por equipo/temporada usados por el modelo
-- -----------------------------------------------------------------------------
-- Guardamos sumas y partidos jugados; las medias por partido son columnas
-- generadas (se recalculan solas). El seeding pre-torneo escribe aquí valores
-- iniciales (ver lib/seeding.ts).
create table if not exists team_stats (
  team_id        integer not null references teams(id),
  league_id      integer not null,
  season         integer not null,
  matches_played integer not null default 0,

  -- sumas acumuladas (a favor / en contra)
  goals_for       integer not null default 0,
  goals_against   integer not null default 0,
  corners_for     integer not null default 0,
  corners_against integer not null default 0,
  shots_for       integer not null default 0,
  shots_against   integer not null default 0,

  -- fuerza inicial sembrada (Elo + clasificación); decae con seedWeight()
  seed_attack  numeric,   -- multiplicador de ataque sembrado (~1.0 = media)
  seed_defense numeric,   -- multiplicador de defensa sembrado (~1.0 = media)

  -- medias por partido (columnas generadas: 0 si no hay partidos jugados)
  avg_goals_for       numeric generated always as
    (case when matches_played > 0 then goals_for::numeric       / matches_played else 0 end) stored,
  avg_goals_against   numeric generated always as
    (case when matches_played > 0 then goals_against::numeric   / matches_played else 0 end) stored,
  avg_corners_for     numeric generated always as
    (case when matches_played > 0 then corners_for::numeric     / matches_played else 0 end) stored,
  avg_corners_against numeric generated always as
    (case when matches_played > 0 then corners_against::numeric / matches_played else 0 end) stored,
  avg_shots_for       numeric generated always as
    (case when matches_played > 0 then shots_for::numeric       / matches_played else 0 end) stored,
  avg_shots_against   numeric generated always as
    (case when matches_played > 0 then shots_against::numeric   / matches_played else 0 end) stored,

  primary key (team_id, league_id, season)
);

-- -----------------------------------------------------------------------------
-- predictions — caché opcional de predicciones calculadas
-- -----------------------------------------------------------------------------
create table if not exists predictions (
  fixture_id    integer primary key references fixtures(id),
  model_version text not null,
  computed_at   timestamptz not null default now(),

  -- probabilidades de cada mercado (0..1)
  p_home    numeric,   -- victoria local
  p_draw    numeric,   -- empate
  p_away    numeric,   -- victoria visitante
  p_corners_home numeric,
  p_corners_away numeric,
  p_shots_home   numeric,
  p_shots_away   numeric,

  -- valores esperados
  exp_home_goals numeric,
  exp_away_goals numeric,

  -- mercado destacado
  top_market text,
  top_prob   numeric
);

-- =============================================================================
-- Row Level Security: lectura pública, escritura bloqueada para anon
-- =============================================================================
alter table teams       enable row level security;
alter table fixtures    enable row level security;
alter table team_stats  enable row level security;
alter table predictions enable row level security;

-- Lectura pública (datos no sensibles). El service_role omite RLS, así que no
-- necesita políticas de escritura.
drop policy if exists "lectura publica teams"       on teams;
drop policy if exists "lectura publica fixtures"    on fixtures;
drop policy if exists "lectura publica team_stats"  on team_stats;
drop policy if exists "lectura publica predictions" on predictions;

create policy "lectura publica teams"       on teams       for select using (true);
create policy "lectura publica fixtures"    on fixtures    for select using (true);
create policy "lectura publica team_stats"  on team_stats  for select using (true);
create policy "lectura publica predictions" on predictions for select using (true);

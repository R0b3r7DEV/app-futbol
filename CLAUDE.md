# CLAUDE.md — Mundial Predictor

## Contexto y objetivo

Construye una aplicación web **para uso personal** que, durante el Mundial 2026
(11 junio – 19 julio), analice los partidos de cada día y calcule, mediante un
modelo estadístico, la **probabilidad de cada mercado** (victoria, más córners,
más disparos) y destaque **el de mayor probabilidad** de cada partido.

Es una herramienta de análisis personal, NO un producto comercial. Por tanto:
- **Sin autenticación** (sin Clerk, sin login). Una sola persona la usa.
- **Sin pagos, sin multi-tenancy, sin white-label.**
- Despliegue **local** (`npm run dev`), consultable desde escritorio y móvil en
  la misma red local.
- Prioridad absoluta: que **funcione, se actualice sola y sea cómoda de consultar
  a diario**. Nada de pulido de portfolio ni features de cara a clientes.

## Stack obligatorio

- **Next.js 16** (App Router) + **React** + **TypeScript**
- **Tailwind CSS** para estilos
- **Supabase** (Postgres) como base de datos. RLS activado con lectura pública
  (datos no sensibles); escritura solo desde backend con `service_role`.
- **API-Football** (api-sports.io) como fuente de datos de fútbol
- Sin ORM: usar el cliente oficial `@supabase/supabase-js`

## Modelo predictivo — especificación exacta

### Baseline: Poisson ajustado (SIEMPRE disponible, núcleo del proyecto)

Cada equipo tiene una fuerza de ataque y de defensa relativas a la media de la
competición. Los goles esperados (lambda) de un equipo se calculan así:

```
fuerza_ataque   = media_goles_a_favor_equipo   / media_goles_competición
fuerza_defensa  = media_goles_en_contra_rival  / media_goles_competición
lambda          = fuerza_ataque * fuerza_defensa * media_goles_competición
```

Al equipo local se le aplica un factor de ventaja de campo (≈1.15 sobre su
lambda). Con las lambdas de ambos equipos se construye la matriz de marcadores
(producto de dos Poisson, truncada a ~10 goles) y de ahí se derivan:
- P(victoria local), P(empate), P(victoria visitante)

El MISMO procedimiento se aplica a **córners** y **disparos** (son procesos de
conteo, Poisson encaja). Para cada uno se obtiene P(local tiene más que visitante)
y P(visitante tiene más).

Función PMF de Poisson: `P(X=k) = (lambda^k * e^-lambda) / k!`

Finalmente, de todos los mercados se selecciona el de **mayor probabilidad** y se
devuelve como "apuesta más sólida" del partido.

> Verificación obligatoria: las probabilidades de 1X2 deben sumar ~100%. Escribe
> un test que lo compruebe.

### Seeding pre-torneo (resuelve la jornada 1)

En la jornada 1 ningún equipo ha jugado en el torneo, así que no hay medias
reales todavía. Sembrar la fuerza inicial **combinando dos fuentes**:

1. **Rating Elo/FIFA** de cada selección (fuente: eloratings.net). Convertir el
   Elo en un multiplicador de fuerza respecto a una selección "media".
2. **Medias reales de clasificación + amistosos** descargadas de API-Football
   (goles a favor/en contra por partido).

Mezclar ambas con un peso configurable (`BLEND`, por defecto 0.4 = 40% Elo,
60% datos reales). Si una selección no tiene datos de clasificación, usar solo Elo.

Implementar una función `seedWeight(partidosJugadosEnTorneo)` que decae linealmente:
a los ~3 partidos el seeding desaparece y el modelo vive de datos reales del torneo.

### Capa ML — NO implementar ahora

Dejar documentado en el README que una capa XGBoost podría mejorar el baseline
cuando haya histórico real acumulado, pero **no construirla**: para uso personal
el Poisson sembrado es suficiente y el ML con pocos datos rinde peor.

## Esquema de base de datos

Crea `supabase/schema.sql` con estas tablas:

- **teams**: id (de API-Football), name, code, country, logo_url
- **fixtures**: id, league_id, season, kickoff, status, home_team_id, away_team_id,
  resultado real (home_goals, away_goals, home_corners, away_corners, home_shots,
  away_shots, home_shots_on, away_shots_on, possession, xg)
- **team_stats**: team_id, league_id, season, matches_played, y agregados de
  goles/córners/disparos a favor y en contra. Columnas calculadas (generated) para
  las medias por partido.
- **predictions** (opcional, para cachear): fixture_id, model_version,
  probabilidades de cada mercado, esperados, top_market, top_prob.

RLS: lectura pública (`using (true)`) en las cuatro tablas. Escritura sin políticas
(bloqueada para anon; el backend escribe con service_role que omite RLS).

## API-Football — integración

- Endpoint base: `https://v3.football.api-sports.io`
- Header de auth: `x-apisports-key`
- El Mundial es `league=1`, temporada `2026`.
- Cuota gratuita: 100 req/día. Cachear respuestas (revalidate ~10 min) y agrupar
  llamadas. Documentar que para el torneo completo quizá haga falta tier de pago.
- Endpoints a usar: `/fixtures` (partidos), `/fixtures/statistics` (córners,
  disparos, posesión, xG de un partido), `/teams/statistics` (agregados de equipo).
- Córners y disparos vienen en `/fixtures/statistics` con tipos como
  `"Corner Kicks"`, `"Total Shots"`, `"Shots on Goal"`, `"Ball Possession"`.

## Endpoints de la app

- `GET /api/predict?fixture=<id>` — predicción de un partido concreto.
- `GET /api/predict/day?date=YYYY-MM-DD` (por defecto hoy) — analiza **todos** los
  partidos del día, devuelve cada uno con su mercado de mayor probabilidad,
  **ordenados de mayor a menor confianza**, más un campo `bestBetOfDay`.
  Cada partido incluye el desglose completo de probabilidades para la UI.
- Toda respuesta incluye un `disclaimer`: son estimaciones de un modelo con alta
  varianza, herramienta de análisis y no garantía.

## Scripts

- `scripts/ingest.ts` — sincroniza equipos y fixtures del Mundial desde
  API-Football a Supabase; para partidos finalizados (status FT) descarga sus
  estadísticas detalladas. Pensado para ejecutarse periódicamente (cron).
- `scripts/seed.ts` — el día 11: lee `lib/teamRatings.ts`, combina Elo + datos de
  clasificación/amistosos, y escribe la fuerza inicial en `team_stats`.
- `lib/teamRatings.ts` — plantilla con las 48 selecciones (teamId + Elo) a rellenar
  manualmente antes del torneo.

## Frontend — una sola pantalla

Dashboard del día, responsive (móvil + escritorio):

- Cabecera con la fecha de hoy.
- Franja destacada con la "apuesta más sólida del día" (`bestBetOfDay`).
- Lista de partidos. Cada tarjeta muestra: hora, enfrentamiento, y a la derecha
  **la mayor probabilidad en grande** con la etiqueta del mercado.
- **Al tocar/clicar una tarjeta se despliega el desglose**: goles esperados y una
  barra de progreso por cada mercado (la del mercado más probable resaltada).
- Tema oscuro (cómodo para partidos nocturnos), tipografía con carácter (NO Inter
  ni Arial), animación suave del desplegable.
- Pie con el disclaimer del modelo.
- Estados de carga y de "no hay partidos hoy".

Debe poder arrancar con datos de ejemplo (mock) y, cambiando una línea, consumir
el endpoint real. Sin `localStorage` (usar estado de React).

## Variables de entorno (.env.local)

```
API_FOOTBALL_KEY=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

## Orden de trabajo (milestones)

Trabaja en este orden y para tras cada hito para que pueda revisar:

1. **Estructura del proyecto** + `schema.sql` + tipos base + `.env.example`.
2. **Motor Poisson** (`lib/poissonModel.ts`) + test que valida que 1X2 suma 100%.
3. **Cliente API-Football** (`lib/apiFootball.ts`) + script de ingesta.
4. **Seeding** (`lib/seeding.ts` + `scripts/seed.ts` + `lib/teamRatings.ts`).
5. **Endpoints** `/api/predict` y `/api/predict/day`.
6. **Frontend** (dashboard del día con desglose desplegable).
7. **README** con el procedimiento exacto del 11 de junio.

## Convenciones

- Comentarios de código, mensajes de commit y nombres en **español**.
- Commits con formato convencional: `feat:`, `fix:`, `style:`, `docs:`, `refactor:`.
- Código limpio y comentado; este proyecto es de uso personal, prioriza claridad
  sobre abstracción excesiva.

## Recordatorios importantes

- El modelo da **estimaciones**, no certezas. El fútbol (y más un torneo de
  selecciones en jornada 1) tiene mucha varianza. La app es orientativa.
- **Nada de dinero real**: convertir esto en apuestas con dinero entraría en
  regulación de juego (DGOJ en España). Mantenerlo como herramienta de análisis.

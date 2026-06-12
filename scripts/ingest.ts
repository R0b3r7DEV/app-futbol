// =============================================================================
// scripts/ingest.ts — sincroniza el Mundial a Supabase.
// =============================================================================
// Dos fuentes, según DATA_SOURCE en .env.local:
//   - "apifootball" (por defecto): API-Football. Trae goles + córners + disparos
//     (los partidos FT descargan estadísticas detalladas). Plan free: 100/día.
//   - "openfootball": worldcup.json. Gratis y sin límites, pero solo goles +
//     calendario (córners/disparos no; esos mercados se desactivan solos).
//
// Pensado para ejecutarse periódicamente (cron).  Uso:  npm run ingest
// =============================================================================

import "../lib/loadEnv"; // debe ir el PRIMERO: carga .env.local antes que nada
import { supabaseAdmin } from "../lib/supabase";
import { MUNDIAL } from "../lib/env";
import {
  getFixtures,
  getFixtureStatistics,
  readStat,
  sleep,
  type ApiFixture,
} from "../lib/apiFootball";
import { fetchOpenFootball } from "../lib/openFootball";

/** Espaciado entre peticiones de estadísticas (ms) para respetar ~10/min. */
const STATS_DELAY_MS = 7_000;

async function main() {
  const db = supabaseAdmin();
  const source = process.env.DATA_SOURCE ?? "apifootball";
  console.log(`→ Fuente de datos: ${source} (temporada ${MUNDIAL.season})`);

  if (source === "openfootball") {
    await ingestOpenFootball(db);
  } else {
    await ingestApiFootball(db);
  }

  console.log("✔ Ingesta completada.");
}

// -----------------------------------------------------------------------------
// Fuente API-Football (goles + córners + disparos)
// -----------------------------------------------------------------------------
async function ingestApiFootball(db: ReturnType<typeof supabaseAdmin>) {
  console.log("→ Descargando fixtures del Mundial…");
  const fixtures = await getFixtures(MUNDIAL.leagueId, MUNDIAL.season);
  console.log(`  ${fixtures.length} partidos recibidos.`);

  await upsertTeams(db, fixtures);
  await upsertFixtures(db, fixtures);
  await ingestFinishedStats(db, fixtures);
  // Solo agregamos partidos con estadísticas completas (córners no nulos).
  await recomputeTeamStats(db, true);
}

// -----------------------------------------------------------------------------
// Fuente openfootball (solo goles + calendario)
// -----------------------------------------------------------------------------
async function ingestOpenFootball(db: ReturnType<typeof supabaseAdmin>) {
  console.log("→ Descargando worldcup.json…");
  const { teams, fixtures } = await fetchOpenFootball();
  console.log(`  ${teams.length} equipos, ${fixtures.length} partidos.`);

  const { error: tErr } = await db.from("teams").upsert(teams);
  if (tErr) throw tErr;

  const rows = fixtures.map((f) => ({
    id: f.id,
    league_id: MUNDIAL.leagueId,
    season: MUNDIAL.season,
    kickoff: f.kickoff,
    status: f.status,
    home_team_id: f.homeId,
    away_team_id: f.awayId,
    home_goals: f.homeGoals,
    away_goals: f.awayGoals,
  }));
  const { error: fErr } = await db.from("fixtures").upsert(rows);
  if (fErr) throw fErr;
  console.log(`  ${rows.length} fixtures sincronizados.`);

  // Agregamos por goles (no hay córners/disparos en esta fuente).
  await recomputeTeamStats(db, false);
}

/** Upsert de las selecciones que aparecen en los fixtures. */
async function upsertTeams(
  db: ReturnType<typeof supabaseAdmin>,
  fixtures: ApiFixture[],
) {
  const teams = new Map<number, { id: number; name: string; logo_url: string }>();
  for (const f of fixtures) {
    for (const t of [f.teams.home, f.teams.away]) {
      teams.set(t.id, { id: t.id, name: t.name, logo_url: t.logo });
    }
  }
  const rows = [...teams.values()];
  const { error } = await db.from("teams").upsert(rows);
  if (error) throw error;
  console.log(`  ${rows.length} equipos sincronizados.`);
}

/** Upsert de los partidos (sin pisar resultados ya guardados). */
async function upsertFixtures(
  db: ReturnType<typeof supabaseAdmin>,
  fixtures: ApiFixture[],
) {
  const rows = fixtures.map((f) => ({
    id: f.fixture.id,
    league_id: f.league.id,
    season: f.league.season,
    kickoff: f.fixture.date,
    status: f.fixture.status.short,
    home_team_id: f.teams.home.id,
    away_team_id: f.teams.away.id,
    home_goals: f.goals.home,
    away_goals: f.goals.away,
  }));
  const { error } = await db.from("fixtures").upsert(rows);
  if (error) throw error;
  console.log(`  ${rows.length} fixtures sincronizados.`);
}

/**
 * Para cada partido FT que aún no tenga córners guardados, descarga las
 * estadísticas y actualiza el fixture.
 */
async function ingestFinishedStats(
  db: ReturnType<typeof supabaseAdmin>,
  fixtures: ApiFixture[],
) {
  const finished = fixtures.filter((f) => f.fixture.status.short === "FT");
  if (finished.length === 0) {
    console.log("  No hay partidos finalizados todavía.");
    return;
  }

  // Solo pedimos estadísticas de los que aún no tenemos completos (ahorra cuota).
  const { data: existing } = await db
    .from("fixtures")
    .select("id, home_corners")
    .in(
      "id",
      finished.map((f) => f.fixture.id),
    );
  const yaTienen = new Set(
    (existing ?? []).filter((r) => r.home_corners != null).map((r) => r.id),
  );

  const pendientes = finished.filter((f) => !yaTienen.has(f.fixture.id));
  console.log(`  ${pendientes.length} partidos FT pendientes de estadísticas.`);

  for (const [i, f] of pendientes.entries()) {
    // Espaciamos las llamadas para no superar el límite por minuto del plan
    // gratuito (~10/min). La primera no espera.
    if (i > 0) await sleep(STATS_DELAY_MS);
    try {
      const stats = await getFixtureStatistics(f.fixture.id);
      const home = stats.find((s) => s.team.id === f.teams.home.id)?.statistics ?? [];
      const away = stats.find((s) => s.team.id === f.teams.away.id)?.statistics ?? [];

      const update = {
        home_corners: readStat(home, "Corner Kicks"),
        away_corners: readStat(away, "Corner Kicks"),
        home_shots: readStat(home, "Total Shots"),
        away_shots: readStat(away, "Total Shots"),
        home_shots_on: readStat(home, "Shots on Goal"),
        away_shots_on: readStat(away, "Shots on Goal"),
        possession: readStat(home, "Ball Possession"),
        xg: readStat(home, "expected_goals"),
      };

      const { error } = await db.from("fixtures").update(update).eq("id", f.fixture.id);
      if (error) throw error;
      console.log(`    ✓ Stats de ${f.teams.home.name}–${f.teams.away.name}`);
    } catch (e) {
      console.warn(`    ✗ Falló stats de fixture ${f.fixture.id}:`, e);
    }
  }
}

/**
 * Recalcula team_stats sumando los partidos FT. Conserva las columnas de seeding
 * (seed_attack/seed_defense) ya escritas.
 * @param requireStats si true, solo agrega partidos con córners (datos completos
 *   de API-Football); si false, agrega por goles (fuente openfootball).
 */
async function recomputeTeamStats(
  db: ReturnType<typeof supabaseAdmin>,
  requireStats: boolean,
) {
  const base = db
    .from("fixtures")
    .select(
      "home_team_id, away_team_id, home_goals, away_goals, home_corners, away_corners, home_shots, away_shots",
    )
    .eq("league_id", MUNDIAL.leagueId)
    .eq("season", MUNDIAL.season)
    .eq("status", "FT")
    .not("home_goals", "is", null);
  // Con API-Football exigimos córners para no diluir las medias con ceros.
  const { data: fxs, error } = requireStats
    ? await base.not("home_corners", "is", null)
    : await base;
  if (error) throw error;

  // Acumulador por equipo.
  type Acc = {
    matches_played: number;
    goals_for: number;
    goals_against: number;
    corners_for: number;
    corners_against: number;
    shots_for: number;
    shots_against: number;
  };
  const acc = new Map<number, Acc>();
  const get = (id: number): Acc => {
    if (!acc.has(id)) {
      acc.set(id, {
        matches_played: 0,
        goals_for: 0,
        goals_against: 0,
        corners_for: 0,
        corners_against: 0,
        shots_for: 0,
        shots_against: 0,
      });
    }
    return acc.get(id)!;
  };

  for (const f of fxs ?? []) {
    const h = get(f.home_team_id);
    const a = get(f.away_team_id);
    h.matches_played++;
    a.matches_played++;
    h.goals_for += f.home_goals ?? 0;
    h.goals_against += f.away_goals ?? 0;
    a.goals_for += f.away_goals ?? 0;
    a.goals_against += f.home_goals ?? 0;
    h.corners_for += f.home_corners ?? 0;
    h.corners_against += f.away_corners ?? 0;
    a.corners_for += f.away_corners ?? 0;
    a.corners_against += f.home_corners ?? 0;
    h.shots_for += f.home_shots ?? 0;
    h.shots_against += f.away_shots ?? 0;
    a.shots_for += f.away_shots ?? 0;
    a.shots_against += f.home_shots ?? 0;
  }

  const rows = [...acc.entries()].map(([team_id, v]) => ({
    team_id,
    league_id: MUNDIAL.leagueId,
    season: MUNDIAL.season,
    ...v,
  }));

  if (rows.length === 0) {
    console.log("  Sin partidos completos: team_stats no se modifica.");
    return;
  }

  // Upsert: actualiza las sumas. seed_attack/seed_defense no se tocan porque no
  // se incluyen en el payload (Supabase solo actualiza las columnas enviadas).
  const { error: upErr } = await db
    .from("team_stats")
    .upsert(rows, { onConflict: "team_id,league_id,season" });
  if (upErr) throw upErr;
  console.log(`  team_stats recalculado para ${rows.length} equipos.`);
}

main().catch((e) => {
  console.error("✗ Ingesta fallida:", e);
  process.exit(1);
});

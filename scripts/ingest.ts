// =============================================================================
// scripts/ingest.ts — sincroniza el Mundial desde API-Football a Supabase.
// =============================================================================
// Qué hace:
//   1. Descarga equipos + fixtures del Mundial (league=1, season=2026).
//   2. Upsert de teams y fixtures.
//   3. Para los partidos finalizados (status FT) descarga sus estadísticas
//      detalladas (córners, disparos, posesión) y recalcula team_stats.
//
// Pensado para ejecutarse periódicamente (cron). Respeta la cuota: agrupa y solo
// pide estadísticas de partidos FT que aún no tengamos completos.
//
// Uso:  npm run ingest
// =============================================================================

import { config } from "dotenv";
// Cargamos .env.local (donde Next.js espera las claves) y, como respaldo, .env.
config({ path: ".env.local" });
config();
import { supabaseAdmin } from "../lib/supabase";
import { MUNDIAL } from "../lib/env";
import {
  getFixtures,
  getFixtureStatistics,
  readStat,
  type ApiFixture,
} from "../lib/apiFootball";

async function main() {
  const db = supabaseAdmin();
  console.log("→ Descargando fixtures del Mundial…");
  const fixtures = await getFixtures(MUNDIAL.leagueId, MUNDIAL.season);
  console.log(`  ${fixtures.length} partidos recibidos.`);

  await upsertTeams(db, fixtures);
  await upsertFixtures(db, fixtures);
  await ingestFinishedStats(db, fixtures);
  await recomputeTeamStats(db);

  console.log("✔ Ingesta completada.");
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

  for (const f of pendientes) {
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
 * Recalcula team_stats sumando todos los partidos FT con estadísticas. Conserva
 * las columnas de seeding (seed_attack/seed_defense) ya escritas.
 */
async function recomputeTeamStats(db: ReturnType<typeof supabaseAdmin>) {
  const { data: fxs, error } = await db
    .from("fixtures")
    .select(
      "home_team_id, away_team_id, home_goals, away_goals, home_corners, away_corners, home_shots, away_shots",
    )
    .eq("status", "FT")
    .not("home_corners", "is", null);
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

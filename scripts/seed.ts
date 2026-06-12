// =============================================================================
// scripts/seed.ts — siembra la fuerza inicial de las selecciones (día 11).
// =============================================================================
// Lee lib/teamRatings.ts, combina Elo + datos de clasificación (lib/seeding.ts)
// y escribe seed_attack / seed_defense en team_stats. Estas columnas dominan el
// modelo en la jornada 1 y decaen con seedWeight() según se juegan partidos.
//
// Ejecutar UNA VEZ antes del primer partido:  npm run seed
// Es idempotente: volver a ejecutarlo reescribe el seeding con los Elo actuales.
// =============================================================================

import "../lib/loadEnv"; // debe ir el PRIMERO: carga .env.local antes que nada
import { supabaseAdmin } from "../lib/supabase";
import { MUNDIAL } from "../lib/env";
import { buildSeed } from "../lib/seeding";
import { TEAM_RATINGS } from "../lib/teamRatings";

/** Normaliza un nombre para cruzar (minúsculas, sin acentos ni espacios extra). */
function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita marcas diacríticas (acentos)
    .toLowerCase()
    .trim();
}

async function main() {
  const db = supabaseAdmin();

  // Equipos que participan en la temporada actual (evita cruces con datos de
  // otras temporadas que puedan quedar en la BD).
  const { data: fxs, error: fErr } = await db
    .from("fixtures")
    .select("home_team_id, away_team_id")
    .eq("season", MUNDIAL.season);
  if (fErr) throw fErr;
  const validIds = new Set<number>();
  for (const f of fxs ?? []) {
    validIds.add(f.home_team_id);
    validIds.add(f.away_team_id);
  }
  if (validIds.size === 0) {
    console.error("✗ No hay equipos en fixtures de esta temporada. Ejecuta `npm run ingest`.");
    process.exit(1);
  }

  const { data: teams, error: tErr } = await db
    .from("teams")
    .select("id, name")
    .in("id", [...validIds]);
  if (tErr) throw tErr;
  const idByName = new Map((teams ?? []).map((t) => [normaliza(t.name), t.id]));

  const sinCruce: string[] = [];
  const rows = TEAM_RATINGS.map((t) => {
    const teamId = idByName.get(normaliza(t.name));
    if (!teamId) {
      sinCruce.push(t.name);
      return null;
    }
    const { seedAttack, seedDefense } = buildSeed(t.elo, t.qual);
    return {
      team_id: teamId,
      league_id: MUNDIAL.leagueId,
      season: MUNDIAL.season,
      seed_attack: seedAttack,
      seed_defense: seedDefense,
      // matches_played se queda como está (0 al empezar); no lo tocamos para no
      // pisar datos reales si el script se reejecuta a mitad de torneo.
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  if (sinCruce.length) {
    console.warn(
      `⚠ ${sinCruce.length} ratings no cruzaron con ningún equipo (revisa el ` +
        `nombre en lib/teamRatings.ts): ${sinCruce.join(", ")}`,
    );
  }

  if (rows.length === 0) {
    console.error("✗ Ningún rating cruzó con la BD. Nada que sembrar.");
    process.exit(1);
  }

  const { error } = await db
    .from("team_stats")
    .upsert(rows, { onConflict: "team_id,league_id,season" });
  if (error) throw error;

  console.log(`✔ Seeding escrito para ${rows.length} selecciones.`);
}

main().catch((e) => {
  console.error("✗ Seeding fallido:", e);
  process.exit(1);
});

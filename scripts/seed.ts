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

import { config } from "dotenv";
// Cargamos .env.local (donde Next.js espera las claves) y, como respaldo, .env.
config({ path: ".env.local" });
config();
import { supabaseAdmin } from "../lib/supabase";
import { MUNDIAL } from "../lib/env";
import { buildSeed } from "../lib/seeding";
import { TEAM_RATINGS } from "../lib/teamRatings";

async function main() {
  const db = supabaseAdmin();

  const pendientes = TEAM_RATINGS.filter((t) => t.teamId <= 0);
  if (pendientes.length) {
    console.warn(
      `⚠ ${pendientes.length} selecciones sin teamId (se ignoran). ` +
        `Rellena lib/teamRatings.ts: ${pendientes.map((t) => t.name).join(", ")}`,
    );
  }

  const rows = TEAM_RATINGS.filter((t) => t.teamId > 0).map((t) => {
    const { seedAttack, seedDefense } = buildSeed(t.elo, t.qual);
    return {
      team_id: t.teamId,
      league_id: MUNDIAL.leagueId,
      season: MUNDIAL.season,
      seed_attack: seedAttack,
      seed_defense: seedDefense,
      // matches_played se queda como está (0 al empezar); no lo tocamos para no
      // pisar datos reales si el script se reejecuta a mitad de torneo.
    };
  });

  if (rows.length === 0) {
    console.error("✗ No hay selecciones con teamId válido. Nada que sembrar.");
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

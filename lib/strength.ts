// =============================================================================
// Cálculo de la fuerza de cada equipo de cara al modelo.
// =============================================================================
// Convierte una fila de team_stats en un TeamStrength (multiplicadores ~1.0
// relativos a la media de la competición), combinando:
//   - datos REALES del torneo (medias por partido / media de la liga)
//   - fuerza SEMBRADA pre-torneo (Elo + clasificación), que decae con
//     seedWeight() a medida que se juegan partidos.
// =============================================================================

import type { LeagueAverages, TeamStrength } from "./types";

/** Medias por defecto de un Mundial cuando aún no hay datos del torneo. */
export const DEFAULT_LEAGUE_AVERAGES: LeagueAverages = {
  goals: 1.35,
  corners: 5.0,
  shots: 12.0,
};

/** Fila de team_stats relevante para el modelo. */
export interface TeamStatsRow {
  matches_played: number;
  avg_goals_for: number;
  avg_goals_against: number;
  avg_corners_for: number;
  avg_corners_against: number;
  avg_shots_for: number;
  avg_shots_against: number;
  seed_attack: number | null;
  seed_defense: number | null;
}

/**
 * Peso del seeding según los partidos jugados en el torneo. Decae linealmente
 * y desaparece a los 3 partidos: a partir de ahí el modelo vive de datos reales.
 *   n=0 → 1.0 | n=1 → 0.67 | n=2 → 0.33 | n>=3 → 0
 */
export function seedWeight(partidosJugadosEnTorneo: number): number {
  return Math.max(0, 1 - partidosJugadosEnTorneo / 3);
}

/** Divide con protección: si el denominador es 0 devuelve el neutro (1.0). */
function ratioOrNeutral(value: number, base: number): number {
  if (base <= 0) return 1;
  return value / base;
}

/**
 * Construye el TeamStrength de un equipo mezclando seeding y datos reales.
 *
 * Para GOLES disponemos de seeding (seed_attack/seed_defense). La mezcla es:
 *   fuerza = w·seed + (1-w)·real   con  w = seedWeight(partidos)
 * Cuando no hay partidos, real=1.0 (neutro) y w=1 → manda el seeding.
 *
 * Para CÓRNERS y DISPAROS no hay seeding pre-torneo fiable, así que usamos los
 * datos reales del torneo y, si no hay partidos, el neutro (1.0).
 */
export function strengthFromStats(
  stats: TeamStatsRow | null | undefined,
  league: LeagueAverages,
): TeamStrength {
  // Equipo sin fila de stats: todo neutro (se comporta como la media).
  if (!stats) {
    return {
      attackGoals: 1,
      defenseGoals: 1,
      attackCorners: 1,
      defenseCorners: 1,
      attackShots: 1,
      defenseShots: 1,
    };
  }

  const played = stats.matches_played ?? 0;
  const w = seedWeight(played);

  // --- Goles: mezcla seed + real ---
  const realAttackGoals =
    played > 0 ? ratioOrNeutral(stats.avg_goals_for, league.goals) : 1;
  const realDefenseGoals =
    played > 0 ? ratioOrNeutral(stats.avg_goals_against, league.goals) : 1;
  const seedAttack = stats.seed_attack ?? 1;
  const seedDefense = stats.seed_defense ?? 1;

  const attackGoals = w * seedAttack + (1 - w) * realAttackGoals;
  const defenseGoals = w * seedDefense + (1 - w) * realDefenseGoals;

  // --- Córners y disparos ---
  // No hay seeding pre-torneo fiable, pero SÍ regularizamos hacia la media de la
  // liga (multiplicador neutro = 1.0) con el mismo peso seedWeight. Esto evita
  // que una sola muestra extrema (p. ej. 23 disparos en el primer partido)
  // dispare los valores esperados. A los ~3 partidos manda el dato real.
  const blendNeutral = (real: number) => w * 1 + (1 - w) * real;

  const attackCorners = blendNeutral(
    played > 0 ? ratioOrNeutral(stats.avg_corners_for, league.corners) : 1,
  );
  const defenseCorners = blendNeutral(
    played > 0 ? ratioOrNeutral(stats.avg_corners_against, league.corners) : 1,
  );
  const attackShots = blendNeutral(
    played > 0 ? ratioOrNeutral(stats.avg_shots_for, league.shots) : 1,
  );
  const defenseShots = blendNeutral(
    played > 0 ? ratioOrNeutral(stats.avg_shots_against, league.shots) : 1,
  );

  return {
    attackGoals,
    defenseGoals,
    attackCorners,
    defenseCorners,
    attackShots,
    defenseShots,
  };
}

/**
 * Calcula las medias reales de la competición a partir de todas las filas de
 * team_stats con partidos jugados. Si no hay datos, devuelve los valores por
 * defecto. Esto mantiene el modelo "centrado" según evoluciona el torneo.
 */
export function leagueAveragesFromStats(rows: TeamStatsRow[]): LeagueAverages {
  const played = rows.filter((r) => r.matches_played > 0);
  if (played.length === 0) return DEFAULT_LEAGUE_AVERAGES;

  const mean = (sel: (r: TeamStatsRow) => number) =>
    played.reduce((acc, r) => acc + sel(r), 0) / played.length;

  return {
    goals: mean((r) => r.avg_goals_for) || DEFAULT_LEAGUE_AVERAGES.goals,
    corners: mean((r) => r.avg_corners_for) || DEFAULT_LEAGUE_AVERAGES.corners,
    shots: mean((r) => r.avg_shots_for) || DEFAULT_LEAGUE_AVERAGES.shots,
  };
}

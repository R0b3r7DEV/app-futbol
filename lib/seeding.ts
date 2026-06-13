// =============================================================================
// Seeding pre-torneo: fuerza inicial de cada selección antes de la jornada 1.
// =============================================================================
// En la jornada 1 nadie ha jugado en el torneo, así que no hay medias reales.
// Sembramos la fuerza combinando DOS fuentes:
//   1. Rating Elo (eloratings.net) → multiplicador respecto a una selección media.
//   2. Medias reales de clasificación/amistosos (goles a favor/en contra).
// Se mezclan con un peso `BLEND` (por defecto 0.4 = 40% Elo, 60% datos reales).
// Si una selección no tiene datos de clasificación, se usa solo Elo.
// =============================================================================

/** Peso del Elo en la mezcla (resto = datos reales de clasificación). */
export const BLEND = 0.4;

/** Elo de referencia (media aprox. del campo de las 48 selecciones, escala eloratings.net). */
export const AVG_ELO = 1800;

/**
 * Escala que controla cuánto separa el Elo a las selecciones: cuanto MENOR, más
 * se diferencian favoritos y débiles. Calibrado para que los partidos muy
 * desiguales (favorito claro vs colista) reflejen bien la diferencia, en línea
 * con el mercado y la expectativa Elo, sin inflar los partidos parejos.
 */
const ELO_SCALE = 200;

/** Sensibilidad del ataque/defensa al índice de fuerza derivado del Elo. */
const ATTACK_SENSITIVITY = 0.45;
const DEFENSE_SENSITIVITY = 0.45;

/** Goles de referencia para normalizar las medias de clasificación. */
export const REF_GOALS = 1.35;

/** Limita un valor al rango [min, max]. */
function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/**
 * Convierte un Elo en multiplicadores de ataque y defensa respecto a la media.
 * - Más Elo ⇒ más ataque (>1) y mejor defensa (defensa <1 = encaja menos).
 */
export function eloToMultipliers(elo: number): {
  attack: number;
  defense: number;
} {
  const index = (elo - AVG_ELO) / ELO_SCALE; // 0 para la media
  return {
    attack: clamp(1 + index * ATTACK_SENSITIVITY, 0.55, 1.8),
    defense: clamp(1 - index * DEFENSE_SENSITIVITY, 0.55, 1.8),
  };
}

/** Datos de clasificación/amistosos de una selección (por partido). */
export interface QualificationStats {
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
}

/**
 * Calcula la fuerza sembrada (seed_attack / seed_defense) de una selección
 * mezclando Elo y, si existen, datos reales de clasificación.
 */
export function buildSeed(
  elo: number,
  qual?: QualificationStats | null,
): { seedAttack: number; seedDefense: number } {
  const eloMult = eloToMultipliers(elo);

  // Sin datos de clasificación: solo Elo.
  if (!qual) {
    return { seedAttack: eloMult.attack, seedDefense: eloMult.defense };
  }

  // Datos reales normalizados a multiplicadores respecto a REF_GOALS.
  const realAttack = clamp(qual.goalsForPerGame / REF_GOALS, 0.4, 2.2);
  const realDefense = clamp(qual.goalsAgainstPerGame / REF_GOALS, 0.4, 2.2);

  // Mezcla: BLEND·Elo + (1-BLEND)·real.
  return {
    seedAttack: BLEND * eloMult.attack + (1 - BLEND) * realAttack,
    seedDefense: BLEND * eloMult.defense + (1 - BLEND) * realDefense,
  };
}

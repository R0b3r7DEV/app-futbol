// =============================================================================
// Capa de ajustes manuales por disponibilidad de plantilla.
// =============================================================================
// El modelo Poisson + Elo captura la fuerza MEDIA de cada selección, pero no
// sabe quién juega cada día. Una baja clave cambia mucho un partido (no es lo
// mismo Francia con Mbappé que sin él). Como no hay un feed gratuito y fiable de
// alineaciones/bajas para el Mundial 2026, esto se gestiona a mano aquí.
//
// CÓMO USARLO: añade una entrada por selección (clave = teams.name, en inglés)
// con un `factor`:
//   factor = 1.0  → plantilla completa (sin efecto)
//   factor < 1.0  → más débil (p. ej. 0.90 = pierde ~10% de fuerza)
//   factor > 1.0  → más fuerte de lo que dice su media (poco habitual)
// El `note` se muestra en la tarjeta del partido para recordar el motivo.
//
// Actualízalo el día del partido según las alineaciones confirmadas y vuelve a
// cargar la página (no hace falta reingestar ni resembrar).
// =============================================================================

import type { TeamStrength } from "./types";

export interface SquadAdjustment {
  /** Multiplicador de fuerza de la plantilla disponible (1.0 = completa). */
  factor: number;
  /** Motivo, se muestra en la UI (p. ej. "Sin Mbappé (lesión)"). */
  note?: string;
}

/**
 * Ajustes activos, por nombre de selección (igual que teams.name).
 * Ejemplos (descomenta y edita según las bajas reales del día):
 *
 *   "France":      { factor: 0.90, note: "Sin Mbappé (lesión)" },
 *   "Portugal":    { factor: 0.94, note: "Sin Bruno Fernandes (sanción)" },
 *   "Netherlands": { factor: 0.96, note: "Duda Van Dijk" },
 */
export const TEAM_ADJUSTMENTS: Record<string, SquadAdjustment> = {
  // Vacío por defecto: sin ajustes, el modelo usa la fuerza media.
};

/**
 * Aplica un ajuste a la fuerza de un equipo. Un equipo más fuerte ataca más
 * (×factor) y encaja menos (÷factor); más débil, al revés.
 */
export function adjustStrength(
  s: TeamStrength,
  adj?: SquadAdjustment,
): TeamStrength {
  if (!adj || adj.factor === 1) return s;
  const f = adj.factor;
  return {
    attackGoals: s.attackGoals * f,
    defenseGoals: s.defenseGoals / f,
    attackCorners: s.attackCorners * f,
    defenseCorners: s.defenseCorners / f,
    attackShots: s.attackShots * f,
    defenseShots: s.defenseShots / f,
  };
}

/** Devuelve el ajuste de una selección por nombre, si existe. */
export function adjustmentFor(teamName: string): SquadAdjustment | undefined {
  return TEAM_ADJUSTMENTS[teamName];
}

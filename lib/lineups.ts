// =============================================================================
// Recálculo por alineaciones: ajuste por partido según los 11 titulares.
// =============================================================================
// Cuando salen los onces (~1h antes), marca aquí los jugadores CLAVE que NO
// juegan en ESE partido y el modelo recalcula solo esa predicción. No hace falta
// reingestar ni resembrar: edita este archivo y recarga la página.
//
// Cómo funciona:
//   1. KEY_PLAYERS define, por selección, los jugadores importantes y su
//      "impacto" = fracción de fuerza que pierde el equipo si ESE jugador falta
//      (0.12 = pierde ~12%). Solo hace falta listar a los importantes.
//   2. LINEUP_NEWS, por día y selección, lista los que se caen del once.
//   3. El factor del partido = 1 − (suma de impactos de los ausentes), acotado.
//      Un jugador ausente que no esté en KEY_PLAYERS usa DEFAULT_OUT_IMPACT.
// =============================================================================

import type { SquadAdjustment } from "./adjustments";

/** Impacto por defecto de un titular ausente no listado en KEY_PLAYERS. */
const DEFAULT_OUT_IMPACT = 0.04;

/** Suelo del factor: por mucho que falten, no baja de aquí. */
const MIN_FACTOR = 0.65;

/**
 * Jugadores clave por selección y su impacto (0..~0.15). Lista de arranque para
 * las grandes; añade los que quieras. La clave externa = teams.name (inglés).
 */
export const KEY_PLAYERS: Record<string, Record<string, number>> = {
  France: { "Mbappé": 0.12, Dembélé: 0.05, Tchouaméni: 0.05, Saliba: 0.04 },
  Spain: { "Lamine Yamal": 0.08, Rodri: 0.08, Pedri: 0.06, "Nico Williams": 0.05 },
  Argentina: { Messi: 0.12, "Lautaro Martínez": 0.06, "Mac Allister": 0.05, "Julián Álvarez": 0.05 },
  Brazil: { "Vinícius Júnior": 0.09, Rodrygo: 0.05, Raphinha: 0.05 },
  England: { Bellingham: 0.09, Kane: 0.08, Saka: 0.05, Foden: 0.05 },
  Portugal: { "Bruno Fernandes": 0.07, "Cristiano Ronaldo": 0.06, "Bernardo Silva": 0.05, Vitinha: 0.05 },
  Netherlands: { "Frenkie de Jong": 0.06, "Virgil van Dijk": 0.06, Gakpo: 0.05, Depay: 0.04 },
  Belgium: { "De Bruyne": 0.1, Lukaku: 0.06, Doku: 0.05 },
  Germany: { Musiala: 0.08, Wirtz: 0.07, Kimmich: 0.06 },
  Norway: { Haaland: 0.13, "Ødegaard": 0.08 },
  Croatia: { "Modrić": 0.07 },
  Colombia: { "Luis Díaz": 0.08, "James Rodríguez": 0.07 },
  Uruguay: { Valverde: 0.08, "Darwin Núñez": 0.05 },
  Japan: { "Kubo": 0.06, Mitoma: 0.06 },
  Morocco: { Hakimi: 0.07, "En-Nesyri": 0.05 },
};

/**
 * Bajas/ausencias del once por día y selección.
 * Clave externa = fecha del partido "YYYY-MM-DD"; interna = teams.name.
 * Ejemplo:
 *   "2026-06-25": { France: ["Mbappé", "Tchouaméni"] },
 */
export const LINEUP_NEWS: Record<string, Record<string, string[]>> = {
  // Vacío por defecto.
};

/**
 * Calcula el ajuste por alineación de una selección en una fecha concreta a
 * partir de los ausentes anotados. Devuelve undefined si no hay novedades.
 */
export function lineupAdjustmentFor(
  teamName: string,
  dateISO: string,
): SquadAdjustment | undefined {
  const day = dateISO.slice(0, 10);
  const outs = LINEUP_NEWS[day]?.[teamName];
  if (!outs || outs.length === 0) return undefined;

  const impacts = KEY_PLAYERS[teamName] ?? {};
  const totalImpact = outs.reduce(
    (acc, player) => acc + (impacts[player] ?? DEFAULT_OUT_IMPACT),
    0,
  );
  const factor = Math.max(MIN_FACTOR, 1 - totalImpact);
  return { factor, note: `Sin ${outs.join(", ")}` };
}
